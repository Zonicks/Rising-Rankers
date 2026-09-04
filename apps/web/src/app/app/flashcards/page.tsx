"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FlashcardsSkeleton } from "@/components/skeleton";
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

const DISTANCE = 88;
const VELOCITY = 400;

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
  const [ready, setReady] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [shake, setShake] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const coachArmed = useRef(false);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    lastX: number;
    lastT: number;
    vx: number;
  } | null>(null);
  const skipClick = useRef(false);
  const committed = useRef(false);
  const busyRef = useRef(false);
  const cardRef = useRef(card);
  const historyRef = useRef(history);
  cardRef.current = card;
  historyRef.current = history;

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
    setDx(0);
    committed.current = false;
  }, []);

  const loadNext = useCallback(
    async (opts?: { excludeId?: string; push?: Card | null }) => {
      const token = localStorage.getItem(tokenKey);
      if (!token) return router.replace("/auth");
      setBusy(true);
      busyRef.current = true;
      try {
        const data = await api<Payload>(`/api/v1/flashcards/next${qs(opts?.excludeId)}`, { token });
        apply(data, opts?.push);
      } catch (e) {
        const err = e as Error & { code?: string; details?: { unlockPrice?: number } };
        setError(err.message);
        setErrorCode(err.code ?? null);
        if (err.code === "QUOTA_EXCEEDED") setUnlockPrice(err.details?.unlockPrice ?? 10);
        if (err.code === "NO_CONTENT") setCard(null);
        setDx(0);
        committed.current = false;
      } finally {
        busyRef.current = false;
        setBusy(false);
        setReady(true);
      }
    },
    [apply, qs, router]
  );

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  useEffect(() => {
    if (!card || coachArmed.current) return;
    coachArmed.current = true;
    setShowCoach(true);
  }, [card]);

  useEffect(() => {
    if (!showCoach) return;
    const t = window.setTimeout(() => setShowCoach(false), 1300);
    return () => window.clearTimeout(t);
  }, [showCoach]);

  function previous() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const nextHist = h.slice(0, -1);
      setCard(h[h.length - 1]);
      setFlipped(false);
      setDx(0);
      committed.current = false;
      return nextHist;
    });
  }

  function nudgePrevious() {
    if (historyRef.current.length === 0) {
      setShake(true);
      window.setTimeout(() => setShake(false), 280);
      return;
    }
    previous();
  }

  function goNext() {
    const current = cardRef.current;
    if (!current || busyRef.current) return;
    void loadNext({ excludeId: current.id, push: current });
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

  function flyOff(to: number, then: () => void) {
    committed.current = true;
    setDragging(false);
    setDx(to);
    window.setTimeout(then, 240);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (busy || committed.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = performance.now();
    drag.current = { pointerId: e.pointerId, startX: e.clientX, lastX: e.clientX, lastT: now, vx: 0 };
    setDragging(true);
    skipClick.current = false;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.vx = ((e.clientX - d.lastX) / dt) * 1000;
    d.lastX = e.clientX;
    d.lastT = now;
    const next = e.clientX - d.startX;
    if (Math.abs(next) >= 12) skipClick.current = true;
    setDx(next);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (committed.current) return;

    const delta = e.clientX - d.startX;
    const v = d.vx;
    let dir = 0;
    if (v > VELOCITY) dir = 1;
    else if (v < -VELOCITY) dir = -1;
    else if (delta >= DISTANCE) dir = 1;
    else if (delta <= -DISTANCE) dir = -1;

    if (dir === 0) {
      setDx(0);
      return;
    }

    const width = Math.max(420, e.currentTarget.offsetWidth);
    if (dir < 0) {
      flyOff(-width * 1.15, goNext);
    } else if (historyRef.current.length === 0) {
      setDx(0);
      nudgePrevious();
    } else {
      flyOff(width * 1.15, previous);
    }
  }

  function onCardClick() {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if (busy || committed.current) return;
    setFlipped((v) => !v);
  }

  const pct = Math.min(100, Math.round((goal.ratedToday / Math.max(1, goal.dailyGoal)) * 100));
  const rot = Math.max(-8, Math.min(8, dx / 28));
  const peek = 10 - dx * 0.12;
  const canPrev = history.length > 0;

  if (!ready && !error) {
    return (
      <AppShell
        overline="Practice"
        title="Flashcards"
        subtitle="Tap the center to flip. Swipe to browse — swipes do not rate."
      >
        <FlashcardsSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell
      overline="Practice"
      title="Flashcards"
      subtitle="Tap the center to flip. Swipe to browse — swipes do not rate."
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
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">Easy or Hard counts. Swipes only browse.</p>
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
          <div
            className="pointer-events-none absolute rounded-[2rem]"
            style={{
              left: peek + 14,
              right: 4 - peek,
              top: 18,
              bottom: -8,
              transform: "scale(0.94)",
              background: "rgba(5, 11, 24, 0.08)",
            }}
          />
          <div
            className="pointer-events-none absolute rounded-[2rem]"
            style={{
              left: peek + 6,
              right: 2 - peek,
              top: 10,
              bottom: -4,
              transform: "scale(0.97)",
              background: "rgba(12, 27, 61, 0.1)",
            }}
          />
          <div
            tabIndex={0}
            aria-label={flipped ? "Answer. Tap center to flip." : "Prompt. Tap center to flip."}
            onClick={onCardClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCardClick();
              }
              if (e.key === "ArrowRight") goNext();
              if (e.key === "ArrowLeft") nudgePrevious();
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`relative flex min-h-[22rem] w-full cursor-pointer select-none flex-col items-center justify-center rounded-[2rem] border border-[var(--line)] bg-white px-8 pb-14 pt-8 text-center shadow-[0_14px_28px_rgba(30,79,196,0.16)] ${
              shake ? "rr-card-shake" : ""
            }`}
            style={{
              touchAction: "pan-y",
              transform: shake ? undefined : `translateX(${dx}px) rotate(${rot}deg)`,
              transition: dragging ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <span className="absolute left-6 top-6 rounded-full bg-[#FBF6DC] px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#0C1B3D]">
              {card.chapterTitle || card.subject || "Card"}
            </span>
            <span className="mb-3 mt-10 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              <FlipIcon />
              {flipped ? "Answer · tap center to flip" : "Prompt · tap center to flip"}
            </span>
            <span
              key={`${card.id}-${flipped ? "b" : "f"}`}
              className="text-2xl font-bold leading-snug text-[var(--ink)] transition-opacity duration-150"
            >
              {flipped ? card.back : card.front}
            </span>
            {showCoach ? (
              <span className="rr-swipe-coach pointer-events-none absolute bottom-16 left-0 right-0 text-center text-sm font-extrabold tracking-[0.2em] text-[var(--gold)]">
                ‹&nbsp;&nbsp;swipe&nbsp;&nbsp;›
              </span>
            ) : null}
            <PageDots canPrevious={canPrev} drag={dx} />
          </div>
        </div>
      ) : !error ? (
        <p className="text-sm text-[var(--muted)]">No cards in this set yet.</p>
      ) : null}

      {card ? (
        <div className="mx-auto mt-8 flex w-full max-w-lg items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-2 text-sm font-bold text-[#0C1B3D] disabled:opacity-40"
            disabled={busy}
            onClick={nudgePrevious}
          >
            Previous
          </button>
          <p className="flex-1 text-center text-xs font-semibold text-[var(--muted)]">
            {history.length + 1} this session
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-2 text-sm font-bold text-[#0C1B3D] disabled:opacity-40"
            disabled={busy}
            onClick={goNext}
          >
            Next
          </button>
        </div>
      ) : null}

      {card ? (
        <div className="mx-auto mt-3 grid w-full max-w-lg grid-cols-2 gap-3">
          <button
            type="button"
            className="min-h-12 rounded-2xl bg-[var(--danger-soft)] py-4 disabled:opacity-50"
            disabled={busy}
            onClick={() => void review("HARD")}
          >
            <span className="block font-extrabold text-[var(--danger)]">Hard</span>
            <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">1 day</span>
          </button>
          <button
            type="button"
            className="min-h-12 rounded-2xl bg-[var(--success-soft)] py-4 disabled:opacity-50"
            disabled={busy}
            onClick={() => void review("EASY")}
          >
            <span className="block font-extrabold text-[var(--success)]">Easy</span>
            <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">3 days</span>
          </button>
        </div>
      ) : null}

      {card && quota ? (
        <p className="mx-auto mt-4 w-full max-w-lg text-sm text-[var(--muted)]">
          {quota.freeLeft > 0 ? `${quota.freeLeft} free ratings left today` : "Free ratings used today"}
        </p>
      ) : null}
    </AppShell>
  );
}

function PageDots({ canPrevious, drag }: { canPrevious: boolean; drag: number }) {
  const t = Math.max(-1, Math.min(1, drag / 88));
  // Left drag = next, right drag = previous
  const left = t < 0 ? 0.45 + 0.4 * -t : 0.28;
  const right = canPrevious ? (t > 0 ? 0.45 + 0.4 * t : 0.28) : 0.22;
  return (
    <span className="pointer-events-none absolute bottom-5 left-0 right-0 inline-flex items-center justify-center gap-[7px]" aria-hidden>
      <span
        className="rounded-full"
        style={{
          width: t < -0.25 ? 8 : 6,
          height: t < -0.25 ? 8 : 6,
          background: `rgba(12, 27, 61, ${left})`,
        }}
      />
      <span
        className="h-[7px] w-[18px] rounded-full"
        style={{ background: `rgba(240, 194, 26, ${1 - Math.abs(t) * 0.2})` }}
      />
      <span
        className="rounded-full"
        style={{
          width: t > 0.25 ? 8 : 6,
          height: t > 0.25 ? 8 : 6,
          background: `rgba(12, 27, 61, ${right})`,
        }}
      />
    </span>
  );
}

function FlipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h11a5 5 0 0 1 0 10H8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M7 4 4 7l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function FlashcardsPage() {
  return (
    <Suspense
      fallback={
        <AppShell overline="Practice" title="Flashcards">
          <FlashcardsSkeleton />
        </AppShell>
      }
    >
      <FlashcardsInner />
    </Suspense>
  );
}
