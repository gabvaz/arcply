"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  buildPlayerHistory,
  fixturesForNewPair,
  generateBalancedPool,
  generateRandomMatch,
  generateRandomRoundsSchedule,
  probeStrictRandomRounds,
  generateRoundRobin,
  nextAvailableRound,
  nextBalancedMatch,
} from "@/lib/schedule";
import { validateScore } from "@/lib/ranking";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { uniquePlaySlug } from "@/lib/slug";
import type {
  PlayFormat,
  PairingMode,
  MixedPairingPolicy,
  VarietyPolicy,
  Prisma,
} from "@prisma/client";

const playSchema = z.object({
  name: z.string().trim().min(1),
  format: z.enum([
    "ROUND_ROBIN",
    "ROUND_ROBIN_MULTI",
    "BALANCED_QUEUE",
    "RANDOM",
    "RANDOM_ROUNDS",
  ]),
  rounds: z.coerce.number().int().min(1).max(40).default(1),
  plannedPlayerCount: z.coerce.number().int().min(4).max(64).optional(),
  pairingMode: z.enum(["PLAYER_CHOICE", "ADMIN_ASSIGN"]).default("ADMIN_ASSIGN"),
  mixedPairing: z.enum(["IGNORE", "PREFERRED", "REQUIRED"]).default("IGNORE"),
  varietyPolicy: z.enum(["PREFER_NEW", "STRICT"]).default("PREFER_NEW"),
});

const activePairWhere: Prisma.PairWhereInput = { withdrawnAt: null };

function isIndividualFormat(format: string) {
  return format === "RANDOM" || format === "RANDOM_ROUNDS";
}

