"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import { addPlayersToPlay } from "@/lib/actions/plays";
import { useRouter } from "next/navigation";

export function AddPlayersForm({
  playId,
  available,
}: {
  playId: string;
  available: { id: string; name: string; gender?: "MALE" | "FEMALE" }[];
}) {
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((p) => p.name.toLowerCase().includes(q));
  }, [available, query]);

  const filteredIds = useMemo(() => filtered.map((p) => p.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someFilteredSelected =
    filteredIds.some((id) => selected.has(id)) && !allFilteredSelected;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  }

  if (!available.length) {
    return (
      <p className="text-sm text-ink-muted">
        Todos os jogadores já estão neste play (ou cadastre novos).
      </p>
    );
  }

  const count = selected.size;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jogador…"
            disabled={pending}
            className="w-full rounded-xl border border-line bg-white/90 py-2.5 pl-3.5 pr-9 text-sm text-ink outline-none transition placeholder:text-ink-muted/50 focus:border-mint focus:ring-4 focus:ring-mint/15"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-black/[0.05] hover:text-ink"
              aria-label="Limpar busca"
            >
              ×
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleAllFiltered}
          disabled={pending || !filteredIds.length}
          className="shrink-0 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#fafafa] disabled:opacity-45"
        >
          {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
          {query.trim() && filteredIds.length ? (
            <span className="ml-1 text-ink-muted">({filteredIds.length})</span>
          ) : null}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white/70">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              ref={(el) => {
                if (el) el.indeterminate = someFilteredSelected;
              }}
              onChange={toggleAllFiltered}
              disabled={pending || !filteredIds.length}
              className="size-4 accent-[var(--mint)]"
            />
            {filtered.length === available.length
              ? `${available.length} disponíveis`
              : `${filtered.length} de ${available.length}`}
          </label>
          {count > 0 ? (
            <span className="text-xs font-semibold text-mint-deep">
              {count} selecionado{count === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <div className="max-h-64 overflow-y-auto overscroll-contain p-1.5 sm:grid sm:grid-cols-2 sm:gap-0.5">
          {filtered.map((p) => {
            const isOn = selected.has(p.id);
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition ${
                  isOn
                    ? "bg-mint-soft text-mint-deep"
                    : "hover:bg-black/[0.03]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(p.id)}
                  disabled={pending}
                  className="size-4 shrink-0 accent-[var(--mint)]"
                />
                <span className="min-w-0 truncate">{p.name}</span>
                {p.gender ? (
                  <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase text-ink-muted">
                    {p.gender === "MALE" ? "M" : "F"}
                  </span>
                ) : null}
              </label>
            );
          })}
          {!filtered.length ? (
            <p className="col-span-2 px-3 py-6 text-center text-sm text-ink-muted">
              Nenhum jogador com “{query.trim()}”
            </p>
          ) : null}
        </div>
      </div>

      <Button
        type="button"
        disabled={pending || count === 0}
        variant="accent"
        aria-busy={pending}
        onClick={() => {
          const ids = [...selected];
          start(async () => {
            await addPlayersToPlay(playId, ids);
            setSelected(new Set());
            setQuery("");
            router.refresh();
          });
        }}
      >
        {pending ? (
          <>
            <Spinner />
            Adicionando…
          </>
        ) : count === 0 ? (
          "Selecione jogadores"
        ) : (
          `Adicionar ${count}`
        )}
      </Button>
    </div>
  );
}
