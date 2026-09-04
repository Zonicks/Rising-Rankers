"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TestJoinSkeleton } from "@/components/skeleton";
import { api, tokenKey } from "@/lib/api";
import { emitRewards, type RewardsDelta } from "@/lib/rewards";

type Question = {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

const finishedCodes = new Set([
  "ALREADY_SUBMITTED",
  "TEST_COMPLETED",
  "NOT_JOINED",
]);

function formatTime(ms: unknown) {
  const n = typeof ms === "number" ? ms : Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const m = Math.floor(n / 60000);
  const s = Math.floor((n % 60000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export default function TestRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [waiting, setWaiting] = useState<{
    title: string;
    countdownSeconds: number;
    canStart: boolean;
    alreadySubmitted?: boolean;
    entryFee: string;
    participantCount: number;
  } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"wait" | "attempt" | "done">("wait");
  const [remaining, setRemaining] = useState<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const submittingRef = useRef(false);

  const token = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem(tokenKey) : null),
    []
  );

  const loadResult = useCallback(async () => {
    if (!token) return false;
    try {
      const existing = await api<Record<string, unknown>>(`/api/v1/tests/${id}/result`, { token });
      setResult(existing);
      setPhase("done");
      setError(null);
      return true;
    } catch {
      return false;
    }
  }, [id, token]);

  const loadWaiting = useCallback(async () => {
    if (!token) return router.replace("/auth");
    if (phaseRef.current === "done" || phaseRef.current === "attempt") return;
    try {
      if (await loadResult()) return;
      const data = await api<{
        title: string;
        countdownSeconds: number;
        canStart: boolean;
        alreadySubmitted?: boolean;
        entryFee: string;
        participantCount: number;
      }>(`/api/v1/tests/${id}/waiting-room`, { token });
      if (data.alreadySubmitted) {
        if (await loadResult()) return;
      }
      setWaiting(data);
      if (data.canStart) {
        try {
          const session = await api<{
            questions: Question[];
            answers?: Record<string, string>;
            remainingSeconds?: number;
          }>(`/api/v1/tests/${id}/session`, { token });
          setQuestions(session.questions);
          setAnswers(session.answers ?? {});
          setRemaining(session.remainingSeconds ?? null);
          setPhase("attempt");
        } catch (e) {
          const err = e as Error & { code?: string };
          if (err.code && finishedCodes.has(err.code) && (await loadResult())) return;
          throw e;
        }
      }
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code && finishedCodes.has(err.code) && (await loadResult())) return;
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [id, loadResult, router, token]);

  useEffect(() => {
    void loadWaiting();
    const t = setInterval(() => {
      if (phaseRef.current === "wait") void loadWaiting();
    }, 5000);
    return () => clearInterval(t);
  }, [loadWaiting]);

  useEffect(() => {
    if (phase !== "attempt" || remaining == null) return;
    const t = window.setInterval(() => {
      setRemaining((s) => {
        if (s == null) return s;
        if (s <= 1) {
          window.clearInterval(t);
          void submitRef.current(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase, remaining == null]);

  useEffect(() => {
    if (phase !== "attempt") return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [phase]);

  async function saveAnswer(mcqId: string, selectedOption: string) {
    setAnswers((a) => ({ ...a, [mcqId]: selectedOption }));
    if (!token) return;
    try {
      await api(`/api/v1/tests/${id}/answers`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ mcqId, selectedOption }),
      });
    } catch {
      /* keep local selection */
    }
  }

  const submitRef = useRef<(auto?: boolean) => Promise<void>>(async () => undefined);

  async function submit(auto = false) {
    if (!token || submittingRef.current) return;
    submittingRef.current = true;
    const payload = {
      autoSubmit: auto,
      answers: questionsRef.current.map((q) => ({
        mcqId: q.id,
        selectedOption: answersRef.current[q.id] ?? null,
      })),
    };
    try {
      const data = await api<Record<string, unknown> & { rewards?: RewardsDelta }>(
        `/api/v1/tests/${id}/submit`,
        {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        }
      );
      setResult(data);
      emitRewards(data.rewards);
      setPhase("done");
    } catch (e) {
      submittingRef.current = false;
      setError(e instanceof Error ? e.message : "Submit failed");
    }
  }
  submitRef.current = submit;

  return (
    <AppShell wide>
      <Link
        href="/app/tests"
        className="text-sm text-[var(--ink-soft)] hover:text-[var(--accent)]"
        onClick={(e) => {
          if (phase !== "attempt") return;
          const ok = window.confirm("Your answers are saved. The timer keeps running. Resume from Quiz anytime.");
          if (!ok) e.preventDefault();
        }}
      >
        ← Tests
      </Link>
      {error ? <p className="msg-err mt-4">{error}</p> : null}

      {phase === "wait" && !waiting && !error && !result ? <TestJoinSkeleton /> : null}

      {phase === "wait" && waiting ? (
        <div className="card mt-6 p-6 text-center sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Waiting room
          </p>
          <h1 className="mt-2 text-xl font-semibold sm:text-2xl">{waiting.title}</h1>
          <p className="mt-6 text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl">
            {waiting.countdownSeconds}s
          </p>
          <p className="mt-3 text-sm text-[var(--ink-soft)] sm:text-base">
            Entry ₹{waiting.entryFee} · {waiting.participantCount} participants
          </p>
          <p className="mt-4 text-sm text-[var(--muted)]">Waiting for the server to start the test…</p>
        </div>
      ) : null}

      {phase === "attempt" ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Attempt in progress</h1>
            {remaining != null ? (
              <p className="text-lg font-extrabold tabular-nums text-[var(--accent)]">
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")} left
              </p>
            ) : null}
          </div>
          <p className="text-sm text-[var(--ink-soft)]">
            Answers save as you pick. If you leave, resume from Quiz — the timer keeps running.
          </p>
          {questions.map((q, idx) => (
            <div key={q.id} className="card p-4 sm:p-5">
              <p className="font-semibold">
                {idx + 1}. {q.question}
              </p>
              <div className="mt-3 space-y-2">
                {(["A", "B", "C", "D"] as const).map((o) => (
                  <label
                    key={o}
                    className={`option-btn cursor-pointer ${answers[q.id] === o ? "is-correct" : ""}`}
                  >
                    <input
                      type="radio"
                      className="mt-1 accent-[var(--accent)]"
                      name={q.id}
                      checked={answers[q.id] === o}
                      onChange={() => void saveAnswer(q.id, o)}
                    />
                    <span>
                      {o}. {q[`option${o}`]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => submit(false)} className="btn-primary w-full">
            Submit test
          </button>
        </div>
      ) : null}

      {phase === "done" && result ? (
        <div className="mt-6 grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
          <section className="hero-progress relative overflow-hidden p-6 text-center sm:p-10 lg:p-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Your score</p>
            <p className="mt-4 text-5xl font-extrabold tabular-nums tracking-tight sm:mt-5 sm:text-7xl lg:text-8xl">
              {result.scorePct != null ? `${String(result.scorePct)}%` : String(result.score)}
            </p>
            <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-sm text-white/75">
              <span>Marks {String(result.score ?? "—")}</span>
              {result.subject ? <span>· {String(result.subject)}</span> : null}
              {result.accuracy != null ? <span>· Accuracy {String(result.accuracy)}%</span> : null}
              <span>· Time {formatTime(result.timeTakenMs)}</span>
            </p>
          </section>
          <div className="space-y-4 sm:space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { label: "Correct", value: result.correctCount, tone: "text-[#027a48] bg-[#ecfdf3]" },
                  { label: "Incorrect", value: result.incorrectCount, tone: "text-[#b42318] bg-[#fef3f2]" },
                ] as const
              ).map((tile) => (
                <div key={tile.label} className={`min-w-0 overflow-hidden rounded-3xl p-4 sm:p-5 ${tile.tone}`}>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest sm:text-[11px]">{tile.label}</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums leading-tight sm:text-3xl">
                    {String(tile.value ?? "—")}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-3">
              <div className="min-w-0 overflow-hidden rounded-3xl bg-[#f2f4f6] p-4 text-[var(--ink-soft)] sm:p-5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest sm:text-[11px]">Skipped</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums leading-tight sm:text-3xl">
                  {String(result.skippedCount ?? "—")}
                </p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-3xl bg-[var(--accent-soft)] px-5 py-4 text-[var(--accent)] sm:px-6 sm:py-5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest sm:text-[11px]">Rank</p>
                <p
                  className={`mt-1 font-extrabold leading-tight ${
                    result.rank == null ? "text-lg sm:text-2xl" : "text-2xl tabular-nums sm:text-3xl"
                  }`}
                >
                  {result.rank == null ? "Pending" : String(result.rank)}
                </p>
              </div>
            </div>
            <div className="card p-4 sm:p-6">
              <div className="flex items-end justify-between gap-3">
                <p className="text-base font-bold sm:text-lg">Accuracy</p>
                <p className="text-xl font-extrabold text-[#027a48] sm:text-2xl">
                  {result.accuracy != null ? `${String(result.accuracy)}%` : "—"}
                </p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f2f4f6] sm:h-3">
                <div
                  className="h-full rounded-full bg-[#027a48]"
                  style={{ width: `${Math.min(100, Number(result.accuracy ?? 0))}%` }}
                />
              </div>
              <p className="mt-4 text-sm text-[var(--ink-soft)]">Time taken {formatTime(result.timeTakenMs)}</p>
            </div>
            {result.award ? (
              <p className="rounded-3xl bg-[var(--gold-soft,#fbf6dc)] p-4 text-base font-bold text-[var(--deep)] sm:p-5 sm:text-lg">
                Award ₹{(result.award as { amount: string }).amount} ({(result.award as { status: string }).status})
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
