export type PairRef = { id: string };

export type Fixture = {
  pairHomeId: string;
  pairAwayId: string;
  round: number;
  orderIndex: number;
};

type ExistingMatch = {
  pairHomeId: string;
  pairAwayId: string;
  status?: string;
  round?: number;
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

/**
 * Circle method: cada "rodada" tem ⌊n/2⌋ jogos sem repetir dupla.
 * `series` = quantas voltas completas (1 = RR simples, N = MULTI).
 */
export function generateRoundRobin(pairs: PairRef[], series = 1): Fixture[] {
  if (pairs.length < 2) return [];

  const ids = pairs.map((p) => p.id);
  const n = ids.length;
  const odd = n % 2 === 1;
  const working = odd ? [...ids, "__BYE__"] : [...ids];
  const m = working.length;
  const roundsPerSeries = m - 1;
  const half = m / 2;

  const fixtures: Fixture[] = [];
  let order = 0;
  const arr = [...working];

  for (let s = 0; s < series; s++) {
    const seriesArr = [...arr];
    for (let r = 0; r < roundsPerSeries; r++) {
      const roundNum = s * roundsPerSeries + r + 1;
      for (let i = 0; i < half; i++) {
        const a = seriesArr[i];
        const b = seriesArr[m - 1 - i];
        if (a === "__BYE__" || b === "__BYE__") continue;
        const swap = (roundNum + i) % 2 === 1;
        fixtures.push({
          pairHomeId: swap ? b : a,
          pairAwayId: swap ? a : b,
          round: roundNum,
          orderIndex: order++,
        });
      }
      // rotate: keep first fixed, rotate rest
      const fixed = seriesArr[0];
      const rest = seriesArr.slice(1);
      rest.unshift(rest.pop()!);
      seriesArr.splice(0, seriesArr.length, fixed, ...rest);
    }
  }

  return fixtures;
}

export function nextBalancedMatch(
  pairs: PairRef[],
  existing: ExistingMatch[],
): { pairHomeId: string; pairAwayId: string } | null {
  if (pairs.length < 2) return null;

  const count = new Map<string, number>();
  for (const p of pairs) count.set(p.id, 0);

  const played = new Set<string>();
  for (const m of existing) {
    count.set(m.pairHomeId, (count.get(m.pairHomeId) ?? 0) + 1);
    count.set(m.pairAwayId, (count.get(m.pairAwayId) ?? 0) + 1);
    played.add(pairKey(m.pairHomeId, m.pairAwayId));
  }

  type Candidate = {
    a: string;
    b: string;
    gamesSum: number;
    rematch: boolean;
  };
  const candidates: Candidate[] = [];

  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i].id;
      const b = pairs[j].id;
      candidates.push({
        a,
        b,
        gamesSum: (count.get(a) ?? 0) + (count.get(b) ?? 0),
        rematch: played.has(pairKey(a, b)),
      });
    }
  }

  candidates.sort((x, y) => {
    if (x.rematch !== y.rematch) return x.rematch ? 1 : -1;
    if (x.gamesSum !== y.gamesSum) return x.gamesSum - y.gamesSum;
    return 0;
  });

  const best = candidates[0];
  if (!best) return null;
  return { pairHomeId: best.a, pairAwayId: best.b };
}

export function generateBalancedPool(
  pairs: PairRef[],
  targetMatches?: number,
): Fixture[] {
  if (pairs.length < 2) return [];
  const n = pairs.length;
  const defaultTarget = Math.max(n, Math.ceil((n * (n - 1)) / 4));
  const target = targetMatches ?? defaultTarget;

  const existing: ExistingMatch[] = [];
  const matches: Fixture[] = [];

  for (let i = 0; i < target; i++) {
    const next = nextBalancedMatch(pairs, existing);
    if (!next) break;
    existing.push(next);
    const round = nextAvailableRound(matches, next.pairHomeId, next.pairAwayId);
    matches.push({
      ...next,
      round,
      orderIndex: i,
    });
  }
  return matches;
}

/**
 * Quantas partidas RR/MULTI devem existir entre um par de duplas.
 */
export function requiredMeetings(
  format: "ROUND_ROBIN" | "ROUND_ROBIN_MULTI" | "BALANCED_QUEUE" | "RANDOM",
  playRounds: number,
): number {
  if (format === "BALANCED_QUEUE" || format === "RANDOM") return 0;
  if (format === "ROUND_ROBIN_MULTI") return playRounds;
  return 1;
}

