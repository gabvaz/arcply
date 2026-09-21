"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import { analyzeMatchFamiliarity } from "@/lib/match-familiarity";
import { deleteMatch } from "@/lib/actions/plays";
import { RandomMatchLineupEditor } from "@/components/random-match-lineup";

type PairPlayers = {
  playerAId: string;
  playerBId: string;
  playerA: { name: string };
  playerB: { name: string };
};

type MatchLike = {
  id: string;
  status: string;
  pairHome: PairPlayers;
  pairAway: PairPlayers;
};

type RosterPlayer = { id: string; name: string; gender?: "MALE" | "FEMALE" };

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] ?? full;
}

function FamiliarityBody({
  match,
  allMatches,
}: {
  match: MatchLike;
  allMatches: MatchLike[];
}) {
  const { hits, isFresh } = analyzeMatchFamiliarity(match, allMatches);
  if (isFresh) {
    return (
      <p className="text-sm leading-relaxed text-ink-muted">
        {allMatches.length <= 1
          ? "Formação nova — primeiro jogo deste play."
          : "Ninguém desta quadra já jogou junto ou um contra o outro neste play."}
      </p>
    );
  }
  const partners = hits.filter((h) => h.kind === "partner");
  const opponents = hits.filter((h) => h.kind === "opponent");
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800/80">
        Já se cruzaram neste play
      </p>
      <ul className="space-y-1.5 text-sm text-ink">
        {partners.map((h) => (
          <li key={`p-${h.aName}-${h.bName}`}>
            <span className="font-semibold text-ink-muted">Parceiros:</span>{" "}
            {firstName(h.aName)} + {firstName(h.bName)}
          </li>
        ))}
        {opponents.map((h) => (
          <li key={`o-${h.aName}-${h.bName}`}>
            <span className="font-semibold text-ink-muted">Adversários:</span>{" "}
            {firstName(h.aName)} × {firstName(h.bName)}
          </li>
        ))}
      </ul>
    </div>
  );
}

type Panel = "menu" | "formation" | "lineup" | null;

/**
 * Menu único (⋯) para ações secundárias do card:
 * formação, alterar jogadores, excluir.
 * CTA principal (Iniciar / placar) fica fora.
 */
export function MatchCardOverflow({
  playId,
  match,
  allMatches,
  roster,
  allowLineupEdit,
  showFamiliarity,
  canDelete = false,
}: {
  playId: string;
  match: MatchLike;
  allMatches: MatchLike[];
  roster: RosterPlayer[];
  allowLineupEdit: boolean;
  showFamiliarity: boolean;
  canDelete?: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const canEditLineup = allowLineupEdit && match.status === "pending";
  const { isFresh } = analyzeMatchFamiliarity(match, allMatches);

  useEffect(() => {
    if (panel !== "menu") return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPanel(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  function runDelete() {
    setError(null);
    if (!confirm("Excluir este jogo?")) return;
    if (match.status === "in_progress" || match.status === "completed") {
      const extra =
        match.status === "completed"
          ? "Este jogo já foi finalizado e o placar entra no ranking.\nTem certeza que quer excluir?"
          : "Este jogo está em andamento.\nTem certeza que quer excluir?";
      if (!confirm(extra)) return;
    }
    setPanel(null);
    start(async () => {
      const res = await deleteMatch(playId, match.id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  if (!showFamiliarity && !canEditLineup && !canDelete) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={panel === "menu"}
        aria-controls={menuId}
        aria-label="Mais ações do jogo"
        disabled={pending}
        onClick={() => setPanel((p) => (p === "menu" ? null : "menu"))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink transition hover:bg-black/[0.03] active:scale-95 disabled:opacity-45"
      >
        {pending ? (
          <Spinner className="size-4" />
        ) : (
          <span className="flex flex-col gap-1" aria-hidden>
            <span className="block h-1 w-1 rounded-full bg-current" />
            <span className="block h-1 w-1 rounded-full bg-current" />
            <span className="block h-1 w-1 rounded-full bg-current" />
          </span>
        )}
      </button>

      {panel === "menu" ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-[min(16.5rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-line bg-white shadow-lg shadow-black/10 divide-y divide-line"
        >
          {showFamiliarity ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold transition hover:bg-black/[0.03]"
              onClick={() => setPanel("formation")}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  isFresh
                    ? "bg-mint-soft text-mint-deep"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                i
              </span>
              {isFresh ? "Ver formação" : "Ver cruzamentos"}
            </button>
          ) : null}
          {canEditLineup ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold transition hover:bg-black/[0.03]"
              onClick={() => setPanel("lineup")}
            >
              Alterar jogadores
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-coral transition hover:bg-coral/5"
              onClick={runDelete}
            >
              Excluir jogo
            </button>
          ) : null}
        </div>
      ) : null}

      {panel === "formation" ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2.5rem))] rounded-2xl border border-line bg-white p-4 shadow-lg shadow-black/10">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {isFresh ? "Formação" : "Cruzamentos"}
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-mint-deep"
              onClick={() => setPanel(null)}
            >
              Fechar
            </button>
          </div>
          <FamiliarityBody match={match} allMatches={allMatches} />
        </div>
      ) : null}

      {error ? (
        <p className="absolute right-0 top-full z-20 mt-2 text-xs font-medium text-coral">
          {error}
        </p>
      ) : null}

      {panel === "lineup" && canEditLineup ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-night/40 p-0 sm:items-center sm:p-6"
          onClick={() => setPanel(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPanel(null);
          }}
        >
          <div
            className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-md sm:rounded-3xl"
            role="dialog"
            aria-label="Alterar jogadores"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="font-display text-xl font-bold">Alterar jogadores</p>
              <Button
                type="button"
                variant="ghost"
                className="!px-2"
                onClick={() => setPanel(null)}
              >
                Fechar
              </Button>
            </div>
            <RandomMatchLineupEditor
              playId={playId}
              matchId={match.id}
              roster={roster}
              completed={false}
              embedded
              onSaved={() => setPanel(null)}
              initial={{
                homeA: match.pairHome.playerAId,
                homeB: match.pairHome.playerBId,
                awayA: match.pairAway.playerAId,
                awayB: match.pairAway.playerBId,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