export async function createPlay(formData: FormData) {
  await requireAdmin();
  const parsed = playSchema.safeParse({
    name: formData.get("name"),
    format: formData.get("format"),
    rounds: formData.get("rounds") || 1,
    plannedPlayerCount: formData.get("plannedPlayerCount") || undefined,
    pairingMode: formData.get("pairingMode") || "ADMIN_ASSIGN",
    mixedPairing: formData.get("mixedPairing") || "IGNORE",
    varietyPolicy: formData.get("varietyPolicy") || "PREFER_NEW",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const format = parsed.data.format;
  if (format === "RANDOM_ROUNDS") {
    if (!parsed.data.plannedPlayerCount) {
      return { error: "Informe a quantidade de participantes" };
    }
    if (parsed.data.varietyPolicy === "STRICT") {
      const probe = probeStrictRandomRounds(
        parsed.data.plannedPlayerCount,
        parsed.data.rounds,
        { attempts: 16, trials: 500 },
      );
      if (!probe.ok) return { error: probe.error };
    }
  }

  const slug = await uniquePlaySlug(parsed.data.name);
  const individual = isIndividualFormat(format);

  const play = await prisma.play.create({
    data: {
      name: parsed.data.name,
      slug,
      gamesToWin: 0,
      format: format as PlayFormat,
      rounds:
        format === "ROUND_ROBIN_MULTI" || format === "RANDOM_ROUNDS"
          ? parsed.data.rounds
          : 1,
      plannedPlayerCount:
        format === "RANDOM_ROUNDS" ? parsed.data.plannedPlayerCount! : null,
      pairingMode: individual
        ? "ADMIN_ASSIGN"
        : (parsed.data.pairingMode as PairingMode),
      mixedPairing: individual
        ? (parsed.data.mixedPairing as MixedPairingPolicy)
        : "IGNORE",
      varietyPolicy:
        format === "RANDOM_ROUNDS"
          ? (parsed.data.varietyPolicy as VarietyPolicy)
          : "PREFER_NEW",
      status: "open",
    },
  });

  redirect(`/admin/plays/${play.slug}`);
}

export async function addPlayersToPlay(playId: string, playerIds: string[]) {
  await requireAdmin();
  if (!playerIds.length) return { error: "Selecione jogadores" };

  const play = await prisma.play.findUnique({
    where: { id: playId },
    select: {
      plannedPlayerCount: true,
      format: true,
      _count: { select: { entries: true } },
      entries: { select: { playerId: true } },
    },
  });
  if (!play) return { error: "Play não encontrado" };

  const uniqueIds = [...new Set(playerIds)];
  const already = new Set(play.entries.map((e) => e.playerId));
  const toAdd = uniqueIds.filter((id) => !already.has(id));

  if (
    play.format === "RANDOM_ROUNDS" &&
    play.plannedPlayerCount != null &&
    toAdd.length > 0
  ) {
    const room = play.plannedPlayerCount - play._count.entries;
    if (room <= 0) {
      return {
        error: `Elenco cheio (${play.plannedPlayerCount} vagas)`,
      };
    }
    if (toAdd.length > room) {
      return {
        error: `Só cabem mais ${room} de ${play.plannedPlayerCount} vagas (tentou +${toAdd.length})`,
      };
    }
  }

  for (const playerId of toAdd) {
    await prisma.playEntry.upsert({
      where: { playId_playerId: { playId, playerId } },
      create: { playId, playerId },
      update: {},
    });
  }

  await revalidatePlay(playId);
  return { ok: true };
}

export async function removePlayerFromPlay(playId: string, playerId: string) {
  await requireAdmin();

  const play = await prisma.play.findUnique({ where: { id: playId } });
  if (!play) return { error: "Play não encontrado" };

  if (play.format === "RANDOM_ROUNDS") {
    const anyMatch = await prisma.match.findFirst({ where: { playId } });
    if (anyMatch) {
      return {
        error:
          "Já existem rodadas geradas — remova o chaveamento antes de tirar jogadores",
      };
    }
  } else if (play.format === "RANDOM") {
    const busy = await prisma.match.findFirst({
      where: {
        playId,
        status: { in: ["pending", "in_progress"] },
        OR: [
          { pairHome: { OR: [{ playerAId: playerId }, { playerBId: playerId }] } },
          { pairAway: { OR: [{ playerAId: playerId }, { playerBId: playerId }] } },
        ],
      },
    });
    if (busy) {
      return {
        error: "Jogador está em um jogo ativo — finalize ou remova o jogo antes",
      };
    }
  } else {
    const inPair = await prisma.pair.findFirst({
      where: {
        playId,
        withdrawnAt: null,
        OR: [{ playerAId: playerId }, { playerBId: playerId }],
      },
    });
    if (inPair) {
      return { error: "Jogador está em uma dupla ativa — remova a dupla antes" };
    }
  }

  await prisma.playEntry.deleteMany({ where: { playId, playerId } });
  await revalidatePlay(playId);
  return { ok: true };
}

export async function createPair(
  playId: string,
  playerAId: string,
  playerBId: string,
  label?: string,
) {
  await requireAdmin();
  if (playerAId === playerBId) return { error: "Escolha dois jogadores diferentes" };

  const play = await prisma.play.findUnique({ where: { id: playId } });
  if (!play) return { error: "Play não encontrado" };
  if (play.format === "RANDOM" || play.format === "RANDOM_ROUNDS") {
    return { error: "No formato aleatório as duplas são sorteadas automaticamente" };
  }

  const entries = await prisma.playEntry.findMany({
    where: { playId, playerId: { in: [playerAId, playerBId] } },
  });
  if (entries.length !== 2) {
    return { error: "Ambos precisam estar no play" };
  }

  const busy = await prisma.pair.findFirst({
    where: {
      playId,
      withdrawnAt: null,
      OR: [
        { playerAId },
        { playerBId },
        { playerAId: playerBId },
        { playerBId: playerAId },
      ],
    },
  });
  if (busy) return { error: "Um dos jogadores já está em outra dupla ativa" };

  const pair = await prisma.pair.create({
    data: {
      playId,
      playerAId,
      playerBId,
      label: label?.trim() || null,
    },
  });

  // Mid-play: gera pendentes vs duplas ativas (RR/MULTI)
  await syncFixturesForNewPair(playId, pair.id);

  await revalidatePlay(playId);
  return { ok: true };
}

/** Soft-withdraw (opção A): mantém ranking/completed; apaga só pendentes. */
export async function withdrawPair(playId: string, pairId: string) {
  await requireAdmin();

  const pair = await prisma.pair.findFirst({
    where: { id: pairId, playId },
  });
  if (!pair) return { error: "Dupla não encontrada" };
  if (pair.withdrawnAt) return { error: "Dupla já foi removida" };

  const completed = await prisma.match.count({
    where: {
      playId,
      status: "completed",
      OR: [{ pairHomeId: pairId }, { pairAwayId: pairId }],
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({
      where: {
        playId,
        status: "pending",
        OR: [{ pairHomeId: pairId }, { pairAwayId: pairId }],
      },
    });

    if (completed > 0) {
      await tx.pair.update({
        where: { id: pairId },
        data: { withdrawnAt: new Date() },
      });
    } else {
      await tx.pair.delete({ where: { id: pairId } });
    }
  });

  await revalidatePlay(playId);
  return { ok: true };
}

export async function generateMatches(playId: string) {
  await requireAdmin();
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      pairs: { where: activePairWhere },
      entries: true,
      matches: {
        include: {
          pairHome: true,
          pairAway: true,
        },
      },
    },
  });
  if (!play) return { error: "Play não encontrado" };

  if (play.matches.length > 0) {
    return { error: "Já existem jogos. Limpe a lista antes de regenerar." };
  }

  if (play.format === "RANDOM") {
    return generateNextRandomMatch(playId, { first: true });
  }

  if (play.format === "RANDOM_ROUNDS") {
    return generateRandomRounds(playId);
  }

  if (play.pairs.length < 2) {
    return { error: "Precisa de pelo menos 2 duplas ativas" };
  }

  const fixtures =
    play.format === "ROUND_ROBIN"
      ? generateRoundRobin(play.pairs, 1)
      : play.format === "ROUND_ROBIN_MULTI"
        ? generateRoundRobin(play.pairs, play.rounds)
        : generateBalancedPool(play.pairs);

  await prisma.match.createMany({
    data: fixtures.map((f) => ({
      playId,
      pairHomeId: f.pairHomeId,
      pairAwayId: f.pairAwayId,
      round: f.round,
      orderIndex: f.orderIndex,
    })),
  });

  await prisma.play.update({
    where: { id: playId },
    data: { status: "in_progress" },
  });

  await revalidatePlay(playId);
  return { ok: true, count: fixtures.length };
}