// ─── RANDOM (duplas por rodada) ─────────────────────────────────────────────

export type PlayerHistory = {
  partners: Map<string, Set<string>>;
  opponents: Map<string, Set<string>>;
  played: Map<string, number>;
  byes: Map<string, number>;
};

export type RandomCourt = {
  homeA: string;
  homeB: string;
  awayA: string;
  awayB: string;
};

export type RandomRoundResult = {
  courts: RandomCourt[];
  byes: string[];
  error?: string;
};

export type MixedPairingPolicy = "IGNORE" | "PREFERRED" | "REQUIRED";
export type GenderCode = "MALE" | "FEMALE";

const W_PARTNER = 100;
const W_OPPONENT = 40;
/** Prioriza equalizar jogos agendados (completed + pending). */
const W_PLAYED_IMBALANCE = 50;
const W_ROUND_BALANCE = 200;
const W_SAME_GENDER = 80;

const MIXED_REQUIRED_ERROR =
  "Não é viável formar apenas duplas mistas com o elenco atual";

function emptySetMap(): Map<string, Set<string>> {
  return new Map();
}

function getSet(map: Map<string, Set<string>>, id: string): Set<string> {
  let s = map.get(id);
  if (!s) {
    s = new Set();
    map.set(id, s);
  }
  return s;
}

export function emptyPlayerHistory(playerIds: string[]): PlayerHistory {
  const partners = emptySetMap();
  const opponents = emptySetMap();
  const played = new Map<string, number>();
  const byes = new Map<string, number>();
  for (const id of playerIds) {
    partners.set(id, new Set());
    opponents.set(id, new Set());
    played.set(id, 0);
    byes.set(id, 0);
  }
  return { partners, opponents, played, byes };
}

