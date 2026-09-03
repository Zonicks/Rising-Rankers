"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api, tokenKey } from "@/lib/api";

export default function WalletPage() {
  const router = useRouter();
  const [balances, setBalances] = useState<Record<string, string> | null>(null);
  const [ledger, setLedger] = useState<Array<Record<string, string>>>([]);
  const [amount, setAmount] = useState(100);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [wdAmount, setWdAmount] = useState(100);
  const [upi, setUpi] = useState("");

  async function refresh(token: string) {
    const [b, l] = await Promise.all([
      api<Record<string, string>>("/api/v1/wallet", { token }),
      api<Array<Record<string, string>>>("/api/v1/wallet/ledger", { token }),
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
      await refresh(token);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Deposit failed");
    }
  }

  async function withdraw(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    setErr(null);
    try {
      await api("/api/v1/withdrawals", {
        method: "POST",
        token,
        body: JSON.stringify({ amount: wdAmount, method: "UPI", destination: upi }),
      });
      setMsg("Withdrawal requested");
      await refresh(token);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Withdrawal failed");
    }
  }

  return (
    <AppShell title="Wallet" subtitle="Awards can be withdrawn. Deposits and promo stay in their own buckets.">
      {msg ? <p className="msg-ok mb-4">{msg}</p> : null}
      {err ? <p className="msg-err mb-4">{err}</p> : null}

      <div className="hero-wallet p-7">
        <p className="text-sm text-white/65">Award balance</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight">₹{balances?.award ?? "—"}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/15 pt-5">
          <div>
            <p className="text-xs text-white/50">Deposited</p>
            <p className="mt-1 text-lg font-semibold">₹{balances?.deposited ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-white/50">Promo</p>
            <p className="mt-1 text-lg font-semibold">₹{balances?.promo ?? "—"}</p>
          </div>
        </div>
      </div>

      <form onSubmit={deposit} className="card mt-6 space-y-3 p-6">
        <h2 className="font-semibold">Sandbox deposit</h2>
        <p className="text-sm text-[var(--ink-soft)]">Credits the deposited bucket instantly in this environment.</p>
        <label className="label">Amount (₹)</label>
        <input
          type="number"
          className="field"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <button className="btn-primary w-full">Deposit (sandbox success)</button>
      </form>

      <form onSubmit={withdraw} className="card mt-4 space-y-3 p-6">
        <h2 className="font-semibold">Withdraw awards</h2>
        <label className="label">Amount (₹)</label>
        <input
          type="number"
          className="field"
          value={wdAmount}
          onChange={(e) => setWdAmount(Number(e.target.value))}
        />
        <label className="label">UPI ID</label>
        <input
          className="field"
          placeholder="name@upi"
          value={upi}
          onChange={(e) => setUpi(e.target.value)}
          required
        />
        <button className="btn-secondary w-full">Request withdrawal</button>
      </form>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
        Ledger
      </h2>
      {ledger.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No movements yet.</p>
      ) : (
        <ul className="card mt-3 divide-y divide-[var(--line)]">
          {ledger.map((row) => (
            <li key={row.id} className="flex justify-between px-5 py-3 text-sm">
              <span className="text-[var(--ink-soft)]">{row.type}</span>
              <span className="font-semibold">₹{row.amount}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm">
        <Link href="/legal/faq" className="font-semibold text-[var(--accent)]">
          Wallet FAQ
        </Link>
      </p>
    </AppShell>
  );
}
