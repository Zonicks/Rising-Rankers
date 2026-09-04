"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { IconArticle, IconCards, IconChevron, IconQuiz, IconSearch } from "@/components/icons";
import { HomeSkeleton } from "@/components/skeleton";
import { api, tokenKey } from "@/lib/api";

type Progress = {
  program: { name: string } | null;
  streakCount: number;
  completion: { pct: number; touchedModules: number; totalModules: number };
  daily: {
    quizQuestions: number;
    quizMinutes: number;
    flashGoal: number;
    flashRemaining: number;
    unreadArticles: number;
  };
  subjects: Array<{
    id: string;
    name: string;
    masteryPct: number | null;
    reliable: boolean;
  }>;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function StudentAppHome() {
  const router = useRouter();
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      router.replace("/auth");
      return;
    }
    api<Progress>("/api/v1/me/progress", { token })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [router]);

  const completion = data?.completion;
  const daily = data?.daily;

  if (!data && error) {
    return (
      <AppShell>
        <p className="msg-err">{error}</p>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <HomeSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="hero-progress p-8">
        <p className="page-kicker">Syllabus coverage</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Syllabus Completion</h1>
        <div className="mt-6 flex items-end justify-between">
          <span className="text-4xl font-bold">{completion?.pct ?? 0}%</span>
          <span className="text-sm text-white/80">
            {completion?.touchedModules ?? 0} of {completion?.totalModules ?? 0} Modules
          </span>
        </div>
        <div className="progress-track mt-3">
          <div className="progress-fill" style={{ width: `${completion?.pct ?? 0}%` }} />
        </div>
        {data?.program?.name ? (
          <p className="mt-4 text-xs font-medium text-white/65">{data.program.name}</p>
        ) : null}
      </section>

      {error ? <p className="msg-err mt-6">{error}</p> : null}

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          const q = new FormData(e.currentTarget).get("q");
          if (typeof q === "string" && q.trim().length >= 2) {
            router.push(`/app/search?q=${encodeURIComponent(q.trim())}`);
          } else {
            router.push("/app/search");
          }
        }}
      >
        <label className="sr-only" htmlFor="home-search">
          Search books and authors
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            id="home-search"
            name="q"
            className="w-full rounded-[24px] border border-[var(--ghost)] bg-[var(--bg-elevated)] py-3.5 pl-14 pr-4 text-base shadow-[var(--shadow-card)] outline-none focus:border-[var(--accent)]"
            placeholder="Search Laxmikanth, Spectrum, or HC Verma"
          />
        </div>
      </form>

      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-headline text-xl font-extrabold tracking-tight">Daily Focus</h2>
          <Link href="/app/study" className="text-sm font-semibold text-[var(--ink-soft)]">
            View schedule
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/app/tests"
            className="hero-progress col-span-2 flex items-center justify-between p-6 no-underline"
          >
            <div className="relative flex items-center gap-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-[var(--gold)]">
                <IconQuiz className="h-8 w-8" />
              </div>
              <div>
                <p className="page-kicker">Quiz</p>
                <p className="mt-1 text-lg font-bold text-white">Daily Quiz</p>
                <p className="text-sm font-medium text-white/70">
                  {daily?.quizQuestions ?? 20} Questions · {daily?.quizMinutes ?? 15} Mins
                </p>
              </div>
            </div>
            <IconChevron className="relative h-6 w-6 shrink-0 text-white/70" />
          </Link>
          <Link href="/app/flashcards" className="focus-tile no-underline">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#4edea3]/20 text-[#027a48]">
              <IconCards className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold leading-tight text-[var(--ink)]">Flashcard Session</p>
              <p className="mt-1 text-xs font-medium text-[var(--ink-soft)]">
                {daily?.flashRemaining ?? 0} left today
              </p>
            </div>
          </Link>
          <Link href="/app/news" className="focus-tile no-underline">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <IconArticle className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold leading-tight text-[var(--ink)]">Current Affairs</p>
              <p className="mt-1 text-xs font-medium text-[var(--ink-soft)]">
                {daily?.unreadArticles ?? 0} unread
              </p>
            </div>
          </Link>
        </div>
      </section>

      <Link
        href="/app/leaderboard"
        className="card mt-8 flex items-center justify-between p-5 no-underline shadow-[var(--shadow-card)]"
      >
        <div>
          <p className="page-kicker">City board</p>
          <p className="mt-1 font-bold text-[var(--ink)]">Leaderboard</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Initials, city, and points — same program.</p>
        </div>
        <IconChevron className="h-5 w-5 text-[var(--muted)]" />
      </Link>

      <section className="mt-10">
        <h2 className="mb-5 font-headline text-xl font-extrabold tracking-tight">Subject Mastery</h2>
        <div className="space-y-3">
          {(data?.subjects ?? []).length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">No subjects in your curriculum yet.</p>
          ) : (
            data!.subjects.map((s) => {
              const shown = s.reliable ? s.masteryPct ?? 0 : s.masteryPct ?? 0;
              const label = s.masteryPct == null ? "—" : `${shown}%`;
              return (
                <Link key={s.id} href={`/app/study?subjectId=${s.id}`} className="card block p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
                        {initials(s.name)}
                      </span>
                      <span className="font-bold">{s.name}</span>
                    </div>
                    <span
                      className={`text-sm font-bold ${s.reliable ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
                    >
                      {label}
                    </span>
                  </div>
                  <div className="progress-track-thin">
                    <div
                      className={s.reliable ? "progress-fill-accent" : "progress-fill-muted"}
                      style={{ width: `${s.masteryPct ?? 0}%` }}
                    />
                  </div>
                  {!s.reliable ? (
                    <p className="mt-2 text-[11px] font-medium text-[var(--muted)]">Needs 5 attempts</p>
                  ) : null}
                </Link>
              );
            })
          )}
        </div>
      </section>
    </AppShell>
  );
}
