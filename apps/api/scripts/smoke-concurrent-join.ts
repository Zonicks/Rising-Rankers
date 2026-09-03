#!/usr/bin/env tsx
/**
 * Concurrent join smoke — run with API up and a SCHEDULED/OPEN test id.
 *
 *   pnpm --filter @learning/api smoke:join -- <testId> <tokenA> <tokenB>
 */
const base = process.env.API_URL ?? "http://localhost:4000";
const [, , testId, tokenA, tokenB] = process.argv;

if (!testId || !tokenA || !tokenB) {
  console.error("Usage: smoke:join <testId> <jwtA> <jwtB>");
  process.exit(1);
}

async function join(token: string, label: string) {
  const res = await fetch(`${base}/api/v1/tests/${testId}/join`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await res.json();
  return { label, status: res.status, body };
}

const results = await Promise.all([join(tokenA, "A"), join(tokenB, "B")]);
console.log(JSON.stringify(results, null, 2));
const ok = results.every((r) => r.status === 200 || r.status === 201 || r.status === 400);
process.exit(ok ? 0 : 1);
