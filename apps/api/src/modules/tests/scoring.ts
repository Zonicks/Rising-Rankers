/**
 * Pure scoring / award helpers — unit-tested without DB.
 */

export type AwardPrize = { rank: number; amount: number };

export type AwardRules = {
  mode: "none" | "fixed" | "pool";
  prizes?: AwardPrize[];
  minAwardPool?: number;
  winnerPercent?: number;
  topBandCount?: number;
  topSharePercent?: number;
};

function asFinite(n: unknown, fallback = 0) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export function resolveAwardRules(raw: unknown, minAwardPool = 0): AwardRules {
  const pool = asFinite(minAwardPool);
  if (raw && typeof raw === "object" && "mode" in raw) {
    const r = raw as AwardRules;
    if (r.mode === "fixed") {
      const prizes = (Array.isArray(r.prizes) ? r.prizes : [])
        .map((p) => ({ rank: Math.round(asFinite(p.rank)), amount: asFinite(p.amount) }))
        .filter((p) => p.rank >= 1 && p.amount > 0)
        .sort((a, b) => a.rank - b.rank);
      return { mode: prizes.length ? "fixed" : "none", prizes };
    }
    if (r.mode === "pool") {
      const min = asFinite(r.minAwardPool, pool);
      return {
        mode: min > 0 ? "pool" : "none",
        minAwardPool: min,
        winnerPercent: Math.min(100, Math.max(1, asFinite(r.winnerPercent, 30))),
        topBandCount: Math.min(100, Math.max(1, Math.round(asFinite(r.topBandCount, 10)))),
        topSharePercent: Math.min(100, Math.max(0, asFinite(r.topSharePercent, 25))),
      };
    }
    return { mode: "none" };
  }
  return pool > 0
    ? { mode: "pool", minAwardPool: pool, winnerPercent: 30, topBandCount: 10, topSharePercent: 25 }
    : { mode: "none" };
}

export function awardPoolTotal(rules: AwardRules) {
  if (rules.mode === "fixed") {
    return (rules.prizes ?? []).reduce((n, p) => n + asFinite(p.amount), 0);
  }
  if (rules.mode === "pool") return asFinite(rules.minAwardPool);
  return 0;
}

export function awardLabel(rules: AwardRules) {
  if (rules.mode === "fixed" && (rules.prizes?.length ?? 0) > 0) {
    return (rules.prizes ?? [])
      .map((p) => `R${p.rank} ₹${p.amount}`)
      .join(" · ");
  }
  if (rules.mode === "pool" && asFinite(rules.minAwardPool) > 0) {
    return `Pool ₹${rules.minAwardPool} · top ${rules.winnerPercent ?? 30}%`;
  }
  return null;
}

export function computeScore(input: {
  correct: number;
  incorrect: number;
  marksPerCorrect: number;
  negativeMark: number;
}) {
  return input.correct * input.marksPerCorrect - input.incorrect * input.negativeMark;
}

export function computeAwardPool(input: {
  participantCount: number;
  entryFee: number;
  platformFeePercent: number;
  minAwardPool: number;
  winnerPercent?: number;
}) {
  const gross = input.participantCount * input.entryFee;
  const fee = (gross * input.platformFeePercent) / 100;
  const subsidy = Math.max(0, input.minAwardPool - gross);
  let net = Math.max(0, gross - fee);
  if (subsidy > 0) {
    net = Math.max(net, input.minAwardPool * (1 - input.platformFeePercent / 100));
  }
  const pct = input.winnerPercent ?? 30;
  return {
    gross,
    fee,
    subsidy,
    net: Math.round(net * 100) / 100,
    winnerCount:
      input.participantCount <= 0 ? 0 : Math.max(1, Math.ceil(input.participantCount * (pct / 100))),
  };
}

export function distributeAwards(input: {
  net: number;
  winnerUserIdsInRankOrder: string[];
  topBandCount?: number;
  topSharePercent?: number;
}) {
  const winners = input.winnerUserIdsInRankOrder;
  if (winners.length === 0) return [];
  const topBandCount = input.topBandCount ?? 10;
  const topSharePercent = input.topSharePercent ?? 25;
  const top10Count = Math.min(topBandCount, winners.length);
  const top10Share = input.net * (topSharePercent / 100);
  const restShare = input.net * (1 - topSharePercent / 100);
  const restCount = Math.max(0, winners.length - top10Count);

  return winners.map((userId, i) => {
    const rank = i + 1;
    let amount = 0;
    if (i < top10Count) amount = top10Count > 0 ? top10Share / top10Count : 0;
    else amount = restCount > 0 ? restShare / restCount : 0;
    return { userId, rank, amount: Math.round(amount * 100) / 100 };
  });
}

export function distributeFixedAwards(input: {
  prizes: AwardPrize[];
  winnerUserIdsInRankOrder: string[];
}) {
  const byRank = new Map(input.prizes.map((p) => [p.rank, asFinite(p.amount)]));
  return input.winnerUserIdsInRankOrder.flatMap((userId, i) => {
    const rank = i + 1;
    const amount = byRank.get(rank);
    if (amount == null || amount <= 0) return [];
    return [{ userId, rank, amount: Math.round(amount * 100) / 100 }];
  });
}

export function isSpeedAnomaly(answeredCount: number, timeTakenMs: number) {
  if (answeredCount < 3) return false;
  return timeTakenMs / answeredCount < 1500;
}