/** Histórico: `played` = jogos agendados (completed + pending). Partners/opponents de todos. */
export function buildPlayerHistory(
  playerIds: string[],
  matches: {
    pairHome: { playerAId: string; playerBId: string };
    pairAway: { playerAId: string; playerBId: string };
  }[],
): PlayerHistory {
  const h = emptyPlayerHistory(playerIds);
  for (const m of matches) {
    const ha = m.pairHome.playerAId;
    const hb = m.pairHome.playerBId;
    const aa = m.pairAway.playerAId;
    const ab = m.pairAway.playerBId;
    const home = [ha, hb];
    const away = [aa, ab];

    getSet(h.partners, ha).add(hb);
    getSet(h.partners, hb).add(ha);
    getSet(h.partners, aa).add(ab);
    getSet(h.partners, ab).add(aa);

    for (const p of home) {
      for (const o of away) getSet(h.opponents, p).add(o);
      h.played.set(p, (h.played.get(p) ?? 0) + 1);
    }
    for (const p of away) {
      for (const o of home) getSet(h.opponents, p).add(o);
      h.played.set(p, (h.played.get(p) ?? 0) + 1);
    }
  }
  return h;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** 3 formas de 2×2 a partir de 4 jogadores [a,b,c,d]. */
function pairingsOf4(
  a: string,
  b: string,
  c: string,
  d: string,
): RandomCourt[] {
  return [
    { homeA: a, homeB: b, awayA: c, awayB: d },
    { homeA: a, homeB: c, awayA: b, awayB: d },
    { homeA: a, homeB: d, awayA: b, awayB: c },
  ];
}

function isMixedPair(
  a: string,
  b: string,
  genderByPlayer: Map<string, GenderCode>,
): boolean {
  const ga = genderByPlayer.get(a);
  const gb = genderByPlayer.get(b);
  return ga != null && gb != null && ga !== gb;
}

function isFullyMixedCourt(
  court: RandomCourt,
  genderByPlayer: Map<string, GenderCode>,
): boolean {
  return (
    isMixedPair(court.homeA, court.homeB, genderByPlayer) &&
    isMixedPair(court.awayA, court.awayB, genderByPlayer)
  );
}

function courtCost(
  court: RandomCourt,
  h: PlayerHistory,
  genderByPlayer?: Map<string, GenderCode>,
  preferMixed?: boolean,
): number {
  let cost = 0;
  const { homeA, homeB, awayA, awayB } = court;
  if (h.partners.get(homeA)?.has(homeB)) cost += W_PARTNER;
  if (h.partners.get(awayA)?.has(awayB)) cost += W_PARTNER;
  for (const p of [homeA, homeB]) {
    for (const o of [awayA, awayB]) {
      if (h.opponents.get(p)?.has(o)) cost += W_OPPONENT;
    }
  }
  const plays = [homeA, homeB, awayA, awayB].map((id) => h.played.get(id) ?? 0);
  const maxP = Math.max(...plays);
  const minP = Math.min(...plays);
  cost += (maxP - minP) * W_PLAYED_IMBALANCE;

  if (preferMixed && genderByPlayer) {
    if (!isMixedPair(homeA, homeB, genderByPlayer)) cost += W_SAME_GENDER;
    if (!isMixedPair(awayA, awayB, genderByPlayer)) cost += W_SAME_GENDER;
  }
  return cost;
}

function bestCourtForGroup(
  group: [string, string, string, string],
  h: PlayerHistory,
  opts?: {
    genderByPlayer?: Map<string, GenderCode>;
    preferMixed?: boolean;
    requireMixed?: boolean;
  },
): { court: RandomCourt; cost: number } | null {
  let best: RandomCourt | null = null;
  let bestCost = Infinity;
  for (const court of pairingsOf4(group[0], group[1], group[2], group[3])) {
    if (
      opts?.requireMixed &&
      opts.genderByPlayer &&
      !isFullyMixedCourt(court, opts.genderByPlayer)
    ) {
      continue;
    }
    const c = courtCost(
      court,
      h,
      opts?.genderByPlayer,
      opts?.preferMixed,
    );
    if (c < bestCost) {
      bestCost = c;
      best = court;
    }
  }
  if (!best) return null;
  return { court: best, cost: bestCost };
}

function sitOutRank(a: string, b: string, h: PlayerHistory): number {
  // Mais jogos agendados → senta primeiro
  const playedDiff = (h.played.get(b) ?? 0) - (h.played.get(a) ?? 0);
  if (playedDiff !== 0) return playedDiff;
  // Menos byes → senta primeiro (ainda não descansou)
  return (h.byes.get(a) ?? 0) - (h.byes.get(b) ?? 0);
}

/** Custo global: após esta rodada, quão desigual fica o total de jogos. */
function roundBalanceCost(
  playerIds: string[],
  h: PlayerHistory,
  courts: RandomCourt[],
  byes: string[],
): number {
  const projected = new Map<string, number>();
  for (const id of playerIds) {
    projected.set(id, h.played.get(id) ?? 0);
  }
  for (const court of courts) {
    for (const id of [court.homeA, court.homeB, court.awayA, court.awayB]) {
      projected.set(id, (projected.get(id) ?? 0) + 1);
    }
  }
  // byes stay at current played
  void byes;

  const values = playerIds.map((id) => projected.get(id) ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Soma dos desvios ao mínimo + spread max-min (penaliza gap)
  let sumDev = 0;
  for (const v of values) sumDev += v - min;
  return sumDev * W_ROUND_BALANCE + (max - min) * W_ROUND_BALANCE * 2;
}

function pickSitOuts(playerIds: string[], h: PlayerHistory, count: number): string[] {
  if (count <= 0) return [];
  const ranked = [...playerIds].sort((a, b) => sitOutRank(a, b, h));
  return ranked.slice(0, count);
}

/** Sitouts para REQUIRED: deixar 2M+2F por court; falha se maxCourts=0 com n≥4. */
function pickRequiredMixedActive(
  playerIds: string[],
  h: PlayerHistory,
  genderByPlayer: Map<string, GenderCode>,
): { active: string[]; byes: string[] } | { error: string } {
  const males = playerIds.filter((id) => genderByPlayer.get(id) === "MALE");
  const females = playerIds.filter((id) => genderByPlayer.get(id) === "FEMALE");
  const maxCourts = Math.min(
    Math.floor(males.length / 2),
    Math.floor(females.length / 2),
    Math.floor(playerIds.length / 4),
  );

  if (maxCourts === 0) {
    if (playerIds.length < 4) {
      return { active: [], byes: [...playerIds] };
    }
    return { error: MIXED_REQUIRED_ERROR };
  }

  const needM = 2 * maxCourts;
  const needF = 2 * maxCourts;
  const sitM = [...males].sort((a, b) => sitOutRank(a, b, h)).slice(needM);
  const sitF = [...females].sort((a, b) => sitOutRank(a, b, h)).slice(needF);
  const byes = [...sitM, ...sitF];
  const byeSet = new Set(byes);
  const active = playerIds.filter((id) => !byeSet.has(id));
  return { active, byes };
}

function generateRequiredMixedRound(
  playerIds: string[],
  history: PlayerHistory,
  genderByPlayer: Map<string, GenderCode>,
  trials: number,
): RandomRoundResult {
  const picked = pickRequiredMixedActive(playerIds, history, genderByPlayer);
  if ("error" in picked) return { courts: [], byes: [], error: picked.error };

  const { active, byes } = picked;
  if (active.length < 4) {
    return { courts: [], byes: [...playerIds], error: MIXED_REQUIRED_ERROR };
  }

  const males = active.filter((id) => genderByPlayer.get(id) === "MALE");
  const females = active.filter((id) => genderByPlayer.get(id) === "FEMALE");

  let bestCourts: RandomCourt[] = [];
  let bestCost = Infinity;
  let found = false;

  for (let t = 0; t < trials; t++) {
    const mShuf = [...males];
    const fShuf = [...females];
    shuffleInPlace(mShuf);
    shuffleInPlace(fShuf);

    // Zip into mixed pairs, then pair pairs into courts
    type MixedPair = [string, string];
    const pairs: MixedPair[] = mShuf.map((m, i) => [m, fShuf[i]!]);
    shuffleInPlace(pairs);

    const courts: RandomCourt[] = [];
    let ok = true;
    for (let i = 0; i < pairs.length; i += 2) {
      const [hA, hB] = pairs[i]!;
      const [aA, aB] = pairs[i + 1]!;
      const candidates: RandomCourt[] = [
        { homeA: hA, homeB: hB, awayA: aA, awayB: aB },
        { homeA: aA, homeB: aB, awayA: hA, awayB: hB },
      ];
      let bestLocal: RandomCourt | null = null;
      let bestLocalCost = Infinity;
      for (const court of candidates) {
        const c = courtCost(court, history, genderByPlayer, false);
        if (c < bestLocalCost) {
          bestLocalCost = c;
          bestLocal = court;
        }
      }
      if (!bestLocal) {
        ok = false;
        break;
      }
      courts.push(bestLocal);
    }
    if (!ok) continue;
    found = true;
    const total =
      courts.reduce(
        (acc, court) => acc + courtCost(court, history, genderByPlayer, false),
        0,
      ) + roundBalanceCost(playerIds, history, courts, byes);
    if (total < bestCost) {
      bestCost = total;
      bestCourts = courts;
    }
  }

  if (!found || !bestCourts.length) {
    return { courts: [], byes, error: MIXED_REQUIRED_ERROR };
  }
  return { courts: bestCourts, byes };
}

/**
 * Gera uma rodada: sit-outs se n%4≠0, depois best-of-N shuffles
 * priorizando parceiros/adversários novos (e gênero conforme policy).
 */
export function generateRandomRound(
  playerIds: string[],
  history: PlayerHistory,
  opts?: {
    trials?: number;
    genderByPlayer?: Map<string, GenderCode>;
    mixedPairing?: MixedPairingPolicy;
  },
): RandomRoundResult {
  if (playerIds.length < 4) {
    return { courts: [], byes: [...playerIds] };
  }

  const policy = opts?.mixedPairing ?? "IGNORE";
  const genderByPlayer = opts?.genderByPlayer ?? new Map();
  const trials =
    opts?.trials ??
    (history.played.size === 0 ||
    [...history.played.values()].every((v) => v === 0)
      ? 1
      : 300);

  if (policy === "REQUIRED") {
    return generateRequiredMixedRound(
      playerIds,
      history,
      genderByPlayer,
      Math.max(trials, 50),
    );
  }

  const sitCount = playerIds.length % 4;
  const byes = pickSitOuts(playerIds, history, sitCount);
  const byeSet = new Set(byes);
  const active = playerIds.filter((id) => !byeSet.has(id));
  const preferMixed = policy === "PREFERRED";

  let bestCourts: RandomCourt[] = [];
  let bestCost = Infinity;

  for (let t = 0; t < trials; t++) {
    const shuffled = [...active];
    shuffleInPlace(shuffled);
    const courts: RandomCourt[] = [];
    let courtTotal = 0;
    for (let i = 0; i < shuffled.length; i += 4) {
      const group = shuffled.slice(i, i + 4) as [string, string, string, string];
      const picked = bestCourtForGroup(group, history, {
        genderByPlayer,
        preferMixed,
      });
      if (!picked) continue;
      courts.push(picked.court);
      courtTotal += picked.cost;
    }
    if (courts.length !== active.length / 4) continue;
    const total =
      courtTotal + roundBalanceCost(playerIds, history, courts, byes);
    if (total < bestCost) {
      bestCost = total;
      bestCourts = courts;
    }
  }

  return { courts: bestCourts, byes };
}

/**
 * Pendentes faltantes entre `newPair` e cada `activeOthers`.
 * Conta completed+pending existentes; cria o que faltar até requiredMeetings.
 */
export function fixturesForNewPair(opts: {
  newPairId: string;
  activeOthers: PairRef[];
  existing: ExistingMatch[];
  format: "ROUND_ROBIN" | "ROUND_ROBIN_MULTI" | "BALANCED_QUEUE" | "RANDOM";
  playRounds: number;
  startOrderIndex: number;
  startRound: number;
}): Fixture[] {
  const need = requiredMeetings(opts.format, opts.playRounds);
  if (need === 0) return [];

  const countByOpp = new Map<string, number>();
  for (const m of opts.existing) {
    const other =
      m.pairHomeId === opts.newPairId
        ? m.pairAwayId
        : m.pairAwayId === opts.newPairId
          ? m.pairHomeId
          : null;
    if (!other) continue;
    countByOpp.set(other, (countByOpp.get(other) ?? 0) + 1);
  }

  const fixtures: Fixture[] = [];
  let order = opts.startOrderIndex;
  const scheduled: { pairHomeId: string; pairAwayId: string; round: number }[] =
    opts.existing
      .filter((m) => m.round != null)
      .map((m) => ({
        pairHomeId: m.pairHomeId,
        pairAwayId: m.pairAwayId,
        round: m.round!,
      }));

  for (const opp of opts.activeOthers) {
    const have = countByOpp.get(opp.id) ?? 0;
    for (let k = have; k < need; k++) {
      const swap = (order + k) % 2 === 1;
      const pairHomeId = swap ? opp.id : opts.newPairId;
      const pairAwayId = swap ? opts.newPairId : opp.id;
      const round = nextAvailableRound(scheduled, opts.newPairId, opp.id);
      const fixture = { pairHomeId, pairAwayId, round, orderIndex: order++ };
      fixtures.push(fixture);
      scheduled.push(fixture);
    }
  }

  return fixtures;
}

/** Próxima rodada livre onde ambas as duplas ainda não jogaram. */
export function nextAvailableRound(
  matches: { pairHomeId: string; pairAwayId: string; round: number }[],
  pairA: string,
  pairB: string,
): number {
  const byRound = new Map<number, Set<string>>();
  let maxRound = 0;
  for (const m of matches) {
    maxRound = Math.max(maxRound, m.round);
    const set = byRound.get(m.round) ?? new Set();
    set.add(m.pairHomeId);
    set.add(m.pairAwayId);
    byRound.set(m.round, set);
  }
  for (let r = 1; r <= maxRound; r++) {
    const set = byRound.get(r) ?? new Set();
    if (!set.has(pairA) && !set.has(pairB)) return r;
  }
  return maxRound + 1;
}

export function groupByRound<T extends { round: number }>(items: T[]): { round: number; items: T[] }[] {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const list = map.get(item.round) ?? [];
    list.push(item);
    map.set(item.round, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, roundItems]) => ({ round, items: roundItems }));
}

export function groupMatchesIntoRounds<T extends { round: number; status: string }>(
  matches: T[],
): { round: number; items: T[]; complete: boolean }[] {
  return groupByRound(matches).map(({ round, items }) => ({
    round,
    items: [...items].sort((a, b) => {
      const ao = "orderIndex" in a ? (a as { orderIndex: number }).orderIndex : 0;
      const bo = "orderIndex" in b ? (b as { orderIndex: number }).orderIndex : 0;
      return ao - bo;
    }),
    complete: items.length > 0 && items.every((m) => m.status === "completed"),
  }));
}
