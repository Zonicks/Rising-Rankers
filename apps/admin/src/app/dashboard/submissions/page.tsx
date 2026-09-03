"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, PageSection } from "@/components/admin-shell";
import { adminTokenKey, api } from "@/lib/api";

type LiveRow = {
  id: string;
  testTitle: string;
  email: string;
  fullName: string | null;
  status: string;
  score: string;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  rank: number | null;
  appSwitchCount: number;
  submittedAt: string | null;
};

type LiveDetail = LiveRow & {
  answers: Array<{
    mcqId: string;
    question: string;
    selectedOption: string | null;
    correctOption: string | null;
    isCorrect: boolean;
  }>;
};

type McqRow = {
  id: string;
  email: string;
  fullName: string | null;
  question: string;
  chapter: { title: string; subject: string } | null;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
  attemptedAt: string;
};

export default function SubmissionsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"live" | "practice">("live");
  const [liveRows, setLiveRows] = useState<LiveRow[]>([]);
  const [mcqRows, setMcqRows] = useState<McqRow[]>([]);
  const [detail, setDetail] = useState<LiveDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return router.replace("/signin");

    Promise.all([
      api<LiveRow[]>("/api/v1/admin/submissions/live", { token }),
      api<McqRow[]>("/api/v1/admin/submissions/mcq", { token }),
    ])
      .then(([live, mcq]) => {
        setLiveRows(live);
        setMcqRows(mcq);
      })
      .catch(() => router.replace("/signin"));
  }, [router]);

  async function openDetail(id: string) {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setError(null);
    try {
      const data = await api<LiveDetail>(`/api/v1/admin/submissions/live/${id}`, { token });
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submission");
    }
  }

  return (
    <AdminShell
      title="Submissions"
      subtitle="Live test attempts and practice MCQ answers from students."
    >
      {error ? <p className="msg-err mb-4">{error}</p> : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn-sm ${tab === "live" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => {
            setTab("live");
            setDetail(null);
          }}
        >
          Live tests ({liveRows.length})
        </button>
        <button
          type="button"
          className={`btn-sm ${tab === "practice" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => {
            setTab("practice");
            setDetail(null);
          }}
        >
          Practice MCQs ({mcqRows.length})
        </button>
      </div>

      {tab === "live" ? (
        detail ? (
          <PageSection
            title="Attempt detail"
            action={
              <button type="button" className="btn-secondary btn-sm" onClick={() => setDetail(null)}>
                Back to list
              </button>
            }
          >
            <div className="mb-6 space-y-1">
              <p className="font-semibold">{detail.testTitle}</p>
              <p className="text-sm text-[var(--ink-soft)]">
                {detail.fullName ?? "—"} · {detail.email}
              </p>
              <p className="text-sm text-[var(--ink-soft)]">
                Score {detail.score} · {detail.correctCount} correct · {detail.incorrectCount}{" "}
                incorrect · {detail.skippedCount} skipped
                {detail.rank != null ? ` · Rank ${detail.rank}` : ""}
                {detail.appSwitchCount > 0 ? ` · App switches ${detail.appSwitchCount}` : ""}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {detail.status}
                {detail.submittedAt
                  ? ` · ${new Date(detail.submittedAt).toLocaleString()}`
                  : ""}
              </p>
            </div>
            <div className="row-list">
              {detail.answers.map((a) => (
                <div key={a.mcqId} className="py-3">
                  <p className="font-semibold">{a.question}</p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    <span className={`chip mr-2 ${a.isCorrect ? "chip-success" : "chip-danger"}`}>
                      {a.isCorrect ? "Correct" : "Incorrect"}
                    </span>
                    Selected {a.selectedOption ?? "—"}
                    {a.correctOption ? ` · Answer ${a.correctOption}` : ""}
                  </p>
                </div>
              ))}
              {detail.answers.length === 0 ? (
                <p className="py-3 text-sm text-[var(--muted)]">No answer rows stored.</p>
              ) : null}
            </div>
          </PageSection>
        ) : (
          <PageSection title="Live test submissions">
            {liveRows.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No submitted live attempts yet.</p>
            ) : (
              <div className="row-list">
                {liveRows.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openDetail(r.id)}
                    className="flex w-full flex-col gap-1 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{r.testTitle}</p>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">
                        {r.fullName ?? "—"} · {r.email}
                      </p>
                    </div>
                    <div className="text-sm text-[var(--ink-soft)] sm:text-right">
                      <p className="metric font-semibold text-[var(--ink)]">Score {r.score}</p>
                      <p>
                        <span className="chip chip-accent mr-1">{r.status}</span>
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </PageSection>
        )
      ) : (
        <PageSection title="Practice MCQ submissions">
          {mcqRows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No practice answers yet.</p>
          ) : (
            <div className="row-list">
              {mcqRows.map((r) => (
                <div key={r.id} className="py-3">
                  <p className="font-semibold">{r.question}</p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {r.fullName ?? "—"} · {r.email}
                    {r.chapter ? (
                      <span className="chip chip-accent ml-2">{r.chapter.title}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    <span className={`chip mr-2 ${r.isCorrect ? "chip-success" : "chip-danger"}`}>
                      {r.isCorrect ? "Correct" : "Incorrect"}
                    </span>
                    Selected {r.selectedOption} · Answer {r.correctOption} ·{" "}
                    {new Date(r.attemptedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </PageSection>
      )}
    </AdminShell>
  );
}