export async function generateNextRandomMatch(
  playId: string,
  opts?: { first?: boolean },
) {
  await requireAdmin();
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      entries: true,
      matches: {
        include: {
          pairHome: true,
          pairAway: true,
        },
        orderBy: [{ orderIndex: "asc" }],
      },
    },
  });
  if (!play) return { error: "Play não encontrado" };
  if (play.format !== "RANDOM") {
    return { error: "Só disponível no formato aleatório" };
  }
  if (opts?.first && play.matches.length > 0) {
    return { error: "Já existem jogos. Limpe a lista antes de regenerar." };
  }
  if (!opts?.first && play.matches.length === 0) {
    return { error: "Gere o primeiro jogo antes" };
  }

  const playerIds = play.entries.map((e) => e.playerId);
  if (playerIds.length < 4) {
    return { error: "Precisa de pelo menos 4 jogadores" };
  }

  const busyIds = new Set<string>();
  for (const m of play.matches) {
    if (m.status !== "pending" && m.status !== "in_progress") continue;
    busyIds.add(m.pairHome.playerAId);
    busyIds.add(m.pairHome.playerBId);
    busyIds.add(m.pairAway.playerAId);
    busyIds.add(m.pairAway.playerBId);
  }
  const available = playerIds.filter((id) => !busyIds.has(id));
  if (available.length < 4) {
    return {
      error: `Precisa de pelo menos 4 jogadores livres (${available.length} livres agora)`,
    };
  }

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, gender: true },
  });
  const genderByPlayer = new Map(
    players.map((p) => [p.id, p.gender as "MALE" | "FEMALE"]),
  );

  const history = buildPlayerHistory(playerIds, play.matches);
  const result = generateRandomMatch(available, history, {
    genderByPlayer,
    mixedPairing: play.mixedPairing,
  });
  if (result.error) return { error: result.error };
  if (!result.court) return { error: "Não foi possível gerar o jogo" };

  const court = result.court;
  const maxOrder = await prisma.match
    .aggregate({ where: { playId }, _max: { orderIndex: true } })
    .then((r) => r._max.orderIndex ?? -1);

  const match = await prisma.$transaction(async (tx) => {
    const home = await tx.pair.create({
      data: {
        playId,
        playerAId: court.homeA,
        playerBId: court.homeB,
      },
    });
    const away = await tx.pair.create({
      data: {
        playId,
        playerAId: court.awayA,
        playerBId: court.awayB,
      },
    });
    const created = await tx.match.create({
      data: {
        playId,
        pairHomeId: home.id,
        pairAwayId: away.id,
        round: 1,
        orderIndex: maxOrder + 1,
        status: "pending",
      },
    });
    if (opts?.first || play.status === "open") {
      await tx.play.update({
        where: { id: playId },
        data: { status: "in_progress" },
      });
    }
    return created;
  });

  await revalidatePlay(playId);
  return { ok: true, matchId: match.id };
}

