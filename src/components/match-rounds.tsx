"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pairLabel, MATCH_STATUS_LABELS } from "@/lib/labels";
import { Badge, Button } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import { ScoreForm } from "@/components/score-form";
import { MatchCardOverflow } from "@/components/match-card-overflow";
import { startMatch } from "@/lib/actions/plays";

type MatchView = {
  id: string;
  pairHomeId: string;
  pairAwayId: string;
  orderIndex: number;
  round: number;
  status: string;
  gamesHome: number | null;
  gamesAway: number | null;
  pairHome: {
    id: string;
    label: string | null;
    playerAId: string;
    playerBId: string;
    playerA: { name: string };
    playerB: { name: string };
  };
  pairAway: {
    id: string;
    label: string | null;
    playerAId: string;
    playerBId: string;
    playerA: { name: string };
    playerB: { name: string };
  };
};

function statusTone(status: string): "live" | "done" | "warn" | "neutral" {
  if (status === "in_progress") return "live";
  if (status === "completed") return "done";
  if (status === "pending") return "warn";
  return "neutral";
}

function statusLabel(status: string) {
  return (
    MATCH_STATUS_LABELS[status as keyof typeof MATCH_STATUS_LABELS] ?? status
  );
}

function groupByStatus(matches: MatchView[]) {
  const inProgress = matches
    .filter((m) => m.status === "in_progress")
    .sort((a, b) => b.orderIndex - a.orderIndex);
  const pending = matches
    .filter((m) => m.status === "pending")
    .sort((a, b) => b.orderIndex - a.orderIndex);
  const completed = matches
    .filter((m) => m.status === "completed")
    .sort((a, b) => b.orderIndex - a.orderIndex);
  return { inProgress, pending, completed };
}

function StartMatchButton({
  playId,
  matchId,
}: {
  playId: string;
  matchId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="accent"
        disabled={pending}
        aria-busy={pending}
        className="w-full sm:w-auto"
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await startMatch(playId, matchId);
            if (res?.error) setError(res.error);
            else router.refresh();
          });
        }}
      >
        {pending ? (
          <>
            <Spinner />
            Iniciando…
          </>
        ) : (
          "Iniciar jogo"
        )}
      </Button>
      {error ? <p className="text-xs font-medium text-coral">{error}</p> : null}
    </div>
  );
}

