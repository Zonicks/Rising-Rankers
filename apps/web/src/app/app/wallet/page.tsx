"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WalletSkeleton } from "@/components/skeleton";
import { api, tokenKey } from "@/lib/api";

type LedgerRow = {
  id: string;
  type: string;
  amount: string;
  balanceBucket?: string;
  createdAt?: string;
};

function prettyType(type: string) {
  return type.replaceAll("_", " ");
}

function isAwardLine(row: LedgerRow) {
  return row.balanceBucket === "award" || row.type === "AWARD_CREDIT";
}

export default function WalletPage() {
  const router = useRouter();
  const [balances, setBalances] = useState<Record<string, string> | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [amount, setAmount] = useState(100);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [wdAmount, setWdAmount] = useState(100);
  const [upi, setUpi] = useState("");
  const [sheet, setSheet] = useState<"deposit" | "withdraw" | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(token: string) {
    const [b, l] = await Promise.all([
      api<Record<string, string>>("/api/v1/wallet", { token }),
      api<LedgerRow[]>("/api/v1/wallet/ledger", { token }),
    ]);
    setBalances(b);
    setLedger(l);
  }

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return router.replace("/auth");
    refresh(token).catch(() => router.replace("/auth"));
  }, [router]);

  async function deposit(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    setErr(null);
    setBusy(true);
    try {
      const payment = await api<{ paymentId: string }>("/api/v1/wallet/deposit", {
        method: "POST",
        token,
        body: JSON.stringify({ amount }),
      });
      const confirmed = await api<{ balances: Record<string, string> }>(
        "/api/v1/payments/sandbox/confirm",
        {
          method: "POST",
          token,
          body: JSON.stringify({ paymentId: payment.paymentId, status: "SUCCESSFUL" }),
        }
      );
      setBalances(confirmed.balances);
      setMsg(`Sandbox deposit successful · ₹${amount}`);
      setSheet(null);
      await refresh(token);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    setErr(null);
    setBusy(true);
    try {
      await api("/api/v1/withdrawals", {
        method: "POST",
        token,
        body: JSON.stringify({ amount: wdAmount, method: "UPI", destination: upi }),
      });
      setMsg("Withdrawal requested");
      setSheet(null);
      await refresh(token);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Withdrawal failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell overline="Award" title="Wallet" subtitle="Awards can be withdrawn. Deposits and promo stay in their own buckets.">
      {msg ? <p className="msg-ok mb-4">{msg}</p> : null}
      {err && !sheet ? <p className="msg-err mb-4">{err}</p> : null}

      {!balances ? (
        <WalletSkeleton />
      ) : (
        <>
      <div className="hero-wallet p-7">
        <div className="relative flex items-center justify-between gap-3">
          <p className="page-kicker">Award</p>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold tracking-widest text-white">
            Scholarship
          </span>
        </div>
        <p className="relative mt-3 font-headline text-5xl font-extrabold tracking-tight text-[var(--gold)]">
          ₹{balances?.award ?? "—"}
        </p>
        <div className="relative mt-8 grid grid-cols-2 gap-4 border-t border-white/15 pt-5">
          <div>
            <p className="text-xs text-white/50">Deposited</p>
            <p className="mt-1 font-headline text-lg font-extrabold">₹{balances?.deposited ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-white/50">Promo</p>
            <p className="mt-1 font-headline text-lg font-extrabold">₹{balances?.promo ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" className="focus-tile min-h-[8.5rem]" onClick={() => { setErr(null); setSheet("deposit"); }}>
          <p className="page-kicker">Sandbox</p>
          <span>
            <span className="mt-3 block font-headline text-xl font-extrabold tracking-tight">Deposit</span>
            <span className="mt-1 block text-xs font-medium text-[var(--ink-soft)]">Test credits, not a live gateway</span>
          </span>
        </button>
        <button type="button" className="focus-tile min-h-[8.5rem]" onClick={() => { setErr(null); setSheet("withdraw"); }}>
          <p className="page-kicker">Award</p>
          <span>
            <span className="mt-3 block font-headline text-xl font-extrabold tracking-tight">Withdraw</span>
            <span className="mt-1 block text-xs font-medium text-[var(--ink-soft)]">From Award only, after review</span>
          </span>
        </button>
      </div>

      <p className="section-label mt-10">Ledger</p>
      {ledger.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No movements yet.</p>
      ) : (
        <ul className="card mt-3 divide-y divide-[var(--line)]">
          {ledger.map((row) => {
            const award = isAwardLine(row);
            return (
              <li
                key={row.id}
                className={`flex items-baseline justify-between gap-4 px-5 py-3.5 text-sm ${
                  award ? "bg-[#FBF6DC]/55" : ""
                }`}
              >
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    {prettyType(row.type)}
                  </span>
                  {row.createdAt ? (
                    <span className="mt-0.5 block text-[11px] text-[var(--ink-soft)]">
                      {row.createdAt.slice(0, 10)}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`font-headline text-base font-extrabold tabular-nums ${
                    award ? "text-[var(--deep)]" : "text-[var(--ink)]"
                  }`}
                >
                  ₹{row.amount}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-sm">
        <Link href="/legal/faq" className="font-semibold text-[var(--accent)]">
          Wallet FAQ
        </Link>
      </p>
        </>
      )}

      {sheet === "deposit" ? (
        <div className="sheet-scrim" role="dialog" aria-modal="true">
          <form onSubmit={deposit} className="sheet-panel rounded-[2rem] sm:rounded-[2rem]">
            <div className="sheet-handle sm:hidden" />
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-5">
              <p className="page-kicker">Sandbox</p>
              <h2 className="mt-2 font-headline text-xl font-extrabold tracking-tight">Deposit</h2>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                Credits the deposited bucket instantly. This is a sandbox success — not a live payment.
              </p>
              {err ? <p className="msg-err mt-4">{err}</p> : null}
              <label className="label mt-5" htmlFor="deposit-amount">
                Amount (₹)
              </label>
              <input
                id="deposit-amount"
                type="number"
                className="field"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="flex gap-3 px-6 py-5">
              <button type="button" className="btn-secondary flex-1" onClick={() => setSheet(null)}>
                Cancel
              </button>
              <button disabled={busy} className="btn-primary flex-1">
                {busy ? "Depositing…" : "Deposit"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {sheet === "withdraw" ? (
        <div className="sheet-scrim" role="dialog" aria-modal="true">
          <form onSubmit={withdraw} className="sheet-panel rounded-[2rem] sm:rounded-[2rem]">
            <div className="sheet-handle sm:hidden" />
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-5">
              <p className="page-kicker">Award</p>
              <h2 className="mt-2 font-headline text-xl font-extrabold tracking-tight">Withdraw</h2>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                Award only. A finance admin reviews each request. Promo and deposited cannot be withdrawn.
              </p>
              {err ? <p className="msg-err mt-4">{err}</p> : null}
              <label className="label mt-5" htmlFor="wd-amount">
                Amount (₹)
              </label>
              <input
                id="wd-amount"
                type="number"
                className="field"
                min={1}
                value={wdAmount}
                onChange={(e) => setWdAmount(Number(e.target.value))}
              />
              <label className="label mt-4" htmlFor="upi">
                UPI ID
              </label>
              <input
                id="upi"
                className="field"
                placeholder="name@upi"
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-3 px-6 py-5">
              <button type="button" className="btn-secondary flex-1" onClick={() => setSheet(null)}>
                Cancel
              </button>
              <button disabled={busy} className="btn-primary flex-1">
                {busy ? "Requesting…" : "Request withdrawal"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