/** @deprecated use generateNextRandomMatch — kept as alias for UI migrate */
export async function generateNextRandomRound(playId: string) {
  return generateNextRandomMatch(playId);
}

/** Gera todas as N rodadas do formato RANDOM_ROUNDS. */
export async function generateRandomRounds(playId: string) {
  await requireAdmin();
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      entries: true,
      matches: true,
    },
  });
  if (!play) return { error: "Play não encontrado" };
  if (play.format !== "RANDOM_ROUNDS") {
    return { error: "Só disponível no formato Aleatório × N rodadas" };
  }
  if (play.matches.length > 0) {
    return { error: "Já existem jogos. Use Regenerar se quiser refazer." };
  }

  const playerIds = play.entries.map((e) => e.playerId);
  if (playerIds.length < 4) {
    return { error: "Precisa de pelo menos 4 jogadores" };
  }
  if (
    play.plannedPlayerCount != null &&
    playerIds.length !== play.plannedPlayerCount
  ) {
    return {
      error: `Planejado ${play.plannedPlayerCount} jogadores, há ${playerIds.length}. Ajuste o elenco.`,
    };
  }

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, gender: true },
  });
  const genderByPlayer = new Map(
    players.map((p) => [p.id, p.gender as "MALE" | "FEMALE"]),
  );

  let result = generateRandomRoundsSchedule(playerIds, play.rounds, {
    genderByPlayer,
    mixedPairing: play.mixedPairing,
    varietyPolicy: play.varietyPolicy,
  });
  // STRICT é estocástico: algumas tentativas passam onde outras falham cedo
  if (result.error && play.varietyPolicy === "STRICT") {
    for (let a = 0; a < 15; a++) {
      result = generateRandomRoundsSchedule(playerIds, play.rounds, {
        genderByPlayer,
        mixedPairing: play.mixedPairing,
        varietyPolicy: "STRICT",
      });
      if (!result.error) break;
    }
  }
  if (result.error) return { error: result.error };
  if (!result.rounds?.length) return { error: "Não foi possível gerar as rodadas" };

  const pairRows: {
    id: string;
    playId: string;
    playerAId: string;
    playerBId: string;
  }[] = [];
  const matchRows: {
    playId: string;
    pairHomeId: string;
    pairAwayId: string;
    round: number;
    orderIndex: number;
    status: "pending";
  }[] = [];

  let orderIndex = 0;
  for (const round of result.rounds) {
    for (const court of round.courts) {
      const homeId = crypto.randomUUID();
      const awayId = crypto.randomUUID();
      pairRows.push({
        id: homeId,
        playId,
        playerAId: court.homeA,
        playerBId: court.homeB,
      });
      pairRows.push({
        id: awayId,
        playId,
        playerAId: court.awayA,
        playerBId: court.awayB,
      });
      matchRows.push({
        playId,
        pairHomeId: homeId,
        pairAwayId: awayId,
        round: round.round,
        orderIndex: orderIndex++,
        status: "pending",
      });
    }
  }

  await prisma.$transaction([
    prisma.pair.createMany({ data: pairRows }),
    prisma.match.createMany({ data: matchRows }),
    prisma.play.update({
      where: { id: playId },
      data: { status: "in_progress" },
    }),
  ]);

  await revalidatePlay(playId);
  return { ok: true, rounds: play.rounds };
}