function MatchSection({
  title,
  matches,
  allMatches,
  empty,
  playId,
  roster,
  allowLineupEdit,
  admin,
  showFamiliarity = false,
}: {
  title: string;
  matches: MatchView[];
  allMatches: MatchView[];
  empty: string;
  playId: string;
  roster: { id: string; name: string; gender?: "MALE" | "FEMALE" }[];
  allowLineupEdit: boolean;
  admin: boolean;
  showFamiliarity?: boolean;
}) {
  if (!matches.length) {
    return (
      <section className="space-y-2">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
          {empty}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <span className="text-xs font-semibold tabular-nums text-ink-muted">
          {matches.length}
        </span>
      </div>
      <ul className="space-y-3">
        {matches.map((m) => (
          <li key={m.id} className="surface rounded-3xl p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <Badge tone={statusTone(m.status)}>
                {m.status === "in_progress" ? (
                  <>
                    <span className="status-dot" />
                    {statusLabel(m.status)}
                  </>
                ) : (
                  statusLabel(m.status)
                )}
              </Badge>
              {admin ? (
                <MatchCardOverflow
                  playId={playId}
                  match={m}
                  allMatches={allMatches}
                  roster={roster}
                  allowLineupEdit={allowLineupEdit}
                  showFamiliarity={showFamiliarity && m.status !== "completed"}
                  canDelete
                />
              ) : showFamiliarity && m.status !== "completed" ? (
                <MatchCardOverflow
                  playId={playId}
                  match={m}
                  allMatches={allMatches}
                  roster={[]}
                  allowLineupEdit={false}
                  showFamiliarity
                />
              ) : null}
            </div>

            <p className="mb-4 font-display text-lg font-bold leading-snug sm:text-xl">
              {pairLabel(m.pairHome)}
              <span className="mx-2 text-mint">vs</span>
              {pairLabel(m.pairAway)}
            </p>

            {admin && m.status === "pending" && allowLineupEdit ? (
              <StartMatchButton playId={playId} matchId={m.id} />
            ) : null}

            {admin &&
            (m.status === "in_progress" ||
              (m.status === "pending" && !allowLineupEdit)) ? (
              <ScoreForm
                playId={playId}
                matchId={m.id}
                initialHome={m.gamesHome}
                initialAway={m.gamesAway}
                completed={false}
                homeLabel={pairLabel(m.pairHome)}
                awayLabel={pairLabel(m.pairAway)}
              />
            ) : null}

            {m.status === "completed" ? (
              admin ? (
                <ScoreForm
                  playId={playId}
                  matchId={m.id}
                  initialHome={m.gamesHome}
                  initialAway={m.gamesAway}
                  completed
                  homeLabel={pairLabel(m.pairHome)}
                  awayLabel={pairLabel(m.pairAway)}
                />
              ) : (
                <p className="font-display text-2xl tabular-nums tracking-tight">
                  {m.gamesHome}
                  <span className="mx-1 text-ink-muted">×</span>
                  {m.gamesAway}
                </p>
              )
            ) : null}

            {!admin && m.status === "pending" ? (
              <p className="text-sm text-ink-muted">Aguardando início</p>
            ) : null}
            {!admin && m.status === "in_progress" ? (
              <p className="text-sm font-semibold text-mint-deep">Em jogo</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MatchList({
  matches,
  scope = "active",
  layout = "status",
  roster = [],
}: {
  matches: MatchView[];
  scope?: "active" | "completed";
  layout?: "status" | "rounds";
  roster?: { id: string; name: string; gender?: "MALE" | "FEMALE" }[];
}) {
  const groups = useMemo(() => groupByStatus(matches), [matches]);

  if (layout === "rounds") {
    return (
      <RoundGroupedMatches
        allMatches={matches}
        playId=""
        roster={roster}
        admin={false}
        showFamiliarity
        empty={
          scope === "completed"
            ? "Nenhum jogo finalizado"
            : matches.length
              ? "Nenhum jogo"
              : "Nenhum jogo gerado"
        }
      />
    );
  }

  if (scope === "completed") {
    if (!groups.completed.length) {
      return (
        <div className="surface rounded-3xl px-6 py-12 text-center">
          <p className="font-display text-xl">Nenhum jogo finalizado</p>
        </div>
      );
    }
    return (
      <MatchSection
        title="Finalizados"
        matches={groups.completed}
        allMatches={matches}
        empty="Nenhum jogo finalizado"
        playId=""
        roster={[]}
        allowLineupEdit={false}
        admin={false}
      />
    );
  }

  if (!groups.inProgress.length && !groups.pending.length) {
    return (
      <div className="surface rounded-3xl px-6 py-12 text-center">
        <p className="font-display text-xl">
          {matches.length ? "Nenhum jogo ativo" : "Nenhum jogo gerado"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <MatchSection
        title="Em andamento"
        matches={groups.inProgress}
        allMatches={matches}
        empty="Nenhum jogo em andamento"
        playId=""
        roster={[]}
        allowLineupEdit={false}
        admin={false}
        showFamiliarity
      />
      <MatchSection
        title="Pendentes"
        matches={groups.pending}
        allMatches={matches}
        empty="Nenhum jogo pendente"
        playId=""
        roster={[]}
        allowLineupEdit={false}
        admin={false}
        showFamiliarity
      />
    </div>
  );
}

function playersPlayingIds(matches: MatchView[]): Set<string> {
  const ids = new Set<string>();
  for (const m of matches) {
    ids.add(m.pairHome.playerAId);
    ids.add(m.pairHome.playerBId);
    ids.add(m.pairAway.playerAId);
    ids.add(m.pairAway.playerBId);
  }
  return ids;
}

/** Abas por rodada + quem está de fora (derivado do elenco − quem joga). */
function RoundGroupedMatches({
  allMatches,
  playId,
  roster,
  admin,
  showFamiliarity,
  empty,
}: {
  allMatches: MatchView[];
  playId: string;
  roster: { id: string; name: string; gender?: "MALE" | "FEMALE" }[];
  admin: boolean;
  showFamiliarity?: boolean;
  empty: string;
}) {
  const roundNumbers = useMemo(() => {
    const set = new Set(allMatches.map((m) => m.round));
    return [...set].sort((a, b) => a - b);
  }, [allMatches]);

  const [activeRound, setActiveRound] = useState<number | null>(null);
  const selected =
    activeRound != null && roundNumbers.includes(activeRound)
      ? activeRound
      : (roundNumbers[0] ?? null);

  const roundMatches = useMemo(
    () =>
      selected == null
        ? []
        : allMatches
            .filter((m) => m.round === selected)
            .sort((a, b) => a.orderIndex - b.orderIndex),
    [allMatches, selected],
  );

  const sittingOut = useMemo(() => {
    if (!roster.length || selected == null) return [];
    const playing = playersPlayingIds(roundMatches);
    return roster.filter((p) => !playing.has(p.id));
  }, [roster, roundMatches, selected]);

  if (!allMatches.length || selected == null) {
    return (
      <div className="surface rounded-3xl px-6 py-12 text-center">
        <p className="font-display text-xl">{empty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1">
        {roundNumbers.map((n) => {
          const isActive = n === selected;
          const inRound = allMatches.filter((m) => m.round === n);
          const done = inRound.filter((m) => m.status === "completed").length;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setActiveRound(n)}
              className={`shrink-0 rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                isActive
                  ? "bg-night text-white"
                  : "text-ink-muted hover:bg-black/[0.03] hover:text-ink"
              }`}
            >
              Rodada {n}
              <span
                className={`ml-1.5 tabular-nums ${
                  isActive ? "text-white/70" : "text-ink-muted"
                }`}
              >
                {done}/{inRound.length}
              </span>
            </button>
          );
        })}
      </div>

      {sittingOut.length > 0 ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900/70">
            De fora nesta rodada ({sittingOut.length})
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sittingOut.map((p) => (
              <li
                key={p.id}
                className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-ink"
              >
                {p.name}
                {p.gender ? (
                  <span className="ml-1 text-[10px] font-semibold uppercase text-ink-muted">
                    {p.gender === "MALE" ? "M" : "F"}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : roster.length > 0 ? (
        <p className="text-xs font-medium text-mint-deep">
          Ninguém de fora — todos jogam nesta rodada
        </p>
      ) : null}

      <MatchSection
        title="Jogos"
        matches={roundMatches}
        allMatches={allMatches}
        empty="Nenhum jogo nesta rodada"
        playId={playId}
        roster={roster}
        allowLineupEdit={false}
        admin={admin}
        showFamiliarity={showFamiliarity}
      />
    </div>
  );
}

export function AdminMatchRounds({
  playId,
  matches,
  roster = [],
  allowLineupEdit = false,
  emptyHint = "Com ≥2 duplas ativas, gere o chaveamento.",
  scope = "active",
  layout = "status",
}: {
  playId: string;
  matches: MatchView[];
  roster?: { id: string; name: string; gender?: "MALE" | "FEMALE" }[];
  allowLineupEdit?: boolean;
  emptyHint?: string;
  scope?: "active" | "completed";
  layout?: "status" | "rounds";
}) {
  const groups = useMemo(() => groupByStatus(matches), [matches]);

  if (layout === "rounds") {
    if (!matches.length) {
      return (
        <div className="surface rounded-3xl px-6 py-14 text-center">
          <p className="font-display text-xl">Sem jogos ainda</p>
          <p className="mt-2 text-sm text-ink-muted">{emptyHint}</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          Chaveamento pré-agendado. Cada aba é uma rodada; quem não joga aparece
          em “De fora”.
        </p>
        <RoundGroupedMatches
          allMatches={matches}
          playId={playId}
          roster={roster}
          admin
          showFamiliarity
          empty="Nenhum jogo"
        />
      </div>
    );
  }

  if (scope === "completed") {
    if (!groups.completed.length) {
      return (
        <div className="surface rounded-3xl px-6 py-14 text-center">
          <p className="font-display text-xl">Nenhum jogo finalizado</p>
        </div>
      );
    }
    return (
      <MatchSection
        title="Finalizados"
        matches={groups.completed}
        allMatches={matches}
        empty="Nenhum jogo finalizado"
        playId={playId}
        roster={roster}
        allowLineupEdit={allowLineupEdit}
        admin
      />
    );
  }

  if (!matches.length) {
    return (
      <div className="surface rounded-3xl px-6 py-14 text-center">
        <p className="font-display text-xl">Sem jogos ainda</p>
        <p className="mt-2 text-sm text-ink-muted">{emptyHint}</p>
      </div>
    );
  }

  if (!groups.inProgress.length && !groups.pending.length) {
    return (
      <div className="surface rounded-3xl px-6 py-14 text-center">
        <p className="font-display text-xl">Nenhum jogo ativo</p>
        <p className="mt-2 text-sm text-ink-muted">
          Finalizados ficam na aba correspondente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {allowLineupEdit ? (
        <p className="text-sm text-ink-muted">
          Gera um jogo por vez com jogadores livres (sem pendente/em andamento).
          Inicie o jogo antes de lançar o placar. Equaliza nº de jogos e
          variedade de parceiros.
        </p>
      ) : null}

      <MatchSection
        title="Em andamento"
        matches={groups.inProgress}
        allMatches={matches}
        empty="Nenhum jogo em andamento"
        playId={playId}
        roster={roster}
        allowLineupEdit={allowLineupEdit}
        admin
        showFamiliarity={allowLineupEdit}
      />
      <MatchSection
        title="Pendentes"
        matches={groups.pending}
        allMatches={matches}
        empty="Nenhum jogo pendente"
        playId={playId}
        roster={roster}
        allowLineupEdit={allowLineupEdit}
        admin
        showFamiliarity={allowLineupEdit}
      />
    </div>
  );
}
