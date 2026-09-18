"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { pairLabel } from "@/lib/labels";
import { Badge } from "@/components/ui";
import { groupMatchesIntoRounds } from "@/lib/schedule";
import { ScoreForm } from "@/components/score-form";
import { RandomMatchLineupEditor } from "@/components/random-match-lineup";

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

function pickDefaultRound(
  rounds: { round: number; complete: boolean }[],
): number {
  const incomplete = [...rounds].reverse().find((r) => !r.complete);
  if (incomplete) return incomplete.round;
  return rounds[rounds.length - 1]?.round ?? 1;
}

function useActiveRound(meta: { round: number; complete: boolean }[]) {
  const [active, setActive] = useState(() => pickDefaultRound(meta));
  const maxRound = meta[meta.length - 1]?.round ?? 1;
  const prevMax = useRef(maxRound);

  useEffect(() => {
    if (maxRound > prevMax.current) {
      setActive(pickDefaultRound(meta));
    } else if (!meta.some((r) => r.round === active)) {
      setActive(pickDefaultRound(meta));
    }
    prevMax.current = maxRound;
  }, [maxRound, meta, active]);

  const currentRound = meta.some((r) => r.round === active)
    ? active
    : pickDefaultRound(meta);

  return [currentRound, setActive] as const;
}

function RoundPicker({
  rounds,
  active,
  onSelect,
}: {
  rounds: { round: number; complete: boolean; done: number; total: number }[];
  active: number;
  onSelect: (round: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Rodadas
        </p>
        <p className="text-xs text-ink-muted">
          {rounds.length} no total
        </p>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1">
        {rounds.map((r) => {
          const isOn = r.round === active;
          return (
            <button
              key={r.round}
              type="button"
              onClick={() => onSelect(r.round)}
              className={`flex shrink-0 flex-col items-start rounded-2xl border px-3.5 py-2.5 text-left transition ${
                isOn
                  ? "border-night bg-night text-white"
                  : r.complete
                    ? "border-line bg-white text-ink hover:border-mint/40"
                    : "border-mint/30 bg-mint-soft/50 text-ink hover:border-mint"
              }`}
            >
              <span className="text-sm font-bold tabular-nums">R{r.round}</span>
              <span
                className={`mt-0.5 text-[10px] font-semibold tabular-nums ${
                  isOn ? "text-white/70" : "text-ink-muted"
                }`}
              >
                {r.done}/{r.total}
                {r.complete ? " · ok" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MatchList({ matches }: { matches: MatchView[] }) {
  const rounds = useMemo(() => groupMatchesIntoRounds(matches), [matches]);
  const meta = useMemo(
    () =>
      rounds.map((r) => ({
        round: r.round,
        complete: r.complete,
        done: r.items.filter((m) => m.status === "completed").length,
        total: r.items.length,
        items: r.items,
      })),
    [rounds],
  );

  const [activeRound, setActive] = useActiveRound(meta);
  const current = meta.find((r) => r.round === activeRound) ?? meta[meta.length - 1];

  if (!matches.length) {
    return (
      <div className="surface rounded-3xl px-6 py-12 text-center">
        <p className="font-display text-xl">Nenhum jogo gerado</p>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="space-y-5">
      <RoundPicker rounds={meta} active={current.round} onSelect={setActive} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl font-bold">Rodada {current.round}</h3>
            <Badge tone={current.complete ? "done" : "live"}>
              {current.complete ? (
                "Completa"
              ) : (
                <>
                  <span className="status-dot" />
                  Em andamento
                </>
              )}
            </Badge>
          </div>
          <span className="text-xs font-semibold text-ink-muted">
            {current.done}/{current.total} jogos
          </span>
        </div>

        <ul className="space-y-2">
          {current.items.map((m) => (
            <li
              key={m.id}
              className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5"
            >
              <div className="min-w-0">
                <Badge tone={m.status === "completed" ? "done" : "live"}>
                  {m.status === "completed" ? "OK" : "Aguardando"}
                </Badge>
                <p className="mt-1.5 font-semibold">
                  {pairLabel(m.pairHome)}{" "}
                  <span className="text-mint">vs</span> {pairLabel(m.pairAway)}
                </p>
              </div>
              <div className="text-right">
                {m.status === "completed" ? (
                  <p className="font-display text-2xl tabular-nums tracking-tight">
                    {m.gamesHome}
                    <span className="mx-1 text-ink-muted">×</span>
                    {m.gamesAway}
                  </p>
                ) : (
                  <span className="text-sm text-ink-muted">—</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AdminMatchRounds({
  playId,
  matches,
  roster = [],
  allowLineupEdit = false,
  emptyHint = "Com ≥2 duplas ativas, gere o chaveamento.",
}: {
  playId: string;
  matches: MatchView[];
  roster?: { id: string; name: string; gender?: "MALE" | "FEMALE" }[];
  allowLineupEdit?: boolean;
  emptyHint?: string;
}) {
  const rounds = useMemo(() => groupMatchesIntoRounds(matches), [matches]);
  const meta = useMemo(
    () =>
      rounds.map((r) => ({
        round: r.round,
        complete: r.complete,
        done: r.items.filter((m) => m.status === "completed").length,
        total: r.items.length,
        items: r.items,
      })),
    [rounds],
  );

  const [activeRound, setActive] = useActiveRound(meta);
  const current = meta.find((r) => r.round === activeRound) ?? meta[meta.length - 1];

  if (!matches.length) {
    return (
      <div className="surface rounded-3xl px-6 py-14 text-center">
        <p className="font-display text-xl">Sem jogos ainda</p>
        <p className="mt-2 text-sm text-ink-muted">{emptyHint}</p>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-muted">
        {allowLineupEdit
          ? "Pode gerar a próxima rodada sem finalizar a atual. Use “Alterar jogadores” pra ajustar o lineup."
          : "Em cada rodada, cada dupla joga no máximo uma vez. Navegue pelas rodadas abaixo."}
      </p>

      <RoundPicker rounds={meta} active={current.round} onSelect={setActive} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl font-bold">Rodada {current.round}</h3>
            <Badge tone={current.complete ? "done" : "live"}>
              {current.complete ? (
                "Completa"
              ) : (
                <>
                  <span className="status-dot" />
                  Em andamento
                </>
              )}
            </Badge>
          </div>
          <span className="text-xs font-semibold text-ink-muted">
            {current.done}/{current.total} jogos
          </span>
        </div>

        <ul className="space-y-3">
          {current.items.map((m) => (
            <li key={m.id} className="surface rounded-3xl p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Badge tone={m.status === "completed" ? "done" : "live"}>
                  {m.status === "completed" ? "Finalizado" : "Pendente"}
                </Badge>
              </div>
              {allowLineupEdit ? (
                <RandomMatchLineupEditor
                  playId={playId}
                  matchId={m.id}
                  roster={roster}
                  completed={m.status === "completed"}
                  initial={{
                    homeA: m.pairHome.playerAId,
                    homeB: m.pairHome.playerBId,
                    awayA: m.pairAway.playerAId,
                    awayB: m.pairAway.playerBId,
                  }}
                />
              ) : null}
              <p className="mb-3 font-display text-lg font-bold leading-snug">
                {pairLabel(m.pairHome)}
                <span className="mx-2 text-mint">vs</span>
                {pairLabel(m.pairAway)}
              </p>
              <ScoreForm
                playId={playId}
                matchId={m.id}
                initialHome={m.gamesHome}
                initialAway={m.gamesAway}
                completed={m.status === "completed"}
                homeLabel={pairLabel(m.pairHome)}
                awayLabel={pairLabel(m.pairAway)}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