/** Apaga chaveamento RANDOM_ROUNDS se nenhum jogo saiu de pending. */
export async function clearRandomRoundsSchedule(playId: string) {
  await requireAdmin();
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: { matches: true },
  });
  if (!play) return { error: "Play não encontrado" };
  if (play.format !== "RANDOM_ROUNDS") {
    return { error: "Só disponível no formato Aleatório × N rodadas" };
  }
  if (play.matches.some((m) => m.status !== "pending")) {
    return {
      error: "Há jogos em andamento ou finalizados — não dá para regenerar",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { playId } });
    await tx.pair.deleteMany({ where: { playId } });
    await tx.play.update({
      where: { id: playId },
      data: { status: "open" },
    });
  });

  await revalidatePlay(playId);
  return { ok: true };
}

export async function addNextBalancedMatch(playId: string) {
  await requireAdmin();
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      pairs: { where: activePairWhere },
      matches: true,
    },
  });
  if (!play) return { error: "Play não encontrado" };
  if (play.format !== "BALANCED_QUEUE") {
    return { error: "Só disponível em fila balanceada" };
  }
  if (play.pairs.length < 2) return { error: "Precisa de 2+ duplas ativas" };

  const next = nextBalancedMatch(
    play.pairs,
    play.matches.map((m) => ({
      pairHomeId: m.pairHomeId,
      pairAwayId: m.pairAwayId,
    })),
  );
  if (!next) return { error: "Não foi possível gerar partida" };

  const maxOrder = play.matches.reduce((acc, m) => Math.max(acc, m.orderIndex), -1);
  const orderIndex = maxOrder + 1;
  const round = nextAvailableRound(play.matches, next.pairHomeId, next.pairAwayId);

  await prisma.match.create({
    data: {
      playId,
      pairHomeId: next.pairHomeId,
      pairAwayId: next.pairAwayId,
      orderIndex,
      round,
    },
  });

  if (play.status === "open") {
    await prisma.play.update({
      where: { id: playId },
      data: { status: "in_progress" },
    });
  }

  await revalidatePlay(playId);
  return { ok: true };
}

/** Remove um jogo específico. Em RANDOM, apaga as duplas órfãs desse match. */
export async function deleteMatch(playId: string, matchId: string) {
  await requireAdmin();
  const play = await prisma.play.findUnique({ where: { id: playId } });
  if (!play) return { error: "Play não encontrado" };

  const match = await prisma.match.findFirst({
    where: { id: matchId, playId },
  });
  if (!match) return { error: "Jogo não encontrado" };

  const pairHomeId = match.pairHomeId;
  const pairAwayId = match.pairAwayId;

  await prisma.$transaction(async (tx) => {
    await tx.match.delete({ where: { id: matchId } });

    if (play.format === "RANDOM" || play.format === "RANDOM_ROUNDS") {
      const stillUsed = await tx.match.findMany({
        where: { playId },
        select: { pairHomeId: true, pairAwayId: true },
      });
      const used = new Set(
        stillUsed.flatMap((m) => [m.pairHomeId, m.pairAwayId]),
      );
      for (const pairId of [pairHomeId, pairAwayId]) {
        if (!used.has(pairId)) {
          await tx.pair.delete({ where: { id: pairId } });
        }
      }
    }

    const remaining = await tx.match.count({ where: { playId } });
    if (remaining === 0 && play.status !== "finished") {
      await tx.play.update({
        where: { id: playId },
        data: { status: "open" },
      });
    }
  });

  await revalidatePlay(playId);
  return { ok: true };
}

