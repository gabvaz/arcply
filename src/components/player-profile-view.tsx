import Link from "next/link";
import { Badge, Stat } from "@/components/ui";
import { GENDER_LABELS } from "@/lib/labels";
import type { PlayerPlayProfile, RelationRow } from "@/lib/player-profile";

function RelationList({
  title,
  rows,
  empty,
  playId,
  showCount,
  tone,
}: {
  title: string;
  rows: RelationRow[];
  empty: string;
  playId: string;
  showCount: boolean;
  tone: "done" | "pending";
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {title}
        </h4>
        <span className="text-[10px] font-semibold tabular-nums text-ink-muted">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-sm text-ink-muted">
          {empty}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.playerId}>
              <Link
                href={`/plays/${playId}/players/${r.playerId}`}
                className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-sm transition hover:border-mint/40 ${
                  tone === "done"
                    ? "border-line bg-white"
                    : "border-dashed border-line bg-black/[0.015]"
                }`}
              >
                <span className="min-w-0 truncate font-semibold">
                  {r.name}
                  <span className="ml-1.5 text-[10px] font-semibold uppercase text-ink-muted">
                    {r.gender === "MALE" ? "M" : "F"}
                  </span>
                </span>
                {showCount ? (
                  <Badge tone={r.count >= 2 ? "live" : "neutral"}>
                    {r.count}×
                  </Badge>
                ) : (
                  <span className="text-[10px] font-semibold uppercase text-ink-muted">
                    falta
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlayerProfileView({
  playId,
  playName,
  profile,
}: {
  playId: string;
  playName: string;
  profile: PlayerPlayProfile;
}) {
  const { player } = profile;

  return (
    <div className="space-y-8">
      <div className="animate-rise space-y-4">
        <Link
          href={`/plays/${playId}`}
          className="inline-block text-sm font-semibold text-mint-deep hover:underline"
        >
          ← {playName}
        </Link>
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge tone="neutral">{GENDER_LABELS[player.gender]}</Badge>
            <Badge tone="neutral">Perfil no play</Badge>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            {player.name}
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Vitórias" value={profile.wins} />
          <Stat label="Derrotas" value={profile.losses} />
          <Stat
            label="Saldo"
            value={
              profile.gameDiff > 0 ? `+${profile.gameDiff}` : profile.gameDiff
            }
          />
          <Stat
            label="Jogos"
            value={`${profile.matchesPlayed}/${profile.matchesTotal}`}
          />
        </div>
        <p className="text-sm text-ink-muted">
          G+ {profile.gamesWon} · G− {profile.gamesLost}
        </p>
      </div>

      <section className="animate-rise-delay-1 space-y-4">
        <h2 className="font-display text-2xl font-bold">Parceiros</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="surface rounded-3xl p-4 sm:p-5">
            <RelationList
              title="Já jogou junto"
              rows={profile.partnersPlayed}
              empty="Ainda não formou dupla com ninguém"
              playId={playId}
              showCount
              tone="done"
            />
          </div>
          <div className="surface rounded-3xl p-4 sm:p-5">
            <RelationList
              title="Ainda falta"
              rows={profile.partnersMissing}
              empty="Já foi parceiro de todo o elenco"
              playId={playId}
              showCount={false}
              tone="pending"
            />
          </div>
        </div>
      </section>

      <section className="animate-rise-delay-2 space-y-4">
        <h2 className="font-display text-2xl font-bold">Adversários</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="surface rounded-3xl p-4 sm:p-5">
            <RelationList
              title="Já enfrentou"
              rows={profile.opponentsPlayed}
              empty="Ainda não enfrentou ninguém"
              playId={playId}
              showCount
              tone="done"
            />
          </div>
          <div className="surface rounded-3xl p-4 sm:p-5">
            <RelationList
              title="Ainda falta"
              rows={profile.opponentsMissing}
              empty="Já enfrentou todo o elenco"
              playId={playId}
              showCount={false}
              tone="pending"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
