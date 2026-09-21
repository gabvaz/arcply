/** Relação já vista entre dois jogadores desta partida (excluindo a própria). */

export type FamiliarityHit = {
  kind: "partner" | "opponent";
  aName: string;
  bName: string;
};

type PairPlayers = {
  playerAId: string;
  playerBId: string;
  playerA: { name: string };
  playerB: { name: string };
};

type MatchLike = {
  id: string;
  pairHome: PairPlayers;
  pairAway: PairPlayers;
};

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Histórico de parceiros/adversários de todos os jogos exceto `matchId`. */
export function analyzeMatchFamiliarity(
  match: MatchLike,
  allMatches: MatchLike[],
): { hits: FamiliarityHit[]; isFresh: boolean } {
  const partners = new Set<string>();
  const opponents = new Set<string>();

  for (const m of allMatches) {
    if (m.id === match.id) continue;
    const ha = m.pairHome.playerAId;
    const hb = m.pairHome.playerBId;
    const aa = m.pairAway.playerAId;
    const ab = m.pairAway.playerBId;

    partners.add(pairKey(ha, hb));
    partners.add(pairKey(aa, ab));
    for (const h of [ha, hb]) {
      for (const a of [aa, ab]) opponents.add(pairKey(h, a));
    }
  }

  const nameById = new Map<string, string>([
    [match.pairHome.playerAId, match.pairHome.playerA.name],
    [match.pairHome.playerBId, match.pairHome.playerB.name],
    [match.pairAway.playerAId, match.pairAway.playerA.name],
    [match.pairAway.playerBId, match.pairAway.playerB.name],
  ]);

  const hits: FamiliarityHit[] = [];
  const seen = new Set<string>();

  const push = (kind: FamiliarityHit["kind"], idA: string, idB: string) => {
    const key = `${kind}:${pairKey(idA, idB)}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({
      kind,
      aName: nameById.get(idA) ?? "?",
      bName: nameById.get(idB) ?? "?",
    });
  };

  const { playerAId: hA, playerBId: hB } = match.pairHome;
  const { playerAId: aA, playerBId: aB } = match.pairAway;

  if (partners.has(pairKey(hA, hB))) push("partner", hA, hB);
  if (partners.has(pairKey(aA, aB))) push("partner", aA, aB);
  for (const h of [hA, hB]) {
    for (const a of [aA, aB]) {
      if (opponents.has(pairKey(h, a))) push("opponent", h, a);
    }
  }

  return { hits, isFresh: hits.length === 0 };
}