export async function startMatch(playId: string, matchId: string) {
  await requireAdmin();
  const match = await prisma.match.findFirst({
    where: { id: matchId, playId },
  });
  if (!match) return { error: "Jogo não encontrado" };
  if (match.status !== "pending") {
    return { error: "Só é possível iniciar um jogo pendente" };
  }
  await prisma.match.update({
    where: { id: matchId },
    data: { status: "in_progress" },
  });
  await revalidatePlay(playId);
  return { ok: true };
}

export async function recordScore(
  playId: string,
  matchId: string,
  gamesHome: number,
  gamesAway: number,
) {
  await requireAdmin();
  const play = await prisma.play.findUnique({ where: { id: playId } });
  if (!play) return { error: "Play não encontrado" };

  const match = await prisma.match.findFirst({
    where: { id: matchId, playId },
  });
  if (!match) return { error: "Jogo não encontrado" };

  if (play.format === "RANDOM" && match.status !== "in_progress") {
    return { error: "Inicie o jogo antes de registrar o placar" };
  }
  if (play.format !== "RANDOM" && match.status === "completed") {
    // allow overwrite via clear first — keep previous behavior for non-random
  }

  const err = validateScore(gamesHome, gamesAway);
  if (err) return { error: err };

  await prisma.match.update({
    where: { id: matchId },
    data: {
      gamesHome,
      gamesAway,
      scoreOverride: true,
      status: "completed",
    },
  });

  await revalidatePlay(playId);
  return { ok: true };
}

export async function clearScore(playId: string, matchId: string) {
  await requireAdmin();
  await prisma.match.update({
    where: { id: matchId },
    data: {
      gamesHome: null,
      gamesAway: null,
      scoreOverride: false,
      status: "pending",
    },
  });
  await revalidatePlay(playId);
  return { ok: true };
}

/** Troca manual dos 4 jogadores de um jogo no formato RANDOM. */
export async function updateRandomMatchLineup(
  playId: string,
  matchId: string,
  lineup: {
    homeA: string;
    homeB: string;
    awayA: string;
    awayB: string;
  },
) {
  await requireAdmin();

  const newIds = [lineup.homeA, lineup.homeB, lineup.awayA, lineup.awayB];
  if (newIds.some((id) => !id)) {
    return { error: "Selecione os 4 jogadores" };
  }
  if (new Set(newIds).size !== 4) {
    return { error: "Os 4 jogadores devem ser distintos" };
  }

  const playFull = await prisma.play.findUnique({
    where: { id: playId },
    include: { entries: true },
  });
  if (!playFull) return { error: "Play não encontrado" };
  if (playFull.format !== "RANDOM") {
    return { error: "Só disponível no formato aleatório" };
  }

  const entrySet = new Set(playFull.entries.map((e) => e.playerId));
  for (const id of newIds) {
    if (!entrySet.has(id)) {
      return { error: "Jogador não está neste play" };
    }
  }

  const match = await prisma.match.findFirst({
    where: { id: matchId, playId },
    include: { pairHome: true, pairAway: true },
  });
  if (!match) return { error: "Jogo não encontrado" };
  if (match.status !== "pending") {
    return { error: "Só é possível alterar lineup de jogos pendentes" };
  }

  const oldIds = [
    match.pairHome.playerAId,
    match.pairHome.playerBId,
    match.pairAway.playerAId,
    match.pairAway.playerBId,
  ];

  // Swap with other pending matches only (sem rodadas)
  const pendingMatches = await prisma.match.findMany({
    where: { playId, status: "pending" },
    include: { pairHome: true, pairAway: true },
  });

  type Slot = { pairId: string; field: "playerAId" | "playerBId" };
  function findSlot(playerId: string, excludePairIds: Set<string>): Slot | null {
    for (const m of pendingMatches) {
      for (const pair of [m.pairHome, m.pairAway]) {
        if (excludePairIds.has(pair.id)) continue;
        if (pair.playerAId === playerId) {
          return { pairId: pair.id, field: "playerAId" };
        }
        if (pair.playerBId === playerId) {
          return { pairId: pair.id, field: "playerBId" };
        }
      }
    }
    return null;
  }

  const targetPairIds = new Set([match.pairHomeId, match.pairAwayId]);
  const leaving = oldIds.filter((id) => !newIds.includes(id));
  const arriving = newIds.filter((id) => !oldIds.includes(id));

  const swaps: { slot: Slot; playerId: string }[] = [];
  const leavingQueue = [...leaving];

  for (const arriveId of arriving) {
    const slot = findSlot(arriveId, targetPairIds);
    if (slot) {
      const replacement = leavingQueue.shift();
      if (!replacement) {
        return {
          error:
            "Não foi possível realocar — escolha outro jogador ou ajuste outro jogo",
        };
      }
      swaps.push({ slot, playerId: replacement });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const s of swaps) {
      await tx.pair.update({
        where: { id: s.slot.pairId },
        data: { [s.slot.field]: s.playerId },
      });
    }
    await tx.pair.update({
      where: { id: match.pairHomeId },
      data: { playerAId: lineup.homeA, playerBId: lineup.homeB, label: null },
    });
    await tx.pair.update({
      where: { id: match.pairAwayId },
      data: { playerAId: lineup.awayA, playerBId: lineup.awayB, label: null },
    });
  });

  await revalidatePlay(playId);
  return { ok: true };
}

