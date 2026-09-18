"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { id: "elenco", label: "Elenco" },
  { id: "jogos", label: "Jogos" },
  { id: "ranking", label: "Ranking" },
] as const;

export type ManageTabId = (typeof TABS)[number]["id"];

export function ManageTabs({
  counts,
  elenco,
  jogos,
  ranking,
}: {
  counts: { elenco: number; jogos: number; ranking: number };
  elenco: React.ReactNode;
  jogos: React.ReactNode;
  ranking: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const active: ManageTabId =
    raw === "jogos" || raw === "ranking" || raw === "elenco" ? raw : "elenco";

  const panels = { elenco, jogos, ranking };

  return (
    <div className="space-y-6">
      <div className="surface relative flex gap-1 rounded-2xl p-1.5">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          const count = counts[tab.id];
          return (
            <Link
              key={tab.id}
              href={`${pathname}?tab=${tab.id}`}
              scroll={false}
              className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "bg-night text-white"
                  : "text-ink-muted hover:text-ink hover:bg-black/[0.03]"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  isActive ? "bg-white/15 text-white" : "bg-ink/5 text-ink-muted"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <div key={active} className="animate-rise">
        {panels[active]}
      </div>
    </div>
  );
}

export function PublicTabs({
  ranking,
  jogos,
  counts,
}: {
  ranking: React.ReactNode;
  jogos: React.ReactNode;
  counts: { ranking: number; jogos: number };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const active = raw === "jogos" ? "jogos" : "ranking";

  return (
    <div className="space-y-6">
      <div className="surface flex gap-1 rounded-2xl p-1.5">
        {(
          [
            { id: "ranking" as const, label: "Ranking" },
            { id: "jogos" as const, label: "Jogos" },
          ] as const
        ).map((tab) => {
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.id}
              href={`${pathname}?tab=${tab.id}`}
              scroll={false}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "bg-night text-white"
                  : "text-ink-muted hover:text-ink hover:bg-black/[0.03]"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  isActive ? "bg-white/15" : "bg-ink/5"
                }`}
              >
                {counts[tab.id]}
              </span>
            </Link>
          );
        })}
      </div>
      <div key={active} className="animate-rise">
        {active === "ranking" ? ranking : jogos}
      </div>
    </div>
  );
}
