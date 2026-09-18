"use client";

import { useMemo, useState } from "react";
import type { RankingRow, IndividualRankingRow } from "@/lib/ranking";

type SortKey =
  | "label"
  | "wins"
  | "losses"
  | "gamesWon"
  | "gamesLost"
  | "gameDiff"
  | "matchesPlayed";

type Dir = "asc" | "desc";

const DEFAULT_SORT: { key: SortKey; dir: Dir } = { key: "wins", dir: "desc" };

function compareRows<T extends {
  label: string;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  matchesPlayed: number;
}>(a: T, b: T, key: SortKey, dir: Dir): number {
  const mul = dir === "asc" ? 1 : -1;
  if (key === "label") {
    return mul * a.label.localeCompare(b.label, "pt-BR");
  }
  const av = a[key];
  const bv = b[key];
  if (av !== bv) return mul * (av - bv);
  // tie-break: default ranking criteria
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
  if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
  return a.label.localeCompare(b.label, "pt-BR");
}

function SortTh({
  label,
  col,
  sort,
  align = "right",
  onSort,
}: {
  label: string;
  col: SortKey;
  sort: { key: SortKey; dir: Dir };
  align?: "left" | "right";
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider transition hover:text-ink ${
          active ? "text-ink" : "text-ink-muted"
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <span className={`text-[10px] ${active ? "opacity-100" : "opacity-35"}`} aria-hidden>
          {active ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function useRankingSort<T extends {
  label: string;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  matchesPlayed: number;
  withdrawn?: boolean;
}>(rows: T[]) {
  const [sort, setSort] = useState(DEFAULT_SORT);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (a.withdrawn != null && b.withdrawn != null && a.withdrawn !== b.withdrawn) {
        return a.withdrawn ? 1 : -1;
      }
      return compareRows(a, b, sort.key, sort.dir);
    });
    return copy;
  }, [rows, sort]);

  function onSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "desc" ? "asc" : "desc" };
      }
      // numeric cols default desc; label asc
      return { key, dir: key === "label" ? "asc" : "desc" };
    });
  }

  return { sorted, sort, onSort };
}

function RankCell({ rank, highlight }: { rank: number | "—"; highlight: boolean }) {
  if (highlight) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-lime text-xs font-bold text-night">
        1
      </span>
    );
  }
  return <span className="pl-2 tabular-nums text-ink-muted">{rank}</span>;
}

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  const { sorted, sort, onSort } = useRankingSort(rows);

  if (!rows.length) {
    return (
      <div className="surface rounded-3xl px-6 py-12 text-center">
        <p className="font-display text-xl">Sem duplas no ranking</p>
        <p className="mt-1 text-sm text-ink-muted">Forme as duplas para começar.</p>
      </div>
    );
  }

  let activeRank = 0;

  return (
    <div className="surface overflow-hidden rounded-3xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-[11px]">
              <th className="px-4 py-3 text-ink-muted">#</th>
              <SortTh label="Dupla" col="label" sort={sort} align="left" onSort={onSort} />
              <SortTh label="V" col="wins" sort={sort} onSort={onSort} />
              <SortTh label="D" col="losses" sort={sort} onSort={onSort} />
              <SortTh label="G+" col="gamesWon" sort={sort} onSort={onSort} />
              <SortTh label="G−" col="gamesLost" sort={sort} onSort={onSort} />
              <SortTh label="Saldo" col="gameDiff" sort={sort} onSort={onSort} />
              <SortTh label="Jogos" col="matchesPlayed" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              if (!r.withdrawn) activeRank += 1;
              const displayRank = r.withdrawn ? ("—" as const) : activeRank;
              return (
                <tr
                  key={r.pairId}
                  className={`border-b border-line/60 last:border-0 ${
                    r.withdrawn ? "bg-black/[0.015] opacity-70" : "hover:bg-mint-soft/40"
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <RankCell
                      rank={displayRank}
                      highlight={!r.withdrawn && activeRank === 1}
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-semibold">{r.label}</span>
                    {r.withdrawn ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                        saiu
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-mint-deep">
                    {r.wins}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-ink-muted">
                    {r.losses}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{r.gamesWon}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{r.gamesLost}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold">
                    {r.gameDiff > 0 ? `+${r.gameDiff}` : r.gameDiff}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-ink-muted">
                    {r.matchesPlayed}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IndividualRankingTable({ rows }: { rows: IndividualRankingRow[] }) {
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const filtered = useMemo(() => {
    if (genderFilter === "ALL") return rows;
    return rows.filter((r) => r.gender === genderFilter);
  }, [rows, genderFilter]);
  const { sorted, sort, onSort } = useRankingSort(filtered);

  if (!rows.length) {
    return (
      <div className="surface rounded-3xl px-6 py-12 text-center">
        <p className="font-display text-xl">Sem jogadores no ranking</p>
        <p className="mt-1 text-sm text-ink-muted">Adicione jogadores e gere a 1ª rodada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: "ALL" as const, label: "Todos" },
            { id: "MALE" as const, label: "Masc" },
            { id: "FEMALE" as const, label: "Fem" },
          ] as const
        ).map((f) => {
          const on = genderFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setGenderFilter(f.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                on
                  ? "bg-night text-white"
                  : "border border-line bg-white text-ink-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="surface overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-[11px]">
                <th className="px-4 py-3 text-ink-muted">#</th>
                <SortTh label="Jogador" col="label" sort={sort} align="left" onSort={onSort} />
                <SortTh label="V" col="wins" sort={sort} onSort={onSort} />
                <SortTh label="D" col="losses" sort={sort} onSort={onSort} />
                <SortTh label="G+" col="gamesWon" sort={sort} onSort={onSort} />
                <SortTh label="G−" col="gamesLost" sort={sort} onSort={onSort} />
                <SortTh label="Saldo" col="gameDiff" sort={sort} onSort={onSort} />
                <SortTh label="Jogos" col="matchesPlayed" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-ink-muted">
                    Nenhum jogador neste filtro
                  </td>
                </tr>
              ) : (
                sorted.map((r, i) => {
                  const rank = i + 1;
                  return (
                    <tr
                      key={r.playerId}
                      className="border-b border-line/60 last:border-0 hover:bg-mint-soft/40"
                    >
                      <td className="px-4 py-3.5">
                        <RankCell rank={rank} highlight={rank === 1} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold">{r.label}</span>
                        <span className="ml-2 text-[10px] font-semibold uppercase text-ink-muted">
                          {r.gender === "MALE" ? "M" : "F"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-mint-deep">
                        {r.wins}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-ink-muted">
                        {r.losses}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{r.gamesWon}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{r.gamesLost}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold">
                        {r.gameDiff > 0 ? `+${r.gameDiff}` : r.gameDiff}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-ink-muted">
                        {r.matchesPlayed}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