export async function finishPlay(playId: string) {
  await requireAdmin();
  await prisma.play.update({
    where: { id: playId },
    data: { status: "finished" },
  });
  await revalidatePlay(playId);
  return { ok: true };
}

export async function reopenPlay(playId: string) {
  await requireAdmin();
  await prisma.play.update({
    where: { id: playId },
    data: { status: "in_progress" },
  });
  await revalidatePlay(playId);
  return { ok: true };
}

export async function deletePlay(playId: string) {
  await requireAdmin();
  await prisma.play.delete({ where: { id: playId } });
  revalidatePath("/admin");
  revalidatePath("/admin/plays");
  revalidatePath("/");
  redirect("/admin/plays");
}

async function syncFixturesForNewPair(playId: string, newPairId: string) {
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      pairs: { where: activePairWhere },
      matches: true,
    },
  });
  if (!play) return;
  if (play.format === "BALANCED_QUEUE" || play.format === "RANDOM" || play.format === "RANDOM_ROUNDS") return;
  // só sync se já há chaveamento / play em andamento
  if (play.matches.length === 0 && play.status === "open") return;

  const others = play.pairs.filter((p) => p.id !== newPairId);
  if (others.length === 0) return;

  const maxOrder = play.matches.reduce((acc, m) => Math.max(acc, m.orderIndex), -1);
  const maxRound = play.matches.reduce((acc, m) => Math.max(acc, m.round), 0);

  const fixtures = fixturesForNewPair({
    newPairId,
    activeOthers: others,
    existing: play.matches.map((m) => ({
      pairHomeId: m.pairHomeId,
      pairAwayId: m.pairAwayId,
      status: m.status,
      round: m.round,
    })),
    format: play.format,
    playRounds: play.rounds,
    startOrderIndex: maxOrder + 1,
    startRound: maxRound + 1,
  });

  if (!fixtures.length) return;

  // Coloca novos jogos em rodada nova se a atual já está cheia de completed-only context
  // Usa startRound = maxRound (mesma rodada "extra") — ok para mid-join
  await prisma.match.createMany({
    data: fixtures.map((f) => ({
      playId,
      pairHomeId: f.pairHomeId,
      pairAwayId: f.pairAwayId,
      round: f.round,
      orderIndex: f.orderIndex,
    })),
  });

  if (play.status === "open") {
    await prisma.play.update({
      where: { id: playId },
      data: { status: "in_progress" },
    });
  }
}

async function revalidatePlay(playId: string) {
  const play = await prisma.play.findUnique({
    where: { id: playId },
    select: { slug: true },
  });
  const key = play?.slug ?? playId;
  revalidatePath(`/admin/plays/${key}`);
  revalidatePath(`/plays/${key}`);
  revalidatePath("/admin");
  revalidatePath("/admin/plays");
  revalidatePath("/");
}
