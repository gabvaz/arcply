"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  buildPlayerHistory,
  fixturesForNewPair,
  generateBalancedPool,
  generateRandomRound,
  generateRoundRobin,
  groupMatchesIntoRounds,
  nextAvailableRound,
  nextBalancedMatch,
} from "@/lib/schedule";
import { validateScore } from "@/lib/ranking";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { PlayFormat, PairingMode, MixedPairingPolicy, Prisma } from "@prisma/client";

const playSchema = z.object({
  name: z.string().trim().min(1),
  format: z.enum([
    "ROUND_ROBIN",
    "ROUND_ROBIN_MULTI",
    "BALANCED_QUEUE",
    "RANDOM",
  ]),
  rounds: z.coerce.number().int().min(1).max(20).default(1),
  pairingMode: z.enum(["PLAYER_CHOICE", "ADMIN_ASSIGN"]).default("ADMIN_ASSIGN"),
  mixedPairing: z.enum(["IGNORE", "PREFERRED", "REQUIRED"]).default("IGNORE"),
});

const activePairWhere: Prisma.PairWhereInput = { withdrawnAt: null };

export async function createPlay(formData: FormData) {
  await requireAdmin();
  const parsed = playSchema.safeParse({
    name: formData.get("name"),
    format: formData.get("format"),
    rounds: formData.get("rounds") || 1,
    pairingMode: formData.get("pairingMode") || "ADMIN_ASSIGN",
    mixedPairing: formData.get("mixedPairing") || "IGNORE",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const play = await prisma.play.create({
    data: {
      name: parsed.data.name,
      gamesToWin: 0,
      format: parsed.data.format as PlayFormat,
      rounds:
        parsed.data.format === "ROUND_ROBIN_MULTI" ? parsed.data.rounds : 1,
      pairingMode:
        parsed.data.format === "RANDOM"
          ? "ADMIN_ASSIGN"
          : (parsed.data.pairingMode as PairingMode),
      mixedPairing:
        parsed.data.format === "RANDOM"
          ? (parsed.data.mixedPairing as MixedPairingPolicy)
          : "IGNORE",
      status: "open",
    },
  });

  redirect(`/admin/plays/${play.id}`);
}

export async function addPlayersToPlay(playId: string, playerIds: string[]) {
  await requireAdmin();
  if (!playerIds.length) return { error: "Selecione jogadores" };

  for (const playerId of playerIds) {
    await prisma.playEntry.upsert({
      where: { playId_playerId: { playId, playerId } },
      create: { playId, playerId },
      update: {},
    });
  }

  revalidatePlay(playId);
  return { ok: true };
}

export async function removePlayerFromPlay(playId: string, playerId: string) {
  await requireAdmin();

  const play = await prisma.play.findUnique({ where: { id: playId } });
  if (!play) return { error: "Play não encontrado" };

  if (play.format === "RANDOM") {
    const inPending = await prisma.match.findFirst({
      where: {
        playId,
        status: "pending",
        OR: [
          { pairHome: { OR: [{ playerAId: playerId }, { playerBId: playerId }] } },
          { pairAway: { OR: [{ playerAId: playerId }, { playerBId: playerId }] } },
        ],
      },
    });
    if (inPending) {
      return {
        error: "Jogador está em um jogo pendente — limpe ou finalize antes",
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
  revalidatePlay(playId);
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
  if (play.format === "RANDOM") {
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

  revalidatePlay(playId);
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

  revalidatePlay(playId);
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
    return persistRandomRound(
      playId,
      play.entries.map((e) => e.playerId),
      1,
      true,
    );
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

  revalidatePlay(playId);
  return { ok: true, count: fixtures.length };
}

export async function generateNextRandomRound(playId: string) {
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
        orderBy: [{ round: "asc" }, { orderIndex: "asc" }],
      },
    },
  });
  if (!play) return { error: "Play não encontrado" };
  if (play.format !== "RANDOM") {
    return { error: "Só disponível no formato aleatório" };
  }
  if (play.matches.length === 0) {
    return { error: "Gere a primeira rodada antes" };
  }

  const rounds = groupMatchesIntoRounds(play.matches);
  const last = rounds[rounds.length - 1];
  const nextRound = (last?.round ?? 0) + 1;
  return persistRandomRound(
    playId,
    play.entries.map((e) => e.playerId),
    nextRound,
    false,
  );
}

async function persistRandomRound(
  playId: string,
  playerIds: string[],
  roundNum: number,
  setInProgress: boolean,
) {
  if (playerIds.length < 4) {
    return { error: "Precisa de pelo menos 4 jogadores" };
  }

  const play = await prisma.play.findUnique({
    where: { id: playId },
    select: { mixedPairing: true },
  });
  if (!play) return { error: "Play não encontrado" };

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, gender: true },
  });
  const genderByPlayer = new Map(
    players.map((p) => [p.id, p.gender as "MALE" | "FEMALE"]),
  );

  const allMatches = await prisma.match.findMany({
    where: { playId },
    include: { pairHome: true, pairAway: true },
  });

  const history = buildPlayerHistory(playerIds, allMatches);

  // BYEs: quem não entrou em cada rodada já gerada (completa ou não)
  const byRound = new Map<number, Set<string>>();
  for (const m of allMatches) {
    const set = byRound.get(m.round) ?? new Set();
    set.add(m.pairHome.playerAId);
    set.add(m.pairHome.playerBId);
    set.add(m.pairAway.playerAId);
    set.add(m.pairAway.playerBId);
    byRound.set(m.round, set);
  }
  for (const [, inRound] of byRound) {
    for (const id of playerIds) {
      if (!inRound.has(id)) {
        history.byes.set(id, (history.byes.get(id) ?? 0) + 1);
      }
    }
  }

  const result = generateRandomRound(playerIds, history, {
    genderByPlayer,
    mixedPairing: play.mixedPairing,
  });
  if (result.error) return { error: result.error };
  if (!result.courts.length) {
    return { error: "Não foi possível gerar a rodada" };
  }

  const maxOrder = await prisma.match
    .aggregate({ where: { playId }, _max: { orderIndex: true } })
    .then((r) => r._max.orderIndex ?? -1);

  let orderIndex = maxOrder + 1;
  const created = await prisma.$transaction(async (tx) => {
    const matchIds: string[] = [];
    for (const court of result.courts) {
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
      const match = await tx.match.create({
        data: {
          playId,
          pairHomeId: home.id,
          pairAwayId: away.id,
          round: roundNum,
          orderIndex: orderIndex++,
        },
      });
      matchIds.push(match.id);
    }
    if (setInProgress) {
      await tx.play.update({
        where: { id: playId },
        data: { status: "in_progress" },
      });
    }
    return matchIds;
  });

  revalidatePlay(playId);
  return { ok: true, count: created.length, round: roundNum };
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

  revalidatePlay(playId);
  return { ok: true };
}

