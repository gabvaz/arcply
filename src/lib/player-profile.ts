import type { IndividualPlayerInput } from "@/lib/ranking";

type PairRef = {
  id: string;
  playerAId: string;
  playerBId: string;
};

type MatchRef = {
  pairHomeId: string;
  pairAwayId: string;
  status: string;
  gamesHome: number | null;
  gamesAway: number | null;
};

export type RelationRow = {
  playerId: string;
  name: string;
  gender: "MALE" | "FEMALE";
  count: number;
};

export type PlayerPlayProfile = {
  player: IndividualPlayerInput;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  matchesPlayed: number;
  matchesTotal: number;
  partnersPlayed: RelationRow[];
  partnersMissing: RelationRow[];
  opponentsPlayed: RelationRow[];
  opponentsMissing: RelationRow[];
};

function bump(
  map: Map<string, number>,
  id: string,
  n = 1,
) {
  map.set(id, (map.get(id) ?? 0) + n);
}

/** Perfil do jogador no contexto de um play (roster = elenco ∪ quem já apareceu). */
export function computePlayerPlayProfile(
  playerId: string,
  roster: IndividualPlayerInput[],
  pairs: PairRef[],
  matches: MatchRef[],
): PlayerPlayProfile | null {
  const me = roster.find((p) => p.id === playerId);
  if (!me) return null;

  const others = roster.filter((p) => p.id !== playerId);
  const pairById = new Map(pairs.map((p) => [p.id, p]));

  const partnerCounts = new Map<string, number>();
  const opponentCounts = new Map<string, number>();

  let wins = 0;
  let losses = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  let matchesPlayed = 0;
  let matchesTotal = 0;

  for (const m of matches) {
    const home = pairById.get(m.pairHomeId);
    const away = pairById.get(m.pairAwayId);
    if (!home || !away) continue;

    const homeIds = [home.playerAId, home.playerBId];
    const awayIds = [away.playerAId, away.playerBId];
    const inHome = homeIds.includes(playerId);
    const inAway = awayIds.includes(playerId);
    if (!inHome && !inAway) continue;

    matchesTotal += 1;

    const partners = inHome
      ? homeIds.filter((id) => id !== playerId)
      : awayIds.filter((id) => id !== playerId);
    const opponents = inHome ? awayIds : homeIds;

    for (const id of partners) bump(partnerCounts, id);
    for (const id of opponents) bump(opponentCounts, id);

    if (m.status !== "completed") continue;
    if (m.gamesHome == null || m.gamesAway == null) continue;

    matchesPlayed += 1;
    if (inHome) {
      gamesWon += m.gamesHome;
      gamesLost += m.gamesAway;
      if (m.gamesHome > m.gamesAway) wins += 1;
      else if (m.gamesAway > m.gamesHome) losses += 1;
    } else {
      gamesWon += m.gamesAway;
      gamesLost += m.gamesHome;
      if (m.gamesAway > m.gamesHome) wins += 1;
      else if (m.gamesHome > m.gamesAway) losses += 1;
    }
  }

  function toRows(
    counts: Map<string, number>,
    played: boolean,
  ): RelationRow[] {
    const rows: RelationRow[] = [];
    for (const o of others) {
      const count = counts.get(o.id) ?? 0;
      if (played ? count > 0 : count === 0) {
        rows.push({
          playerId: o.id,
          name: o.name,
          gender: o.gender,
          count,
        });
      }
    }
    if (played) {
      rows.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, "pt-BR");
      });
    } else {
      rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
    return rows;
  }

  return {
    player: me,
    wins,
    losses,
    gamesWon,
    gamesLost,
    gameDiff: gamesWon - gamesLost,
    matchesPlayed,
    matchesTotal,
    partnersPlayed: toRows(partnerCounts, true),
    partnersMissing: toRows(partnerCounts, false),
    opponentsPlayed: toRows(opponentCounts, true),
    opponentsMissing: toRows(opponentCounts, false),
  };
}
