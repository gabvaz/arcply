"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Select } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import { updateRandomMatchLineup } from "@/lib/actions/plays";

type RosterPlayer = { id: string; name: string; gender?: "MALE" | "FEMALE" };

const SLOTS = [
  { key: "homeA" as const, side: "Dupla A", pos: "Jogador 1" },
  { key: "homeB" as const, side: "Dupla A", pos: "Jogador 2" },
  { key: "awayA" as const, side: "Dupla B", pos: "Jogador 1" },
  { key: "awayB" as const, side: "Dupla B", pos: "Jogador 2" },
];

export function RandomMatchLineupEditor({
  playId,
  matchId,
  roster,
  initial,
  completed,
  embedded = false,
  onSaved,
}: {
  playId: string;
  matchId: string;
  roster: RosterPlayer[];
  initial: {
    homeA: string;
    homeB: string;
    awayA: string;
    awayB: string;
  };
  completed: boolean;
  /** Sem botão próprio — usado dentro do menu do card. */
  embedded?: boolean;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(embedded);
  const [lineup, setLineup] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const dirty =
    lineup.homeA !== initial.homeA ||
    lineup.homeB !== initial.homeB ||
    lineup.awayA !== initial.awayA ||
    lineup.awayB !== initial.awayB;

  const editor = (
    <div className={embedded ? "space-y-3" : "space-y-3 rounded-2xl border border-line bg-black/[0.02] p-3"}>
      {completed ? (
        <p className="text-xs text-ink-muted">
          Jogo já finalizado — ao salvar, o placar volta a pendente.
        </p>
      ) : null}
      <div className="grid gap-3">
        {SLOTS.map((s) => (
          <label key={s.key} className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-ink-muted">
              {s.side} · {s.pos}
            </span>
            <Select
              value={lineup[s.key]}
              disabled={pending}
              className="!py-3 text-base"
              onChange={(e) =>
                setLineup((prev) => ({ ...prev, [s.key]: e.target.value }))
              }
            >
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.gender ? ` (${p.gender === "MALE" ? "M" : "F"})` : ""}
                </option>
              ))}
            </Select>
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="accent"
          disabled={pending || !dirty}
          aria-busy={pending}
          className="w-full sm:w-auto"
          onClick={() => {
            setError(null);
            start(async () => {
              const res = await updateRandomMatchLineup(playId, matchId, lineup);
              if (res?.error) setError(res.error);
              else {
                setOpen(false);
                onSaved?.();
                router.refresh();
              }
            });
          }}
        >
          {pending ? (
            <>
              <Spinner />
              Salvando…
            </>
          ) : (
            "Salvar lineup"
          )}
        </Button>
        {!embedded ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setLineup(initial);
              setError(null);
              setOpen(false);
            }}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}
    </div>
  );

  if (embedded) return editor;

  return (
    <div className="mb-3 space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          className="!px-2 !py-1 text-xs"
          disabled={pending}
          onClick={() => {
            if (open) {
              setOpen(false);
              setError(null);
              setLineup(initial);
            } else {
              setLineup(initial);
              setError(null);
              setOpen(true);
            }
          }}
        >
          {open ? "Fechar edição" : "Alterar jogadores"}
        </Button>
      </div>
      {open ? editor : null}
    </div>
  );
}
