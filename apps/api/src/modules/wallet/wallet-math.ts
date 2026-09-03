/**
 * Pure wallet math helpers — unit-tested without DB.
 * Ledger persistence stays in wallet.service.
 */

export function clampNonNegative(amount: number) {
  return Math.max(0, amount);
}

export function applyCredit(balance: number, amount: number) {
  if (amount <= 0) throw new Error("CREDIT_AMOUNT_INVALID");
  return Math.round((balance + amount) * 100) / 100;
}

export function applyDebit(balance: number, amount: number) {
  if (amount <= 0) throw new Error("DEBIT_AMOUNT_INVALID");
  if (balance < amount) throw new Error("INSUFFICIENT_BALANCE");
  return Math.round((balance - amount) * 100) / 100;
}
