import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { LinkButton, Badge, Stat } from "@/components/ui";
import { PendingButton, PendingIconButton } from "@/components/pending-button";
import { AddPlayersForm } from "@/components/add-players-form";
import { CreatePairForm } from "@/components/create-pair-form";
import { GenerateRoundButton } from "@/components/generate-round-button";
import {
  RankingTable,
  IndividualRankingTable,
  AdminMatchRounds,
} from "@/components/play-views";
import { ManageTabs, JogosSubTabs } from "@/components/manage-tabs";
import { DeletePlayButton } from "@/components/delete-play-button";
import { ClearRandomRoundsResultsButton } from "@/components/clear-random-rounds-results-button";
import { computeRanking, computeIndividualRanking, mergeIndividualRoster } from "@/lib/ranking";
import {
  FORMAT_LABELS,
  PAIRING_LABELS,
  MIXED_PAIRING_LABELS,
  STATUS_LABELS,
  pairLabel,
} from "@/lib/labels";
import {
  finishPlay,
  addNextBalancedMatch,
  removePlayerFromPlay,
  reopenPlay,
  withdrawPair,
  clearRandomRoundsSchedule,
} from "@/lib/actions/plays";

function statusTone(status: string): "live" | "done" | "neutral" | "warn" {
  if (status === "in_progress") return "live";
  if (status === "finished") return "done";
  if (status === "open") return "warn";
  return "neutral";
}

