"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api, tokenKey } from "@/lib/api";

const CATEGORIES = [
  "Payment",
  "Wallet",
  "Withdrawal",
  "Question error",
  "Test issue",
  "Account",
  "Privacy",
  "Other",
] as const;

type Ticket = {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

const chip: Record<string, string> = {
  OPEN: "chip",
  IN_PROGRESS: "chip bg-[var(--gold-soft,#f8f1e3)] text-[var(--gold)]",
  RESOLVED: "chip bg-[var(--success-soft)] text-[var(--success)]",
  CLOSED: "chip bg-[var(--bg)] text-[var(--muted)]",
};

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [officer, setOfficer] = useState<{ name: string | null; email: string | null; phone: string | null } | null>(
    null
  );

  async function load(token: string) {
    const rows = await api<Ticket[]>("/api/v1/support/tickets/me", { token });
    setTickets(rows);
  }

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      router.replace("/auth");
      return;
    }
    load(token)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load tickets"))
      .finally(() => setLoading(false));
    api<{ name: string | null; email: string | null; phone: string | null }>("/api/v1/public/grievance")
      .then(setOfficer)
      .catch(() => setOfficer(null));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await api("/api/v1/support/tickets", {
        method: "POST",
        token,
        body: JSON.stringify({ category, subject: subject.trim(), message: message.trim() }),
      });
      setSubject("");
      setMessage("");
      setMsg("Ticket sent. We’ll update the status here.");
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send ticket");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="Support">
        <p className="text-sm text-[var(--muted)]">Loading support…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Support"
      subtitle="Report a payment, wallet, test, or account issue."
    >
      <p className="mb-6 text-sm text-[var(--ink-soft)]">
        You can also read the{" "}
        <Link href="/legal/faq" className="font-semibold text-[var(--accent)]">
          FAQ
        </Link>
        .
      </p>
      {officer?.name || officer?.email ? (
        <div className="card mb-6 p-5 text-sm text-[var(--ink-soft)]">
          <p className="font-semibold text-[var(--ink)]">Grievance officer</p>
          <p className="mt-1">
            {officer.name ?? "Named officer"}
            {officer.email ? ` · ${officer.email}` : ""}
            {officer.phone ? ` · ${officer.phone}` : ""}
          </p>
          <p className="mt-2">
            For a privacy complaint, pick the Privacy category. We aim to close those within 90 days.
          </p>
        </div>
      ) : null}

      {error ? <p className="msg-err mb-4">{error}</p> : null}
      {msg ? <p className="msg-ok mb-4">{msg}</p> : null}

      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        <div>
          <label className="label">Category</label>
          <select
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Subject</label>
          <input
            className="field"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={160}
            required
          />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea
            className="textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            required
          />
        </div>
        <button disabled={busy} className="btn-primary w-full">
          {busy ? "Sending…" : "Send ticket"}
        </button>
      </form>

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
        Your tickets
      </h2>
      {tickets.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No tickets yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {tickets.map((t) => (
            <li key={t.id} className="card p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold">{t.subject}</p>
                <span className={chip[t.status] ?? "chip"}>{t.status.replaceAll("_", " ")}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {t.category} · {new Date(t.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">{t.message}</p>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
