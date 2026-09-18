import type { RankingRow } from "@/lib/ranking";
import { pairLabel } from "@/lib/labels";
import { Badge } from "@/components/ui";
import { groupMatchesIntoRounds } from "@/lib/schedule";
import { ScoreForm } from "@/components/score-form";

export function RankingTable({ rows }: { rows: RankingRow[] }) {
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
            <tr className="border-b border-line bg-black/[0.02] text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Dupla</th>
              <th className="px-4 py-3 text-right">V</th>
              <th className="px-4 py-3 text-right">D</th>
              <th className="px-4 py-3 text-right">G+</th>
              <th className="px-4 py-3 text-right">G−</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-right">Jogos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              if (!r.withdrawn) activeRank += 1;
              const displayRank = r.withdrawn ? "—" : activeRank;
              return (
                <tr
                  key={r.pairId}
                  className={`border-b border-line/60 last:border-0 ${
                    r.withdrawn ? "bg-black/[0.015] opacity-70" : "hover:bg-mint-soft/40"
                  }`}
                >
                  <td className="px-4 py-3.5">
                    {!r.withdrawn && activeRank === 1 ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-lime text-xs font-bold text-night">
                        1
                      </span>
                    ) : (
                      <span className="pl-2 tabular-nums text-ink-muted">{displayRank}</span>
                    )}
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
    playerA: { name: string };
    playerB: { name: string };
  };
  pairAway: {
    id: string;
    label: string | null;
    playerA: { name: string };
    playerB: { name: string };
  };
};

function RoundHeader({
  round,
  complete,
  done,
  total,
}: {
  round: number;
  complete: boolean;
  done: number;
  total: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-xl font-bold">Rodada {round}</h3>
        <Badge tone={complete ? "done" : "live"}>
          {complete ? (
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
        {done}/{total} jogos
      </span>
    </div>
  );
}

export function MatchList({ matches }: { matches: MatchView[] }) {
  if (!matches.length) {
    return (
      <div className="surface rounded-3xl px-6 py-12 text-center">
        <p className="font-display text-xl">Nenhum jogo gerado</p>
      </div>
    );
  }

  const rounds = groupMatchesIntoRounds(matches);

  return (
    <div className="space-y-6">
      {rounds.map(({ round, items, complete }) => (
        <section key={round} className="space-y-2">
          <RoundHeader
            round={round}
            complete={complete}
            done={items.filter((m) => m.status === "completed").length}
            total={items.length}
          />
          <ul className="space-y-2">
            {items.map((m) => (
              <li
                key={m.id}
                className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5"
              >
                <div>
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
      ))}
    </div>
  );
}

export function AdminMatchRounds({
  playId,
  matches,
}: {
  playId: string;
  matches: MatchView[];
}) {
  if (!matches.length) {
    return (
      <div className="surface rounded-3xl px-6 py-14 text-center">
        <p className="font-display text-xl">Sem jogos ainda</p>
        <p className="mt-2 text-sm text-ink-muted">
          Com ≥2 duplas ativas, gere o chaveamento.
        </p>
      </div>
    );
  }

  const rounds = groupMatchesIntoRounds(matches);

  return (
    <div className="space-y-8">
      <p className="text-sm text-ink-muted">
        Em cada rodada, cada dupla joga no máximo uma vez (ex: A×B e C×D).
      </p>
      {rounds.map(({ round, items, complete }) => (
        <section key={round} className="space-y-3">
          <RoundHeader
            round={round}
            complete={complete}
            done={items.filter((m) => m.status === "completed").length}
            total={items.length}
          />
          <ul className="space-y-3">
            {items.map((m) => (
              <li key={m.id} className="surface rounded-3xl p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={m.status === "completed" ? "done" : "live"}>
                    {m.status === "completed" ? "Finalizado" : "Pendente"}
                  </Badge>
                </div>
                {m.status === "completed" ? (
                  <p className="mb-1 font-display text-lg font-bold leading-snug">
                    {pairLabel(m.pairHome)}
                    <span className="mx-2 text-mint">vs</span>
                    {pairLabel(m.pairAway)}
                  </p>
                ) : null}
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
      ))}
    </div>
  );
}
