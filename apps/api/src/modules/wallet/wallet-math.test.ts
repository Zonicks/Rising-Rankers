import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyCredit, applyDebit, clampNonNegative } from "./wallet-math";

describe("wallet-math", () => {
  it("credits and debits with 2dp rounding", () => {
    assert.equal(applyCredit(10, 2.555), 12.56);
    assert.equal(applyDebit(12.56, 2.56), 10);
  });

  it("rejects invalid amounts and overdraft", () => {
    assert.throws(() => applyCredit(1, 0), /CREDIT/);
    assert.throws(() => applyDebit(5, 6), /INSUFFICIENT/);
  });

  it("clamps negatives", () => {
    assert.equal(clampNonNegative(-3), 0);
  });
});
