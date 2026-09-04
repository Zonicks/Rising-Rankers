"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { McqSkeleton } from "@/components/skeleton";
import { api, tokenKey } from "@/lib/api";
import { emitRewards, type RewardsDelta } from "@/lib/rewards";

type Mcq = {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

export default function McqPage() {
  return (
    <Suspense
      fallback={
        <AppShell overline="Practice" title="MCQ">
          <McqSkeleton />
        </AppShell>
      }
    >
      <McqInner />
    </Suspense>
  );
}

function McqInner() {
  const router = useRouter();
  const search = useSearchParams();
  const chapterId = search.get("chapterId") ?? undefined;
  const subjectId = search.get("subjectId") ?? undefined;
  const [mcq, setMcq] = useState<Mcq | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<{
    isCorrect: boolean;
    correctOption: string;
    explanation?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [unlockPrice, setUnlockPrice] = useState<number | null>(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return router.replace("/auth");
    setResult(null);
    setPicked(null);
    setError(null);
    setErrorCode(null);
    setUnlockPrice(null);
    try {
      const p = new URLSearchParams();
      if (chapterId) p.set("chapterId", chapterId);
      if (subjectId) p.set("subjectId", subjectId);
      const qs = p.toString();
      const data = await api<{ mcq: Mcq }>(`/api/v1/mcqs/next${qs ? `?${qs}` : ""}`, { token });
      setMcq(data.mcq);
    } catch (e) {
      const err = e as Error & { code?: string; details?: { unlockPrice?: number } };
      setError(err.message);
      setErrorCode(err.code ?? null);
      if (err.code === "QUOTA_EXCEEDED") setUnlockPrice(err.details?.unlockPrice ?? 10);
    }
  }, [router, chapterId, subjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function answer(option: string) {
    const token = localStorage.getItem(tokenKey);
    if (!token || !mcq) return;
    setPicked(option);
    try {
      const data = await api<{
        isCorrect: boolean;
        correctOption: string;
        explanation?: string | null;
        rewards?: RewardsDelta;
      }>(`/api/v1/mcqs/${mcq.id}/answer`, {
        method: "POST",
        token,
        body: JSON.stringify({ selectedOption: option }),
      });
      setResult(data);
      emitRewards(data.rewards);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function unlock() {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    try {
      await api("/api/v1/mcqs/unlock", { method: "POST", token });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed");
    }
  }

  function optionClass(o: string) {
    if (result) {
      if (o === result.correctOption) return "option-btn is-correct";
      if (o === picked && !result.isCorrect) return "option-btn is-wrong";
      return "option-btn";
    }
    if (picked === o) return "option-btn is-picked";
    return "option-btn";
  }

  return (
    <AppShell overline="Practice" title="MCQ" subtitle="Pick an option. You’ll see the explanation after you answer.">
      {error ? (
        <div className="lift-face p-6">
          <p className="msg-err">{error}</p>
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

      {!mcq && !error ? <McqSkeleton /> : null}

      {mcq ? (
        <div className="lift-face p-6 sm:p-8">
          <p className="font-headline text-lg font-extrabold leading-snug tracking-tight sm:text-xl">{mcq.question}</p>
          <div className="mt-5 space-y-2">
            {(["A", "B", "C", "D"] as const).map((o) => (
              <button
                key={o}
                disabled={!!result}
                onClick={() => answer(o)}
                className={optionClass(o)}
              >
                <span className="font-bold text-[var(--accent)]">{o}</span>
                <span>{mcq[`option${o}` as keyof Mcq]}</span>
              </button>
            ))}
          </div>
          {result ? (
            <div
              className={`mt-5 rounded-2xl p-4 ${
                result.isCorrect ? "bg-[var(--success-soft)]" : "bg-[var(--danger-soft)]"
              }`}
            >
              <p className={result.isCorrect ? "font-bold text-[var(--success)]" : "font-bold text-[var(--danger)]"}>
                {result.isCorrect ? "Correct" : `Incorrect · Answer ${result.correctOption}`}
              </p>
              {result.explanation ? (
                <p className="mt-2 text-sm text-[var(--ink-soft)]">{result.explanation}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <button onClick={load} className="btn-primary mt-4 w-full">
          Next question
        </button>
      ) : null}

      {unlockPrice != null ? (
        <button onClick={unlock} className="btn-primary mt-4 w-full">
          Unlock more · ₹{unlockPrice}
        </button>
      ) : null}
    </AppShell>
  );
}
