"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { IconQuiz } from "@/components/icons";
import { TestsSkeleton } from "@/components/skeleton";
import { api, tokenKey } from "@/lib/api";

type CatalogTest = {
  id: string;
  title: string;
  subject: string | null;
  kind: "daily" | "practice" | "live";
  durationMinutes: number;
  entryFee: number;
  priceLabel: string;
  chargeAmount: number;
  awardPool: boolean;
  awardLabel?: string | null;
  questionCount: number;
  completed: boolean;
  scorePct: number | null;
  cta: "start" | "retake" | "result" | "ended" | "resume";
  remainingSeconds?: number | null;
  status: string;
};

type Catalog = {
  featured: CatalogTest | null;
  tests: CatalogTest[];
  subjects: string[];
};

type QuizStats = {
  days: Array<{ date: string; scorePct: number | null }>;
  avgScore: number | null;
  accuracy: number | null;
  weakSubject: string | null;
  results: Array<{
    testId: string;
    title: string;
    subject: string | null;
    scorePct: number;
    accuracy: number | null;
    rank: number | null;
    submittedAt: string | null;
  }>;
};

type TrackerSubject = { id: string; name: string };

export default function TestsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"available" | "results">("available");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [stats, setStats] = useState<QuizStats | null>(null);
  const [subjects, setSubjects] = useState<TrackerSubject[]>([]);
  const [filter, setFilter] = useState("All");
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<CatalogTest | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return router.replace("/auth");
    try {
      const [cat, st, tracker] = await Promise.all([
        api<Catalog>("/api/v1/tests", { token }),
        api<QuizStats>("/api/v1/me/quiz-stats", { token }),
        api<{ subjects: TrackerSubject[] }>("/api/v1/me/tracker", { token }).catch(() => ({
          subjects: [] as TrackerSubject[],
        })),
      ]);
      setCatalog(cat);
      setStats(st);
      setSubjects(tracker.subjects ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load tests");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const list = catalog?.tests ?? [];
    if (filter === "All") return list;
    return list.filter((t) => t.subject === filter);
  }, [catalog, filter]);

  async function start(test: CatalogTest) {
    if (test.cta === "result") {
      router.push(`/app/tests/${test.id}`);
      return;
    }
    if (test.cta === "ended") return;
    if (test.cta === "resume") {
      await join(test);
      return;
    }
    if (test.chargeAmount > 0) {
      setConfirm(test);
      setPayError(null);
      return;
    }
    await join(test);
  }

  async function join(test: CatalogTest) {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    setBusy(true);
    setMsg(null);
    setPayError(null);
    try {
      await api(`/api/v1/tests/${test.id}/join`, { method: "POST", token });
      setConfirm(null);
      router.push(`/app/tests/${test.id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not start";
      setMsg(message);
      if (confirm) setPayError(message);
      else setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  const featured = catalog?.featured;
  const maxBar = Math.max(1, ...(stats?.days.map((d) => d.scorePct ?? 0) ?? [1]));

  if (!catalog) {
    return (
      <AppShell wide>
        {msg ? <p className="msg-err">{msg}</p> : <TestsSkeleton />}
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <div className="grid grid-cols-2 rounded-2xl bg-[var(--accent-soft)] p-1">
        {(["available", "results"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              tab === t ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--ink-soft)]"
            }`}
          >
            {t === "available" ? "Available" : "Results"}
          </button>
        ))}
      </div>

      {msg ? <p className="msg-err mt-4">{msg}</p> : null}

      {tab === "available" ? (
        <>
          {featured ? (
            <section className="hero-progress relative mt-8 overflow-hidden p-8">
              <div className="relative flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--gold)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[var(--deep)]">
                  {featured.kind === "live" ? "Live" : featured.kind === "daily" ? "Daily" : "Featured"}
                </span>
                {featured.cta === "resume" && featured.remainingSeconds != null ? (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold tracking-widest text-white">
                    {formatRemain(featured.remainingSeconds)} left
                  </span>
                ) : null}
              </div>
              <h1 className="relative mt-4 max-w-[16rem] text-3xl font-extrabold leading-tight">{featured.title}</h1>
              <p className="relative mt-2 text-sm text-white/80">
                {featured.durationMinutes} mins · {featured.questionCount} Qs
              </p>
              <div className="relative mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold">
                  {featured.priceLabel}
                </span>
                {featured.awardPool ? (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                    {featured.awardLabel ?? "Award pool"}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busy || featured.cta === "ended"}
                onClick={() => start(featured)}
                className="relative mt-6 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[var(--accent)] shadow-xl disabled:opacity-60"
              >
                {labelForCta(featured.cta)}
              </button>
            </section>
          ) : null}

          <section className="mt-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Subject focus</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["All", ...(catalog?.subjects ?? [])].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold ${
                    filter === s
                      ? "bg-[var(--accent)] text-white"
                      : "bg-white text-[var(--ink-soft)] shadow-[var(--shadow-card)]"
                  }`}
                >
                  {s === "All" ? "All Topics" : s}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-6 space-y-3">
            {filtered.map((t) => (
              <div
                key={t.id}
                className={`card p-5 ${t.completed && t.cta === "result" ? "opacity-70" : ""}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <IconQuiz className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{t.title}</p>
                      <p className="mt-1 text-xs font-medium text-[var(--ink-soft)]">
                        {t.durationMinutes} Mins · {t.questionCount} Questions
                        {t.completed && t.scorePct != null ? ` · Score ${t.scorePct}%` : ""}
                        {t.cta === "resume" && t.remainingSeconds != null
                          ? ` · ${Math.ceil(t.remainingSeconds / 60)} min left`
                          : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                            t.priceLabel === "FREE"
                              ? "bg-[#4edea3]/25 text-[#027a48]"
                              : "bg-[var(--gold)] text-[var(--deep)]"
                          }`}
                        >
                          {t.cta === "retake" && t.chargeAmount === 0 ? "Retake free" : t.priceLabel}
                        </span>
                        {t.awardPool ? (
                          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent)]">
                            {t.awardLabel ?? "Award pool"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || t.cta === "ended"}
                    onClick={() => start(t)}
                    className={`rounded-2xl px-6 py-3 text-sm font-bold ${
                      t.cta === "start" || t.cta === "resume"
                        ? "border border-[var(--accent)]/20 text-[var(--accent)]"
                        : "bg-[#e6e8ea] text-[var(--ink-soft)]"
                    }`}
                  >
                    {labelForCta(t.cta)}
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 ? (
              <p className="card p-6 text-[var(--ink-soft)]">No tests in this subject yet.</p>
            ) : null}
          </section>

          <DailyPerformance stats={stats} maxBar={maxBar} />
        </>
      ) : (
        <section className="mt-8 space-y-3">
          {(stats?.results ?? []).length === 0 ? (
            <p className="card p-6 text-[var(--ink-soft)]">No attempts yet. Start a test from Available.</p>
          ) : (
            stats!.results.map((r, i) => (
              <Link key={`${r.testId}-${i}`} href={`/app/tests/${r.testId}`} className="card block p-4 no-underline sm:p-6">
                <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-lg font-extrabold text-[var(--accent)] sm:h-[4.75rem] sm:w-[4.75rem] sm:rounded-3xl sm:text-xl">
                    {r.scorePct}%
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-[var(--ink)] sm:text-lg">{r.title}</p>
                    <p className="mt-1 text-xs text-[var(--ink-soft)] sm:text-sm">
                      {r.subject ?? "Mixed"} · Accuracy {r.accuracy ?? "—"}%
                      {r.rank ? ` · Rank ${r.rank}` : ""}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--accent-soft)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${Math.min(100, r.scorePct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
          <DailyPerformance stats={stats} maxBar={maxBar} />
        </section>
      )}

      <button
        type="button"
        onClick={() => setCustomOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-2xl font-light text-white shadow-[var(--shadow-lift)] md:bottom-10"
        aria-label="Custom quiz"
      >
        +
      </button>

      {confirm ? (
        <ViewportDialog onClose={() => !busy && setConfirm(null)}>
          <div className="bg-gradient-to-br from-[#050b18] via-[#0c1b3d] to-[#1e4fc4] px-6 py-6 text-white">
            <p className="page-kicker">Confirm entry</p>
            <h2 className="mt-2 font-headline text-xl font-extrabold tracking-tight">{confirm.title}</h2>
            <p className="mt-4 font-headline text-4xl font-extrabold tracking-tight text-[var(--gold)]">
              ₹{confirm.chargeAmount}
            </p>
            <p className="mt-2 text-sm text-white/70">Debited from your deposited wallet.</p>
          </div>
          <div className="p-6">
            {payError ? <p className="msg-err mb-4">{payError}</p> : null}
            <div className="flex gap-3">
              <button type="button" className="btn-secondary flex-1" disabled={busy} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" disabled={busy} className="btn-primary flex-1" onClick={() => void join(confirm)}>
                {busy ? "Paying…" : `Pay ₹${confirm.chargeAmount}`}
              </button>
            </div>
          </div>
        </ViewportDialog>
      ) : null}

      {customOpen ? (
        <ViewportDialog onClose={() => setCustomOpen(false)}>
          <div className="p-6">
          <p className="page-kicker">Custom quiz</p>
          <h2 className="mt-2 text-xl font-bold">10-question practice</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Uses your daily MCQ quota (or a paid unlock if you have none left).
          </p>
          <div className="mt-5 space-y-2">
            {subjects.map((s) => (
              <Link
                key={s.id}
                href={`/app/mcq?subjectId=${s.id}`}
                className="btn-secondary flex w-full"
                onClick={() => setCustomOpen(false)}
              >
                {s.name}
              </Link>
            ))}
            {subjects.length === 0 ? (
              <Link href="/app/mcq" className="btn-primary flex w-full" onClick={() => setCustomOpen(false)}>
                Start mixed practice
              </Link>
            ) : null}
          </div>
          <button type="button" className="mt-4 w-full text-sm font-semibold text-[var(--muted)]" onClick={() => setCustomOpen(false)}>
            Close
          </button>
          </div>
        </ViewportDialog>
      ) : null}
    </AppShell>
  );
}

function formatRemain(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function labelForCta(cta: CatalogTest["cta"]) {
  if (cta === "retake") return "Retake";
  if (cta === "result") return "View result";
  if (cta === "ended") return "Ended";
  if (cta === "resume") return "Resume";
  return "Start Test";
}

function DailyPerformance({ stats, maxBar }: { stats: QuizStats | null; maxBar: number }) {
  if (!stats) return null;
  return (
    <section className="card mt-10 p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="page-kicker">Last 7 days</p>
          <h2 className="mt-2 text-2xl font-extrabold">Daily Performance</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Submitted tests</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-[var(--accent)]">
            {stats.avgScore ?? "—"}
            <span className="text-lg font-bold text-[var(--muted)]">/100</span>
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Avg. score</p>
        </div>
      </div>
      <div className="mt-6 flex h-28 items-end justify-between gap-2">
        {stats.days.map((d) => (
          <div
            key={d.date}
            className="w-full rounded-t-xl bg-[var(--accent)]"
            style={{
              height: `${Math.max(8, ((d.scorePct ?? 0) / maxBar) * 100)}%`,
              opacity: d.scorePct == null ? 0.15 : 0.2 + ((d.scorePct ?? 0) / 100) * 0.8,
            }}
            title={`${d.date}: ${d.scorePct ?? "—"}`}
          />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-3xl bg-[var(--bg)] p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Accuracy</p>
          <p className="mt-1 text-xl font-bold text-[#027a48]">{stats.accuracy ?? "—"}%</p>
        </div>
        <div className="rounded-3xl bg-[var(--bg)] p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Weak area</p>
          <p className="mt-1 text-xl font-bold text-[var(--danger)]">{stats.weakSubject ?? "—"}</p>
        </div>
      </div>
    </section>
  );
}

function ViewportDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!ready) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-md overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