export default async function ManagePlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const { tab } = await searchParams;

  const include = {
    entries: { include: { player: true }, orderBy: { player: { name: "asc" as const } } },
    pairs: {
      include: { playerA: true, playerB: true },
      orderBy: { createdAt: "asc" as const },
    },
    matches: {
      include: {
        pairHome: { include: { playerA: true, playerB: true } },
        pairAway: { include: { playerA: true, playerB: true } },
      },
      orderBy: [{ round: "asc" as const }, { orderIndex: "asc" as const }],
    },
  };

  let play = await prisma.play.findUnique({ where: { slug }, include });
  if (!play) {
    const byId = await prisma.play.findUnique({ where: { id: slug }, include });
    if (byId) redirect(`/admin/plays/${byId.slug}`);
    notFound();
  }

  const isLiveRandom = play.format === "RANDOM";
  const isRandomRounds = play.format === "RANDOM_ROUNDS";
  const isIndividual = isLiveRandom || isRandomRounds;
  const activePairs = play.pairs.filter((p) => p.withdrawnAt == null);
  const withdrawnPairs = play.pairs.filter((p) => p.withdrawnAt != null);

  const allPlayers = await prisma.player.findMany({ orderBy: { name: "asc" } });
  const entryIds = new Set(play.entries.map((e) => e.playerId));
  const activePairedIds = new Set(
    activePairs.flatMap((p) => [p.playerAId, p.playerBId]),
  );
  const available = allPlayers.filter((p) => !entryIds.has(p.id));
  const unpaired = play.entries
    .filter((e) => !activePairedIds.has(e.playerId))
    .map((e) => e.player);

  const pairRanking = computeRanking(play.pairs, play.matches);
  const individualRoster = mergeIndividualRoster(
    play.entries.map((e) => e.player),
    play.pairs.flatMap((p) => [p.playerA, p.playerB]),
  );
  const individualRanking = computeIndividualRanking(
    individualRoster,
    play.pairs,
    play.matches,
  );
  const rankingCount = isIndividual ? individualRanking.length : pairRanking.length;
  const doneMatches = play.matches.filter((m) => m.status === "completed").length;

  const pendingPlayerIds = new Set(
    play.matches
      .filter((m) => m.status === "pending" || m.status === "in_progress")
      .flatMap((m) => [
        m.pairHome.playerAId,
        m.pairHome.playerBId,
        m.pairAway.playerAId,
        m.pairAway.playerBId,
      ]),
  );
  const freePlayers = isLiveRandom
    ? play.entries.filter((e) => !pendingPlayerIds.has(e.playerId)).length
    : 0;

  const participantes = (
    <div className="space-y-8">
      <div className="surface rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-xl">Jogadores</h3>
          <span className="text-xs font-semibold text-ink-muted">
            {play.entries.length}
            {isRandomRounds && play.plannedPlayerCount
              ? ` / ${play.plannedPlayerCount} planejados`
              : " no play"}
          </span>
        </div>
        <p className="mb-4 text-sm text-ink-muted">
          {isLiveRandom
            ? "Pode adicionar ou tirar gente com o play em andamento. Removidos saem do sorteio mas ficam no ranking (e podem voltar). Novos entram no próximo jogo gerado."
            : isRandomRounds
              ? play.matches.length
                ? "Chaveamento já gerado — para mudar o elenco, regenere as rodadas (só se todos os jogos ainda estiverem pendentes)."
                : `Adicione ${play.plannedPlayerCount ?? "≥4"} jogadores e gere as ${play.rounds} rodadas.`
              : "Pode adicionar gente no meio do play. Remover dupla libera os jogadores para nova combinação."}
        </p>
        <ul className="mb-5 flex flex-wrap gap-2">
          {play.entries.map((e) => {
            const busy = isLiveRandom
              ? pendingPlayerIds.has(e.playerId)
              : isRandomRounds
                ? play.matches.length > 0
                : activePairedIds.has(e.playerId);
            return (
              <li
                key={e.id}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pl-3 pr-1.5 text-sm font-medium"
              >
                <Link
                  href={`/plays/${play.slug}/players/${e.playerId}`}
                  className="hover:text-mint-deep hover:underline"
                >
                  {e.player.name}
                </Link>
                <span className="text-[10px] font-semibold uppercase text-ink-muted">
                  {e.player.gender === "MALE" ? "M" : "F"}
                </span>
                {busy ? (
                  <span className="pr-1.5 text-[10px] font-semibold uppercase text-mint-deep">
                    {isLiveRandom ? "jogo" : isRandomRounds ? "ok" : "dupla"}
                  </span>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await removePlayerFromPlay(play.id, e.playerId);
                    }}
                  >
                    <PendingIconButton
                      className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted transition hover:bg-coral/10 hover:text-coral"
                      title="Remover do play"
                    >
                      ×
                    </PendingIconButton>
                  </form>
                )}
              </li>
            );
          })}
          {!play.entries.length ? (
            <li className="text-sm text-ink-muted">Nenhum jogador ainda</li>
          ) : null}
        </ul>
        <AddPlayersForm
          playId={play.id}
          available={available}
          maxSlots={isRandomRounds ? play.plannedPlayerCount : null}
          currentCount={play.entries.length}
        />
      </div>

      {!isIndividual ? (
        <>
          <div className="surface rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <h3 className="font-display text-xl">Duplas ativas</h3>
              <span className="text-xs font-semibold text-ink-muted">
                {activePairs.length} ativas
              </span>
            </div>
            <ul className="mb-5 space-y-2">
              {activePairs.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint-soft text-xs font-bold text-mint-deep">
                      {i + 1}
                    </span>
                    <span className="font-semibold">{pairLabel(p)}</span>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await withdrawPair(play.id, p.id);
                    }}
                  >
                    <PendingButton
                      type="submit"
                      variant="ghost"
                      className="!py-1.5"
                      pendingLabel="Removendo…"
                    >
                      Remover
                    </PendingButton>
                  </form>
                </li>
              ))}
              {!activePairs.length ? (
                <li className="text-sm text-ink-muted">Nenhuma dupla ativa</li>
              ) : null}
            </ul>
            <CreatePairForm playId={play.id} unpaired={unpaired} />
            <p className="mt-3 text-xs text-ink-muted">
              Em RR/MULTI, nova dupla gera jogos pendentes contra as ativas. Em fila
              balanceada, use “+ Próximo jogo”.
            </p>
          </div>

          {withdrawnPairs.length > 0 ? (
            <div className="surface rounded-3xl p-5 sm:p-6 opacity-80">
              <h3 className="mb-3 font-display text-lg">Duplas que saíram</h3>
              <p className="mb-3 text-xs text-ink-muted">
                Mantidas no ranking com os jogos já finalizados.
              </p>
              <ul className="space-y-2">
                {withdrawnPairs.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-2xl border border-dashed border-line px-4 py-2.5 text-sm text-ink-muted"
                  >
                    {pairLabel(p)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );

  const activeMatches = play.matches.filter((m) => m.status !== "completed");
  const canGenerateRounds =
    isRandomRounds &&
    play.matches.length === 0 &&
    play.entries.length >= 4 &&
    (play.plannedPlayerCount == null ||
      play.entries.length === play.plannedPlayerCount);
  const canRegenerateRounds =
    isRandomRounds &&
    play.matches.length > 0 &&
    play.matches.every((m) => m.status === "pending");
  const canClearResults =
    isRandomRounds &&
    play.matches.some(
      (m) => m.status !== "pending" || m.gamesHome != null || m.gamesAway != null,
    );

  const jogos = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {FORMAT_LABELS[play.format]}
          {play.format === "ROUND_ROBIN_MULTI" || isRandomRounds
            ? ` (${play.rounds}×)`
            : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {play.matches.length === 0 ? (
            <GenerateRoundButton
              playId={play.id}
              mode="first"
              shuffle={isLiveRandom || isRandomRounds}
              disabled={isRandomRounds && !canGenerateRounds}
              label={
                isLiveRandom
                  ? "Gerar 1º jogo"
                  : isRandomRounds
                    ? `Gerar ${play.rounds} rodadas`
                    : "Gerar jogos"
              }
              pendingLabel="Gerando…"
            />
          ) : null}
          {canRegenerateRounds ? (
            <form
              action={async () => {
                "use server";
                await clearRandomRoundsSchedule(play.id);
              }}
            >
              <PendingButton type="submit" variant="danger" pendingLabel="Limpando…">
                Limpar chaveamento
              </PendingButton>
            </form>
          ) : null}
          {canClearResults ? (
            <ClearRandomRoundsResultsButton playId={play.id} />
          ) : null}
          {play.format === "BALANCED_QUEUE" ? (
            <form
              action={async () => {
                "use server";
                await addNextBalancedMatch(play.id);
              }}
            >
              <PendingButton type="submit" variant="secondary" pendingLabel="Adicionando…">
                + Próximo jogo
              </PendingButton>
            </form>
          ) : null}
          {isLiveRandom && play.matches.length > 0 ? (
            <GenerateRoundButton
              playId={play.id}
              mode="next"
              shuffle
              label="Gerar próximo jogo"
              pendingLabel="Sorteando…"
            />
          ) : null}
        </div>
      </div>

      {isRandomRounds && play.matches.length === 0 && !canGenerateRounds ? (
        <p className="text-sm text-amber-800">
          {play.entries.length < 4
            ? "Adicione pelo menos 4 jogadores."
            : `Elenco: ${play.entries.length}/${play.plannedPlayerCount ?? "?"} — precisa bater a quantidade planejada.`}
        </p>
      ) : null}

      {isRandomRounds ? (
        <AdminMatchRounds
          playId={play.id}
          matches={play.matches}
          layout="rounds"
          roster={play.entries.map((e) => e.player)}
          emptyHint={`Com ${play.plannedPlayerCount ?? "≥4"} jogadores, gere as ${play.rounds} rodadas.`}
        />
      ) : (
        <JogosSubTabs
          counts={{ ativos: activeMatches.length, finalizados: doneMatches }}
          ativos={
            <AdminMatchRounds
              playId={play.id}
              matches={play.matches}
              scope="active"
              allowLineupEdit={isLiveRandom}
              roster={play.entries.map((e) => e.player)}
              emptyHint={
                isLiveRandom
                  ? "Com ≥4 jogadores livres, gere o próximo jogo."
                  : "Com ≥2 duplas ativas, gere o chaveamento."
              }
            />
          }
          finalizados={
            <AdminMatchRounds
              playId={play.id}
              matches={play.matches}
              scope="completed"
              allowLineupEdit={false}
              roster={play.entries.map((e) => e.player)}
            />
          }
        />
      )}
    </div>
  );

  const rankingPanel = (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        {isIndividual
          ? "Ranking individual. Ordenação: vitórias → saldo de games → games ganhos."
          : "Ativas primeiro. Duplas que saíram ficam marcadas e mantêm o histórico."}
      </p>
      {isIndividual ? (
        <IndividualRankingTable rows={individualRanking} playId={play.slug} />
      ) : (
        <RankingTable rows={pairRanking} />
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="animate-rise space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(play.status)}>
                {play.status === "in_progress" ? (
                  <span className="status-dot" />
                ) : null}
                {STATUS_LABELS[play.status]}
              </Badge>
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {play.name}
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              {FORMAT_LABELS[play.format]}
              {play.format === "ROUND_ROBIN_MULTI" || isRandomRounds
                ? ` · ${play.rounds} rodadas`
                : ""}
              {!isIndividual
                ? ` · ${PAIRING_LABELS[play.pairingMode]}`
                : ` · ${MIXED_PAIRING_LABELS[play.mixedPairing]}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/plays/${play.slug}`} variant="secondary">
              Página pública
            </LinkButton>
            {play.status !== "finished" ? (
              <form
                action={async () => {
                  "use server";
                  await finishPlay(play.id);
                }}
              >
                <PendingButton type="submit" variant="secondary" pendingLabel="Finalizando…">
                  Finalizar
                </PendingButton>
              </form>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await reopenPlay(play.id);
                }}
              >
                <PendingButton type="submit" variant="secondary" pendingLabel="Reabrindo…">
                  Reabrir
                </PendingButton>
              </form>
            )}
            <DeletePlayButton playId={play.id} playName={play.name} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Jogadores" value={play.entries.length} />
          <Stat
            label={isLiveRandom ? "Livres" : isRandomRounds ? "Rodadas" : "Duplas ativas"}
            value={
              isLiveRandom
                ? freePlayers
                : isRandomRounds
                  ? play.rounds
                  : activePairs.length
            }
          />
          <Stat label="Jogos" value={play.matches.length} />
          <Stat label="Finalizados" value={doneMatches} />
        </div>
      </div>

      <ManageTabs
        initialTab={tab}
        counts={{
          participantes: isIndividual
            ? play.entries.length
            : play.entries.length + activePairs.length,
          jogos: play.matches.length,
          ranking: rankingCount,
        }}
        participantes={participantes}
        jogos={jogos}
        ranking={rankingPanel}
      />
    </div>
  );
}
