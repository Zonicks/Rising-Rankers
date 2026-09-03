import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canSetStatus, maskEmail, maskIp, maskMobile, permissionsFor } from "./admin-users.policy";

describe("admin-users policy", () => {
  it("masks email and mobile", () => {
    assert.equal(maskEmail("student@learning.local"), "s***@learning.local");
    assert.equal(maskMobile("9876543210"), "98****10");
    assert.equal(maskMobile(null), null);
    assert.equal(maskIp("203.0.113.45"), "203.0.113.***");
  });

  it("lets support suspend and restore, but not block", () => {
    assert.equal(canSetStatus("SUPPORT_ADMIN", "ACTIVE", "SUSPENDED"), true);
    assert.equal(canSetStatus("SUPPORT_ADMIN", "SUSPENDED", "ACTIVE"), true);
    assert.equal(canSetStatus("SUPPORT_ADMIN", "ACTIVE", "BLOCKED"), false);
    assert.equal(canSetStatus("SUPPORT_ADMIN", "ACTIVE", "WITHDRAWAL_RESTRICTED"), false);
    assert.equal(permissionsFor("SUPPORT_ADMIN").canReveal, true);
  });

  it("lets finance only restrict or restore withdrawals", () => {
    assert.equal(canSetStatus("FINANCE_ADMIN", "ACTIVE", "WITHDRAWAL_RESTRICTED"), true);
    assert.equal(canSetStatus("FINANCE_ADMIN", "WITHDRAWAL_RESTRICTED", "ACTIVE"), true);
    assert.equal(canSetStatus("FINANCE_ADMIN", "SUSPENDED", "ACTIVE"), false);
    assert.equal(canSetStatus("FINANCE_ADMIN", "ACTIVE", "BLOCKED"), false);
  });

  it("lets super-admin set every U1 status", () => {
    assert.equal(canSetStatus("SUPER_ADMIN", "ACTIVE", "BLOCKED"), true);
    assert.equal(canSetStatus("SUPER_ADMIN", "BLOCKED", "ACTIVE"), true);
    assert.equal(canSetStatus("READ_ONLY", "ACTIVE", "SUSPENDED"), false);
  });
});
