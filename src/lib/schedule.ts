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
  format: "ROUND_ROBIN" | "ROUND_ROBIN_MULTI" | "BALANCED_QUEUE",
  playRounds: number,
): number {
  if (format === "BALANCED_QUEUE") return 0;
  if (format === "ROUND_ROBIN_MULTI") return playRounds;
  return 1;
}

/**
 * Pendentes faltantes entre `newPair` e cada `activeOthers`.
 * Conta completed+pending existentes; cria o que faltar até requiredMeetings.
 */
export function fixturesForNewPair(opts: {
  newPairId: string;
  activeOthers: PairRef[];
  existing: ExistingMatch[];
  format: "ROUND_ROBIN" | "ROUND_ROBIN_MULTI" | "BALANCED_QUEUE";
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
