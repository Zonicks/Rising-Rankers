"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api, tokenKey } from "@/lib/api";
import { emitRewards, type RewardsDelta } from "@/lib/rewards";

type Card = {
  id: string;
  front: string;
  back: string;
  subject: string | null;
  topic: string | null;
  chapterTitle: string | null;
};

type Payload = {
  card: Card;
  quota: { freeLeft: number; paidActive: boolean; unlockPrice?: number };
  goal: { ratedToday: number; dailyGoal: number };
};

function FlashcardsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const chapterId = search.get("chapterId") ?? undefined;
  const subjectId = search.get("subjectId") ?? undefined;

  const [card, setCard] = useState<Card | null>(null);
  const [history, setHistory] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [goal, setGoal] = useState({ ratedToday: 0, dailyGoal: 50 });
  const [quota, setQuota] = useState<{ freeLeft: number; paidActive: boolean; unlockPrice?: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [unlockPrice, setUnlockPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number } | null>(null);

  const qs = useCallback(
    (excludeId?: string) => {
      const p = new URLSearchParams();
      if (excludeId) p.set("excludeId", excludeId);
      if (chapterId) p.set("chapterId", chapterId);
      if (subjectId) p.set("subjectId", subjectId);
      const s = p.toString();
      return s ? `?${s}` : "";
    },
    [chapterId, subjectId]
  );

  const apply = useCallback((data: Payload, pushCurrent?: Card | null) => {
    if (pushCurrent) setHistory((h) => [...h, pushCurrent]);
    setCard(data.card);
    setQuota(data.quota);
    setGoal(data.goal);
    setFlipped(false);
    setError(null);
    setErrorCode(null);
    setUnlockPrice(null);
  }, []);

  const loadNext = useCallback(
    async (opts?: { excludeId?: string; push?: Card | null }) => {
      const token = localStorage.getItem(tokenKey);
      if (!token) return router.replace("/auth");
      setBusy(true);
      try {
        const data = await api<Payload>(`/api/v1/flashcards/next${qs(opts?.excludeId)}`, { token });
        apply(data, opts?.push);
      } catch (e) {
        const err = e as Error & { code?: string; details?: { unlockPrice?: number } };
        setError(err.message);
        setErrorCode(err.code ?? null);
        if (err.code === "QUOTA_EXCEEDED") setUnlockPrice(err.details?.unlockPrice ?? 10);
        if (err.code === "NO_CONTENT") setCard(null);
      } finally {
        setBusy(false);
      }
    },
    [apply, qs, router]
  );

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  function previous() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const nextHist = h.slice(0, -1);
      setCard(h[h.length - 1]);
      setFlipped(false);
      return nextHist;
    });
  }

  async function review(rating: "EASY" | "HARD") {
    const token = localStorage.getItem(tokenKey);
    if (!token || !card || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ goal: Payload["goal"]; quota: Payload["quota"]; rewards?: RewardsDelta }>(
        `/api/v1/flashcards/${card.id}/review`,
        { method: "POST", token, body: JSON.stringify({ rating }) }
      );
      setGoal(data.goal);
      setQuota(data.quota);
      emitRewards(data.rewards);
      await loadNext({ excludeId: card.id, push: card });
    } catch (e) {
      const err = e as Error & { code?: string; details?: { unlockPrice?: number } };
      setError(err.message);
      if (err.code === "QUOTA_EXCEEDED") setUnlockPrice(err.details?.unlockPrice ?? quota?.unlockPrice ?? 10);
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    try {
      await api("/api/v1/flashcards/unlock", { method: "POST", token });
      setUnlockPrice(null);
      await loadNext({ excludeId: card?.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed");
    }
  }

  const swiped = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX };
    swiped.current = false;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    drag.current = null;
    if (Math.abs(dx) < 70) return;
    swiped.current = true;
    if (dx > 0) void loadNext({ excludeId: card?.id, push: card });
    else previous();
  }

  const pct = Math.min(100, Math.round((goal.ratedToday / Math.max(1, goal.dailyGoal)) * 100));

  return (
    <AppShell
      title="Flashcards"
      subtitle="Tap to flip. Easy or Hard rates the card. Swipe right for next, left for previous — swipes don’t count."
    >
      <div className="mb-8">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Daily goal
          </span>
          <span className="text-lg font-extrabold text-[var(--accent)]">
            {goal.ratedToday}/{goal.dailyGoal}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error ? (
        <div className="card mb-6 p-6">
          <p className="msg-err">{error}</p>
          {unlockPrice != null ? (
            <button onClick={unlock} className="btn-primary mt-4">
              Unlock more · ₹{unlockPrice}
            </button>
          ) : null}
          {errorCode === "FORBIDDEN" ? (
            <Link href="/app/search" className="btn-primary mt-4 inline-flex">
              Find this book in Search
            </Link>
          ) : null}
          {errorCode === "NO_CONTENT" ? (
            <Link href="/app/study" className="btn-secondary mt-4 inline-flex">
              Back to Study
            </Link>
          ) : null}
        </div>
      ) : null}

      {card ? (
        <div className="relative mx-auto w-full max-w-lg">
          <div className="pointer-events-none absolute inset-x-8 -bottom-8 h-full scale-[0.92] rounded-[2rem] bg-[var(--line)] opacity-30" />
          <div className="pointer-events-none absolute inset-x-4 -bottom-4 h-full scale-[0.96] rounded-[2rem] bg-[#F1F3FB] opacity-60" />
          <button
            type="button"
            onClick={() => {
              if (swiped.current) {
                swiped.current = false;
                return;
              }
              setFlipped((v) => !v);
            }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            className="relative flex min-h-[22rem] w-full flex-col items-center justify-center rounded-[2rem] border border-[var(--line)] bg-white p-8 text-center shadow-[0_8px_32px_rgba(30,79,196,0.08)]"
          >
            <span className="absolute left-6 top-6 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
              {card.chapterTitle || card.subject || "Card"}
            </span>
            <span className="mb-3 mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {flipped ? "Answer" : "Prompt"} · tap to flip
            </span>
            <span className="text-2xl font-bold leading-snug text-[var(--ink)]">
              {flipped ? card.back : card.front}
            </span>
          </button>
        </div>
      ) : !error ? (
        <p className="text-sm text-[var(--muted)]">No cards in this set yet.</p>
      ) : null}

      {card ? (
        <div className="mx-auto mt-10 grid w-full max-w-lg grid-cols-2 gap-3">
          <button
            type="button"
            className="rounded-2xl bg-[var(--danger-soft)] py-4 disabled:opacity-50"
            disabled={busy}
            onClick={() => void review("HARD")}
          >
            <span className="block font-extrabold text-[var(--danger)]">Hard</span>
            <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">1 day</span>
          </button>
          <button
            type="button"
            className="rounded-2xl bg-[var(--success-soft)] py-4 disabled:opacity-50"
            disabled={busy}
            onClick={() => void review("EASY")}
          >
            <span className="block font-extrabold text-[var(--success)]">Easy</span>
            <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">3 days</span>
          </button>
        </div>
      ) : null}

      {card ? (
        <div className="mx-auto mt-4 flex w-full max-w-lg gap-3">
          <button type="button" className="btn-secondary flex-1" disabled={history.length === 0} onClick={previous}>
            Previous
          </button>
          <button
            type="button"
            className="btn-secondary flex-1"
            disabled={busy}
            onClick={() => void loadNext({ excludeId: card.id, push: card })}
          >
            Next without rating
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}

export default function FlashcardsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Flashcards">
          <p className="text-sm text-[var(--muted)]">Loading cards…</p>
        </AppShell>
      }
    >
      <FlashcardsInner />
    </Suspense>
  );
}
