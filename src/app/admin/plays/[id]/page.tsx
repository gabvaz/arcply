import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Button, LinkButton, Badge, Stat } from "@/components/ui";
import { AddPlayersForm } from "@/components/add-players-form";
import { CreatePairForm } from "@/components/create-pair-form";
import { RankingTable, AdminMatchRounds } from "@/components/play-views";
import { ManageTabs } from "@/components/manage-tabs";
import { DeletePlayButton } from "@/components/delete-play-button";
import { computeRanking } from "@/lib/ranking";
import {
  FORMAT_LABELS,
  PAIRING_LABELS,
  STATUS_LABELS,
  pairLabel,
} from "@/lib/labels";
import {
  addNextBalancedMatch,
  clearMatches,
  finishPlay,
  generateMatches,
  removePlayerFromPlay,
  reopenPlay,
  withdrawPair,
} from "@/lib/actions/plays";

function statusTone(status: string): "live" | "done" | "neutral" | "warn" {
  if (status === "in_progress") return "live";
  if (status === "finished") return "done";
  if (status === "open") return "warn";
  return "neutral";
}

export default async function ManagePlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const play = await prisma.play.findUnique({
    where: { id },
    include: {
      entries: { include: { player: true }, orderBy: { player: { name: "asc" } } },
      pairs: {
        include: { playerA: true, playerB: true },
        orderBy: { createdAt: "asc" },
      },
      matches: {
        include: {
          pairHome: { include: { playerA: true, playerB: true } },
          pairAway: { include: { playerA: true, playerB: true } },
        },
        orderBy: [{ round: "asc" }, { orderIndex: "asc" }],
      },
    },
  });
  if (!play) notFound();

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

  const ranking = computeRanking(play.pairs, play.matches);
  const doneMatches = play.matches.filter((m) => m.status === "completed").length;

  const elenco = (
    <div className="space-y-8">
      <div className="surface rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-xl">Jogadores</h3>
          <span className="text-xs font-semibold text-ink-muted">
            {play.entries.length} no play
          </span>
        </div>
        <p className="mb-4 text-sm text-ink-muted">
          Pode adicionar gente no meio do play. Remover dupla libera os jogadores
          para nova combinação.
        </p>
        <ul className="mb-5 flex flex-wrap gap-2">
          {play.entries.map((e) => {
            const busy = activePairedIds.has(e.playerId);
            return (
              <li
                key={e.id}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pl-3 pr-1.5 text-sm font-medium"
              >
                {e.player.name}
                {busy ? (
                  <span className="pr-1.5 text-[10px] font-semibold uppercase text-mint-deep">
                    dupla
                  </span>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await removePlayerFromPlay(play.id, e.playerId);
                    }}
                  >
                    <button
                      type="submit"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted transition hover:bg-coral/10 hover:text-coral"
                      title="Remover do play"
                    >
                      ×
                    </button>
                  </form>
                )}
              </li>
            );
          })}
          {!play.entries.length ? (
            <li className="text-sm text-ink-muted">Nenhum jogador ainda</li>
          ) : null}
        </ul>
        <AddPlayersForm playId={play.id} available={available} />
      </div>

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
                <Button type="submit" variant="ghost" className="!py-1.5">
                  Remover
                </Button>
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
    </div>
  );

  const jogos = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {doneMatches}/{play.matches.length} finalizados · {FORMAT_LABELS[play.format]}
          {play.format === "ROUND_ROBIN_MULTI" ? ` (${play.rounds}×)` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {play.matches.length === 0 ? (
            <form
              action={async () => {
                "use server";
                await generateMatches(play.id);
              }}
            >
              <Button type="submit" variant="accent">
                Gerar jogos
              </Button>
            </form>
          ) : (
            <form
              action={async () => {
                "use server";
                await clearMatches(play.id);
              }}
            >
              <Button type="submit" variant="danger">
                Limpar jogos
              </Button>
            </form>
          )}
          {play.format === "BALANCED_QUEUE" ? (
            <form
              action={async () => {
                "use server";
                await addNextBalancedMatch(play.id);
              }}
            >
              <Button type="submit" variant="secondary">
                + Próximo jogo
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <AdminMatchRounds playId={play.id} matches={play.matches} />
    </div>
  );

  const rankingPanel = (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Ativas primeiro. Duplas que saíram ficam marcadas e mantêm o histórico.
      </p>
      <RankingTable rows={ranking} />
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
              {play.format === "ROUND_ROBIN_MULTI" ? ` · ${play.rounds} séries` : ""}{" "}
              · {PAIRING_LABELS[play.pairingMode]}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/plays/${play.id}`} variant="secondary">
              Página pública
            </LinkButton>
            {play.status !== "finished" ? (
              <form
                action={async () => {
                  "use server";
                  await finishPlay(play.id);
                }}
              >
                <Button type="submit" variant="secondary">
                  Finalizar
                </Button>
              </form>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await reopenPlay(play.id);
                }}
              >
                <Button type="submit" variant="secondary">
                  Reabrir
                </Button>
              </form>
            )}
            <DeletePlayButton playId={play.id} playName={play.name} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Jogadores" value={play.entries.length} />
          <Stat label="Duplas ativas" value={activePairs.length} />
          <Stat label="Jogos" value={play.matches.length} />
          <Stat label="Finalizados" value={doneMatches} />
        </div>
      </div>

      <Suspense fallback={<div className="surface h-12 animate-pulse rounded-2xl" />}>
        <ManageTabs
          counts={{
            elenco: play.entries.length + activePairs.length,
            jogos: play.matches.length,
            ranking: ranking.length,
          }}
          elenco={elenco}
          jogos={jogos}
          ranking={rankingPanel}
        />
      </Suspense>
    </div>
  );
}
