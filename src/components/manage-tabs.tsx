"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";

const MANAGE_TABS = [
  { id: "participantes", label: "Participantes" },
  { id: "jogos", label: "Jogos" },
  { id: "ranking", label: "Ranking" },
] as const;

export type ManageTabId = (typeof MANAGE_TABS)[number]["id"];

const PUBLIC_TABS = [
  { id: "ranking", label: "Ranking" },
  { id: "jogos", label: "Jogos" },
] as const;

export type PublicTabId = (typeof PUBLIC_TABS)[number]["id"];

const JOGOS_SUB_TABS = [
  { id: "ativos", label: "Ativos" },
  { id: "finalizados", label: "Finalizados" },
] as const;

export type JogosSubTabId = (typeof JOGOS_SUB_TABS)[number]["id"];

function normalizeManageTab(raw?: string | null): ManageTabId {
  if (raw === "jogos" || raw === "ranking" || raw === "participantes") return raw;
  if (raw === "elenco") return "participantes";
  if (raw === "finalizados") return "jogos";
  return "participantes";
}

function normalizePublicTab(raw?: string | null): PublicTabId {
  if (raw === "jogos" || raw === "finalizados") return "jogos";
  return "ranking";
}

function useClientTab<T extends string>(initial: T) {
  const pathname = usePathname();
  const [active, setActive] = useState(initial);

  const select = useCallback(
    (id: T) => {
      setActive(id);
      window.history.replaceState(window.history.state, "", `${pathname}?tab=${id}`);
    },
    [pathname],
  );

  return [active, select] as const;
}

function TabBar<T extends string>({
  tabs,
  active,
  counts,
  onSelect,
  size = "lg",
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  counts: Record<T, number>;
  onSelect: (id: T) => void;
  size?: "lg" | "sm";
}) {
  return (
    <div
      className={`surface relative flex gap-1 rounded-2xl ${
        size === "sm" ? "p-1" : "p-1.5"
      }`}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-xl font-semibold transition ${
              size === "sm" ? "px-3 py-2 text-xs" : "px-3 py-2.5 text-sm"
            } ${
              isActive
                ? "bg-night text-white"
                : "text-ink-muted hover:bg-black/[0.03] hover:text-ink"
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                isActive ? "bg-white/15 text-white" : "bg-ink/5 text-ink-muted"
              }`}
            >
              {counts[tab.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Sub-abas Ativos / Finalizados dentro da aba Jogos. */
export function JogosSubTabs({
  counts,
  ativos,
  finalizados,
  initialSubTab,
}: {
  counts: { ativos: number; finalizados: number };
  ativos: React.ReactNode;
  finalizados: React.ReactNode;
  initialSubTab?: JogosSubTabId;
}) {
  const [active, setActive] = useState<JogosSubTabId>(
    initialSubTab === "finalizados" ? "finalizados" : "ativos",
  );

  return (
    <div className="space-y-5">
      <TabBar
        tabs={JOGOS_SUB_TABS}
        active={active}
        counts={counts}
        onSelect={setActive}
        size="sm"
      />
      <div hidden={active !== "ativos"} className={active === "ativos" ? "animate-rise" : undefined}>
        {ativos}
      </div>
      <div
        hidden={active !== "finalizados"}
        className={active === "finalizados" ? "animate-rise" : undefined}
      >
        {finalizados}
      </div>
    </div>
  );
}

export function ManageTabs({
  counts,
  participantes,
  jogos,
  ranking,
  initialTab,
}: {
  counts: { participantes: number; jogos: number; ranking: number };
  participantes: React.ReactNode;
  jogos: React.ReactNode;
  ranking: React.ReactNode;
  initialTab?: string | null;
}) {
  const [active, select] = useClientTab(normalizeManageTab(initialTab));

  const panels: Record<ManageTabId, React.ReactNode> = {
    participantes,
    jogos,
    ranking,
  };

  return (
    <div className="space-y-6">
      <TabBar
        tabs={MANAGE_TABS}
        active={active}
        counts={counts}
        onSelect={select}
      />
      {(Object.keys(panels) as ManageTabId[]).map((id) => (
        <div
          key={id}
          hidden={active !== id}
          className={active === id ? "animate-rise" : undefined}
        >
          {panels[id]}
        </div>
      ))}
    </div>
  );
}

export function PublicTabs({
  ranking,
  jogos,
  counts,
  initialTab,
}: {
  ranking: React.ReactNode;
  jogos: React.ReactNode;
  counts: { ranking: number; jogos: number };
  initialTab?: string | null;
}) {
  const [active, select] = useClientTab(normalizePublicTab(initialTab));

  return (
    <div className="space-y-6">
      <TabBar
        tabs={PUBLIC_TABS}
        active={active}
        counts={counts}
        onSelect={select}
      />
      <div hidden={active !== "ranking"} className={active === "ranking" ? "animate-rise" : undefined}>
        {ranking}
      </div>
      <div hidden={active !== "jogos"} className={active === "jogos" ? "animate-rise" : undefined}>
        {jogos}
      </div>
    </div>
  );
}
