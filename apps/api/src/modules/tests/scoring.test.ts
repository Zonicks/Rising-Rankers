import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  awardLabel,
  awardPoolTotal,
  computeAwardPool,
  computeScore,
  distributeAwards,
  distributeFixedAwards,
  isSpeedAnomaly,
  resolveAwardRules,
} from "./scoring";

describe("computeScore", () => {
  it("applies marks and negative marking", () => {
    assert.equal(
      computeScore({ correct: 8, incorrect: 2, marksPerCorrect: 1, negativeMark: 0.25 }),
      7.5
    );
  });

  it("returns zero when nothing answered", () => {
    assert.equal(
      computeScore({ correct: 0, incorrect: 0, marksPerCorrect: 1, negativeMark: 0.25 }),
      0
    );
  });
});

describe("computeAwardPool", () => {
  it("subtracts platform fee from gross", () => {
    const pool = computeAwardPool({
      participantCount: 10,
      entryFee: 100,
      platformFeePercent: 10,
      minAwardPool: 0,
    });
    assert.equal(pool.gross, 1000);
    assert.equal(pool.fee, 100);
    assert.equal(pool.net, 900);
    assert.equal(pool.winnerCount, 3);
  });

  it("respects minimum award pool subsidy path", () => {
    const pool = computeAwardPool({
      participantCount: 2,
      entryFee: 10,
      platformFeePercent: 10,
      minAwardPool: 500,
    });
    assert.ok(pool.subsidy > 0);
    assert.ok(pool.net >= 450);
  });
});

describe("distributeAwards", () => {
  it("splits top-10 and rest shares", () => {
    const awards = distributeAwards({
      net: 1000,
      winnerUserIdsInRankOrder: ["a", "b", "c", "d"],
    });
    assert.equal(awards.length, 4);
    // All four are in top-10 band → equal share of 25%? Wait - top10Count = min(10,4)=4
    // so ALL get top10Share/4 = 250/4 = 62.5, restShare unused
    assert.equal(awards[0].amount, 62.5);
    assert.equal(awards[3].rank, 4);
  });

  it("returns empty when no winners", () => {
    assert.deepEqual(distributeAwards({ net: 100, winnerUserIdsInRankOrder: [] }), []);
  });
});

describe("fixed prizes", () => {
  it("pays only configured ranks", () => {
    const awards = distributeFixedAwards({
      prizes: [
        { rank: 1, amount: 500 },
        { rank: 3, amount: 100 },
      ],
      winnerUserIdsInRankOrder: ["a", "b", "c", "d"],
    });
    assert.deepEqual(awards, [
      { userId: "a", rank: 1, amount: 500 },
      { userId: "c", rank: 3, amount: 100 },
    ]);
  });

  it("labels and totals a prize list", () => {
    const rules = resolveAwardRules(
      { mode: "fixed", prizes: [{ rank: 1, amount: 500 }, { rank: 2, amount: 200 }] },
      0
    );
    assert.equal(awardPoolTotal(rules), 700);
    assert.equal(awardLabel(rules), "R1 ₹500 · R2 ₹200");
  });
});

describe("isSpeedAnomaly", () => {
  it("flags sub-1.5s per answer when enough answers", () => {
    assert.equal(isSpeedAnomaly(5, 5000), true);
    assert.equal(isSpeedAnomaly(5, 10000), false);
    assert.equal(isSpeedAnomaly(2, 1000), false);
  });
});