export async function clearMatches(playId: string) {
  await requireAdmin();
  const play = await prisma.play.findUnique({ where: { id: playId } });
  if (!play) return { error: "Play não encontrado" };

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { playId } });
    if (play.format === "RANDOM") {
      await tx.pair.deleteMany({ where: { playId } });
    }
    await tx.play.update({
      where: { id: playId },
      data: { status: "open" },
    });
  });

  revalidatePlay(playId);
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

  revalidatePlay(playId);
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
  revalidatePlay(playId);
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

  const oldIds = [
    match.pairHome.playerAId,
    match.pairHome.playerBId,
    match.pairAway.playerAId,
    match.pairAway.playerBId,
  ];

  const roundMatches = await prisma.match.findMany({
    where: { playId, round: match.round },
    include: { pairHome: true, pairAway: true },
  });

  type Slot = { pairId: string; field: "playerAId" | "playerBId" };
  function findSlot(playerId: string, excludePairIds: Set<string>): Slot | null {
    for (const m of roundMatches) {
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

  // Pair each arriving (from another court / bye) with a leaving player for swap
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
    // else: arriving was on bye — leaving becomes bye, nothing to write
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
    if (match.status === "completed") {
      await tx.match.update({
        where: { id: matchId },
        data: {
          gamesHome: null,
          gamesAway: null,
          scoreOverride: false,
          status: "pending",
        },
      });
    }
  });

  revalidatePlay(playId);
  return { ok: true };
}

export async function finishPlay(playId: string) {
  await requireAdmin();
  await prisma.play.update({
    where: { id: playId },
    data: { status: "finished" },
  });
  revalidatePlay(playId);
  return { ok: true };
}

export async function reopenPlay(playId: string) {
  await requireAdmin();
  await prisma.play.update({
    where: { id: playId },
    data: { status: "in_progress" },
  });
  revalidatePlay(playId);
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
  if (play.format === "BALANCED_QUEUE" || play.format === "RANDOM") return;
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

function revalidatePlay(playId: string) {
  revalidatePath(`/admin/plays/${playId}`);
  revalidatePath(`/plays/${playId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/plays");
}
