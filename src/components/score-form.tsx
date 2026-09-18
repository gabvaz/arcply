"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { recordScore, clearScore } from "@/lib/actions/plays";

function Stepper({
  value,
  onChange,
  disabled,
  emphasize,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center rounded-2xl border px-2 py-2 transition ${
        emphasize ? "border-mint bg-mint-soft" : "border-line bg-white"
      }`}
    >
      <button
        type="button"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl font-medium text-ink-muted transition hover:bg-black/[0.06] hover:text-ink active:scale-95 disabled:opacity-35"
        aria-label="Menos um game"
      >
        −
      </button>
      <span className="mx-3 min-w-[2.5rem] select-none text-center font-display text-4xl font-bold tabular-nums leading-none tracking-tight">
        {value}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl font-medium text-ink transition hover:bg-mint hover:text-white active:scale-95 disabled:opacity-35"
        aria-label="Mais um game"
      >
        +
      </button>
    </div>
  );
}

export function ScoreForm({
  playId,
  matchId,
  initialHome,
  initialAway,
  completed,
  homeLabel,
  awayLabel,
}: {
  playId: string;
  matchId: string;
  initialHome?: number | null;
  initialAway?: number | null;
  completed: boolean;
  homeLabel: string;
  awayLabel: string;
}) {
  const [home, setHome] = useState(initialHome ?? 0);
  const [away, setAway] = useState(initialAway ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await recordScore(playId, matchId, home, away);
      if (res?.error) setError(res.error);
    });
  }

  if (completed) {
    const homeWon = (initialHome ?? 0) > (initialAway ?? 0);
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex items-baseline gap-3">
          <span
            className={`font-display text-3xl font-bold tabular-nums ${
              homeWon ? "text-mint-deep" : "text-ink-muted"
            }`}
          >
            {initialHome}
          </span>
          <span className="text-ink-muted">×</span>
          <span
            className={`font-display text-3xl font-bold tabular-nums ${
              !homeWon ? "text-mint-deep" : "text-ink-muted"
            }`}
          >
            {initialAway}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await clearScore(playId, matchId);
            })
          }
        >
          Editar
        </Button>
      </div>
    );
  }

  const tied = home === away;
  const homeAhead = home > away;

  return (
    <div className="space-y-5 border-t border-line pt-4">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-center sm:gap-8">
        <div className="flex w-full max-w-[220px] flex-col items-center gap-2.5">
          <p className="line-clamp-2 text-center text-sm font-semibold text-ink">
            {homeLabel}
          </p>
          <Stepper
            value={home}
            onChange={setHome}
            disabled={pending}
            emphasize={!tied && homeAhead}
          />
        </div>

        <span className="hidden pb-3 font-display text-sm font-bold uppercase tracking-widest text-ink-muted sm:block">
          vs
        </span>

        <div className="flex w-full max-w-[220px] flex-col items-center gap-2.5">
          <p className="line-clamp-2 text-center text-sm font-semibold text-ink">
            {awayLabel}
          </p>
          <Stepper
            value={away}
            onChange={setAway}
            disabled={pending}
            emphasize={!tied && !homeAhead}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">
          {tied
            ? "Defina um placar sem empate"
            : `Vence: ${homeAhead ? homeLabel : awayLabel}`}
        </p>
        <Button
          type="button"
          disabled={pending || tied}
          variant="accent"
          onClick={submit}
        >
          Confirmar placar
        </Button>
      </div>
      {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}
    </div>
  );
}
