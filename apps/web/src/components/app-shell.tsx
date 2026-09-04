"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, tokenKey } from "@/lib/api";
import { OPEN_STREAK_EVENT, REWARDS_EVENT, type RewardsDelta } from "@/lib/rewards";
import { BrandMark } from "./brand";
import { PageHeader } from "./page-header";
import { IconArticle, IconHome, IconPerson, IconQuiz, IconSearch, IconStudy } from "./icons";
import { StreakSheetSkeleton } from "./skeleton";

const links = [
  { href: "/app", label: "Home", exact: true, Icon: IconHome },
  { href: "/app/study", label: "Study", Icon: IconStudy },
  { href: "/app/tests", label: "Quiz", Icon: IconQuiz },
  { href: "/app/news", label: "News", Icon: IconArticle },
  { href: "/app/profile", label: "Profile", Icon: IconPerson },
];

type StreakSheet = {
  streakCount: number;
  days: Array<{ date: string; qualified: boolean }>;
  hint: string;
};

export function AppShell({
  children,
  overline,
  title,
  subtitle,
  wide,
}: {
  children: React.ReactNode;
  overline?: string;
  title?: string;
  subtitle?: string;
  wide?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [streakOpen, setStreakOpen] = useState(false);
  const [sheet, setSheet] = useState<StreakSheet | null>(null);
  const [streakReady, setStreakReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      router.replace("/auth");
      return;
    }
    api<{ profile: { curriculumComplete?: boolean } | null; streakCount?: number }>("/api/v1/me", {
      token,
    })
      .then((me) => {
        if (!me.profile?.curriculumComplete) {
          router.replace("/app/curriculum");
          return;
        }
        setStreakCount(me.streakCount ?? 0);
        setReady(true);
      })
      .catch(() => router.replace("/auth"));
  }, [router]);

  useEffect(() => {
    function onRewards(ev: Event) {
      const detail = (ev as CustomEvent<RewardsDelta>).detail;
      if (typeof detail?.streakCount === "number") setStreakCount(detail.streakCount);
      const first = detail?.unlocked?.[0];
      if (first) {
        setToast(`Unlocked ${first.name}${first.pointsReward ? ` · +${first.pointsReward} pts` : ""}`);
      } else if ((detail?.pointsDelta ?? 0) > 0) {
        setToast(`+${detail!.pointsDelta} pts`);
      }
    }
    function onOpenStreak() {
      setStreakOpen(true);
    }
    window.addEventListener(REWARDS_EVENT, onRewards);
    window.addEventListener(OPEN_STREAK_EVENT, onOpenStreak);
    return () => {
      window.removeEventListener(REWARDS_EVENT, onRewards);
      window.removeEventListener(OPEN_STREAK_EVENT, onOpenStreak);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!streakOpen) {
      setStreakReady(false);
      return;
    }
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    api<StreakSheet>("/api/v1/me/streak", { token })
      .then((data) => {
        setSheet(data);
        setStreakCount(data.streakCount);
      })
      .catch(() => setSheet(null))
      .finally(() => setStreakReady(true));
  }, [streakOpen]);

  function active(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  if (!ready) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--deep)]">
        <div
          className="pointer-events-none absolute -top-24 -right-16 h-80 w-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(30,79,196,0.55), transparent 70%)" }}
        />
        <BrandMark size={56} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 md:pb-0">
      <header className="glass-bar sticky top-0 z-20">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4">
          <Link href="/app" className="flex items-center gap-2.5">
            <BrandMark size={36} />
            <span className="font-headline text-[15px] font-extrabold leading-tight tracking-tight text-[var(--accent)] sm:text-xl">
              Rising Rankers
            </span>
          </Link>
          <nav className="ml-2 hidden flex-1 items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                  active(l.href, l.exact)
                    ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--bg-low)]"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/app/search"
            className={`ml-auto rounded-xl p-2 text-[var(--ink-soft)] hover:bg-[var(--bg-low)] ${
              pathname.startsWith("/app/search") ? "bg-[var(--accent-soft)] text-[var(--accent)]" : ""
            }`}
            aria-label="Search"
          >
            <IconSearch className="h-5 w-5" />
          </Link>
          <button type="button" className="streak-pill" onClick={() => setStreakOpen(true)}>
            🔥 {streakCount}
          </button>
        </div>
      </header>
      <main
        className={`animate-fade-rise mx-auto px-5 py-10 md:py-12 ${wide ? "max-w-5xl" : "max-w-[720px]"}`}
      >
        {title ? <PageHeader overline={overline} title={title} subtitle={subtitle} /> : null}
        {children}
      </main>
      <nav className="glass-dock fixed inset-x-0 bottom-0 z-30 rounded-t-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {links.map((l) => {
            const on = active(l.href, l.exact);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex min-w-[3.6rem] flex-col items-center rounded-2xl px-3 py-1.5 ${
                  on ? "dock-tab-on" : "text-[var(--muted)]"
                }`}
              >
                <l.Icon className="h-5 w-5" />
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider">{l.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {toast ? <div className="reward-toast">{toast}</div> : null}
      {streakOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="card w-full max-w-md p-6">
            <p className="page-kicker">Streak</p>
            <h2 className="mt-2 text-2xl font-extrabold">
              🔥 {sheet?.streakCount ?? streakCount} day{(sheet?.streakCount ?? streakCount) === 1 ? "" : "s"}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
              {sheet?.hint ?? "Do 10 MCQs or 5 cards today to keep it."}
            </p>
            {!streakReady ? (
              <StreakSheetSkeleton />
            ) : sheet?.days?.length ? (
              <div className="mt-5 grid grid-cols-7 gap-2">
                {sheet.days.map((d) => {
                  const day = Number(d.date.slice(8, 10));
                  return (
                    <div
                      key={d.date}
                      className={`flex h-9 items-center justify-center rounded-xl text-xs font-bold ${
                        d.qualified ? "bg-[var(--gold)] text-[var(--deep)]" : "bg-[#eceef0] text-[var(--muted)]"
                      }`}
                      title={d.date}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            ) : null}
            <p className="mt-4 text-xs text-[var(--muted)]">
              A day counts when you rate 5 flashcards, answer 10 MCQs, submit a quiz or test, or finish a news
              article.
            </p>
            <button
              type="button"
              className="btn-primary mt-6 w-full"
              onClick={() => {
                setStreakOpen(false);
                setSheet(null);
              }}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
