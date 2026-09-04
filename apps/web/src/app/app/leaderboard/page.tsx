"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LeaderboardSkeleton } from "@/components/skeleton";
import { api, tokenKey } from "@/lib/api";
import { achievementGlyph } from "@/lib/rewards";

type Row = {
  rank: number;
  userId: string;
  initials: string;
  city: string;
  programName: string;
  points: number;
  isYou: boolean;
};

type Board = {
  programName: string | null;
  cityMissing: boolean;
  you: Row | null;
  youRank: number | null;
  topPercent: number | null;
  total: number;
  podium: Row[];
  list: Row[];
};

type Achievements = {
  earned: Array<{
    id: string;
    name: string;
    description: string;
    iconKey: string;
    tier: "GOLD" | "SILVER" | "BRONZE";
    pointsReward: number;
  }>;
  locked: Array<{
    id: string;
    name: string;
    description: string;
    iconKey: string;
    tier: "GOLD" | "SILVER" | "BRONZE";
    pointsReward: number;
    threshold: number;
    progress: number;
  }>;
};

function tierClass(tier: string) {
  if (tier === "GOLD") return "badge-gold";
  if (tier === "SILVER") return "badge-silver";
  return "badge-bronze";
}

function PodiumSlot({ row, place }: { row?: Row; place: 1 | 2 | 3 }) {
  const size = place === 1 ? "h-20 w-20 text-lg" : "h-14 w-14 text-sm";
  const ring =
    place === 1 ? "badge-gold" : place === 2 ? "badge-silver" : "badge-bronze";
  return (
    <div className={`flex flex-col items-center ${place === 1 ? "" : "pt-8"}`}>
      <div className="relative mb-3">
        {place === 1 ? <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xl">👑</span> : null}
        <div
          className={`${size} flex items-center justify-center rounded-full border-4 border-white font-extrabold text-[var(--deep)] ${ring}`}
        >
          {row?.initials ?? "—"}
        </div>
        <span
          className={`absolute -bottom-1 ${place === 1 ? "left-1/2 -translate-x-1/2" : "-right-1"} flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${ring}`}
        >
          {place}
        </span>
      </div>
      <p className="w-full truncate text-center text-xs font-bold">{row?.isYou ? "You" : row?.initials ?? "—"}</p>
      <p className="text-[10px] font-semibold text-[var(--ink-soft)]">
        {row ? `${row.points.toLocaleString()} pts` : ""}
      </p>
    </div>
  );
}

function RankRow({ row }: { row: Row }) {
  if (row.isYou) {
    return (
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[#050b18] via-[#0c1b3d] to-[#1e4fc4] p-4 text-white shadow-[var(--shadow-lift)]">
        <span className="w-6 text-center text-sm font-extrabold text-[var(--gold)]">{row.rank}</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xs font-extrabold text-[var(--gold)]">
          {row.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{row.initials} (You)</p>
          <p className="truncate text-[10px] font-medium text-white/70">
            {row.city} · {row.programName}
          </p>
        </div>
        <p className="font-headline text-sm font-extrabold tabular-nums text-[var(--gold)]">
          {row.points.toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
      <span className="w-6 text-center text-sm font-bold text-[var(--ink-soft)]">{row.rank}</span>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-xs font-extrabold text-[var(--accent)]">
        {row.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{row.initials}</p>
        <p className="truncate text-[10px] font-medium text-[var(--ink-soft)]">
          {row.city} · {row.programName}
        </p>
      </div>
      <p className="text-sm font-bold tabular-nums text-[var(--accent)]">{row.points.toLocaleString()}</p>
    </div>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"global" | "friends">("global");
  const [board, setBoard] = useState<Board | null>(null);
  const [achs, setAchs] = useState<Achievements | null>(null);
  const [viewAll, setViewAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return router.replace("/auth");
    try {
      const [b, a] = await Promise.all([
        api<Board>("/api/v1/leaderboard?scope=GLOBAL", { token }),
        api<Achievements>("/api/v1/me/achievements", { token }),
      ]);
      setBoard(b);
      setAchs(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ranks");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const rankLabel = board?.youRank ? `#${board.youRank}` : "—";
  const podium1 = board?.podium.find((p) => p.rank === 1);
  const podium2 = board?.podium.find((p) => p.rank === 2);
  const podium3 = board?.podium.find((p) => p.rank === 3);
  const list = (board?.list.filter((r) => r.rank > 3 && !r.isYou) ?? []);
  const youRow = board?.you ?? null;
  const preview = [
    ...((achs?.earned ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      iconKey: a.iconKey,
      tier: a.tier,
      caption: a.tier,
      locked: false,
    }))),
    ...((achs?.locked ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      iconKey: a.iconKey,
      tier: a.tier,
      caption: `${a.progress}/${a.threshold}`,
      locked: true,
    }))),
  ].slice(0, 4);

  if (!board && error) {
    return (
      <AppShell>
        <p className="msg-err">{error}</p>
      </AppShell>
    );
  }

  if (!board) {
    return (
      <AppShell>
        <LeaderboardSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {error ? <p className="msg-err mb-4">{error}</p> : null}

      {board?.cityMissing ? (
        <div className="mb-6 rounded-[1.5rem] bg-[#FBF6DC] p-5">
          <p className="font-headline font-extrabold tracking-tight">Add your city to appear on the board</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Ranks show initials and city only — never full names or photos.</p>
          <Link href="/app/profile" className="btn-primary mt-4 inline-flex">
            Update profile
          </Link>
        </div>
      ) : null}

      <section className="hero-progress p-8">
        <p className="page-kicker">City board</p>
        <div className="relative mt-2 flex items-end gap-3">
          <span className="font-headline text-6xl font-extrabold tracking-tight">{rankLabel}</span>
          <span className="pb-2 text-lg font-semibold text-white/80">
            {board?.programName ? `${board.programName} rank` : "Global rank"}
          </span>
        </div>
        <p className="relative mt-4 max-w-[220px] text-sm leading-relaxed text-white/85">
          {board?.topPercent
            ? `You're in the top ${board.topPercent}% of aspirants. Keep the momentum.`
            : "Earn points from practice, quizzes, and streaks to climb the board."}
        </p>
      </section>

      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-headline text-xl font-extrabold tracking-tight">Achievements</h2>
          <button type="button" className="text-sm font-bold text-[var(--accent)]" onClick={() => setViewAll(true)}>
            View All
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {preview.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">Achievements unlock as you study.</p>
          ) : (
            preview.map((a) => (
              <div
                key={a.id}
                className={`flex h-44 w-32 shrink-0 flex-col items-center justify-center rounded-[2rem] bg-white p-4 text-center shadow-[var(--shadow-card)] ${
                  a.locked ? "opacity-70" : ""
                }`}
              >
                <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl ${tierClass(a.tier)}`}>
                  {achievementGlyph(a.iconKey)}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tight text-[var(--ink-soft)]">{a.caption}</span>
                <span className="mt-1 text-xs font-bold leading-tight">{a.name}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-headline text-2xl font-extrabold tracking-tight">Leaderboard</h2>
          <div className="grid grid-cols-2 rounded-2xl bg-[var(--accent-soft)] p-1">
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === "global" ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--ink-soft)]"}`}
              onClick={() => setTab("global")}
            >
              Global
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === "friends" ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--ink-soft)]"}`}
              onClick={() => setTab("friends")}
            >
              Friends
            </button>
          </div>
        </div>

        {tab === "friends" ? (
          <p className="card py-10 text-center text-sm text-[var(--ink-soft)]">
            Friends ranks arrive when follows ship. For now, climb the program board.
          </p>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-3 gap-3">
              <PodiumSlot row={podium2} place={2} />
              <PodiumSlot row={podium1} place={1} />
              <PodiumSlot row={podium3} place={3} />
            </div>
            <div className="space-y-3">
              {youRow ? <RankRow row={youRow} /> : null}
              {list.map((row) => (
                <RankRow key={row.userId} row={row} />
              ))}
              {list.length === 0 && !podium1 && !youRow ? (
                <p className="py-6 text-center text-sm text-[var(--ink-soft)]">No ranked students yet.</p>
              ) : null}
            </div>
          </>
        )}
      </section>

      {viewAll && achs ? (
        <div className="sheet-scrim" role="dialog" aria-modal="true">
          <div className="sheet-panel rounded-[2rem] sm:rounded-[2rem]">
            <div className="sheet-handle sm:hidden" />
            <div className="flex items-center justify-between px-6 pt-5">
              <h2 className="font-headline text-xl font-extrabold tracking-tight">Achievements</h2>
              <button type="button" className="text-sm font-semibold text-[var(--ink-soft)]" onClick={() => setViewAll(false)}>
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">
              {achs.earned.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <p className="page-kicker">Earned</p>
                  {achs.earned.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-[2rem] bg-white p-4 shadow-[var(--shadow-card)]">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg ${tierClass(a.tier)}`}>
                        {achievementGlyph(a.iconKey)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{a.name}</p>
                        <p className="text-xs text-[var(--ink-soft)]">{a.description}</p>
                      </div>
                      <span className="text-xs font-bold text-[var(--accent)]">+{a.pointsReward}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {achs.locked.length > 0 ? (
                <div className="mt-6 space-y-3">
                  <p className="page-kicker">Locked</p>
                  {achs.locked.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-[2rem] border border-[var(--ghost)] bg-white p-4 opacity-75 shadow-[var(--shadow-card)]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-lg grayscale">
                        {achievementGlyph(a.iconKey)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{a.name}</p>
                        <p className="text-xs text-[var(--ink-soft)]">
                          {a.progress}/{a.threshold} · {a.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
