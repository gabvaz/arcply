type PairInput = {
  id: string;
  label: string | null;
  withdrawnAt?: Date | string | null;
  playerA: { name: string };
  playerB: { name: string };
};

type MatchInput = {
  pairHomeId: string;
  pairAwayId: string;
  gamesHome: number | null;
  gamesAway: number | null;
  status: string;
};

export type RankingRow = {
  pairId: string;
  label: string;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  matchesPlayed: number;
  withdrawn: boolean;
};

export function computeRanking(
  pairs: PairInput[],
  matches: MatchInput[],
): RankingRow[] {
  const rows = new Map<string, RankingRow>();

  for (const p of pairs) {
    rows.set(p.id, {
      pairId: p.id,
      label: p.label || `${p.playerA.name} / ${p.playerB.name}`,
      wins: 0,
      losses: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDiff: 0,
      matchesPlayed: 0,
      withdrawn: p.withdrawnAt != null,
    });
  }

  for (const m of matches) {
    if (m.status !== "completed") continue;
    if (m.gamesHome == null || m.gamesAway == null) continue;

    const home = rows.get(m.pairHomeId);
    const away = rows.get(m.pairAwayId);
    if (!home || !away) continue;

    home.gamesWon += m.gamesHome;
    home.gamesLost += m.gamesAway;
    away.gamesWon += m.gamesAway;
    away.gamesLost += m.gamesHome;
    home.matchesPlayed += 1;
    away.matchesPlayed += 1;

    if (m.gamesHome > m.gamesAway) {
      home.wins += 1;
      away.losses += 1;
    } else if (m.gamesAway > m.gamesHome) {
      away.wins += 1;
      home.losses += 1;
    }
  }

  const result = Array.from(rows.values()).map((r) => ({
    ...r,
    gameDiff: r.gamesWon - r.gamesLost,
  }));

  // Ativas primeiro (por ranking), depois retiradas
  result.sort((a, b) => {
    if (a.withdrawn !== b.withdrawn) return a.withdrawn ? 1 : -1;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    return a.label.localeCompare(b.label, "pt-BR");
  });

  return result;
}

/** Placar livre: inteiros ≥0, sem empate. Vence quem tiver mais games. */
export function validateScore(
  gamesHome: number,
  gamesAway: number,
): string | null {
  if (!Number.isInteger(gamesHome) || !Number.isInteger(gamesAway)) {
    return "Placar deve ser inteiro";
  }
  if (gamesHome < 0 || gamesAway < 0) return "Placar não pode ser negativo";
  if (gamesHome === gamesAway) {
    return "Não pode empatar — quem tiver mais games vence";
  }
  return null;
}
