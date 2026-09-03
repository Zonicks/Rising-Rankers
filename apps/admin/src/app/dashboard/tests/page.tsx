"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AdminDialog, AdminShell, PageSection } from "@/components/admin-shell";
import { adminTokenKey, api } from "@/lib/api";

const MAX_QUESTIONS = 200;

type Opt = { id: string; name: string; authorName?: string };
type PickerOptions = {
  programs: Opt[];
  subjects: Opt[];
  books: Opt[];
  chapters: Opt[];
  categories: Opt[];
  subcategories: Opt[];
};
type McqRow = { id: string; question: string; difficulty?: string | null; chapter?: { title: string } | null };
type McqPage = { items: McqRow[]; nextCursor: string | null; totalInFilter: number };
type TrayItem = { id: string; question: string };
type TestItem = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number;
  entryFee: string;
  minAwardPool: string;
  awardLabel?: string | null;
  participantCount: number;
  pendingAwardCount?: number;
  creditedAwardCount?: number;
};
type AwardRow = {
  email: string;
  fullName: string | null;
  rank: number;
  amount: string;
  status: string;
};
type LiveSubmission = {
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
type LiveSubmissionDetail = LiveSubmission & {
  answers: Array<{
    mcqId: string;
    question: string;
    selectedOption: string | null;
    correctOption: string | null;
    isCorrect: boolean;
  }>;
};

function awardStatusLabel(status: string) {
  if (status === "PENDING_REVIEW") return "Awaiting payout approval";
  if (status === "CREDITED") return "Paid to award wallet";
  if (status === "REJECTED") return "Rejected";
  return status;
}

function qs(params: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) p.set(key, value);
  }
  return p.toString();
}

export default function AdminTestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<TestItem[]>([]);
  const [options, setOptions] = useState<PickerOptions>({
    programs: [],
    subjects: [],
    books: [],
    chapters: [],
    categories: [],
    subcategories: [],
  });
  const [programId, setProgramId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [bookId, setBookId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [page, setPage] = useState<McqPage>({ items: [], nextCursor: null, totalInFilter: 0 });
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [randomN, setRandomN] = useState(10);
  const [title, setTitle] = useState("Scholarship Live Test");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [entryFee, setEntryFee] = useState(10);
  const [giveAwards, setGiveAwards] = useState(false);
  const [awardMode, setAwardMode] = useState<"fixed" | "pool">("fixed");
  const [prizes, setPrizes] = useState<Array<{ rank: number; amount: number }>>([
    { rank: 1, amount: 500 },
    { rank: 2, amount: 300 },
    { rank: 3, amount: 200 },
  ]);
  const [minAwardPool, setMinAwardPool] = useState(1000);
  const [winnerPercent, setWinnerPercent] = useState(30);
  const [topBandCount, setTopBandCount] = useState(10);
  const [topSharePercent, setTopSharePercent] = useState(25);
  const [platformFeePercent, setPlatformFeePercent] = useState(10);
  const [awardPreview, setAwardPreview] = useState<{ testId: string; awards: AwardRow[] } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submissionsFor, setSubmissionsFor] = useState<{ testId: string; title: string } | null>(null);
  const [submissions, setSubmissions] = useState<LiveSubmission[]>([]);
  const [submissionDetail, setSubmissionDetail] = useState<LiveSubmissionDetail | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const filterParams = useMemo(
    () => ({
      programId,
      subjectId,
      bookId,
      chapterId,
      categoryId,
      subcategoryId,
      q,
      difficulty,
      status: "ACTIVE",
    }),
    [programId, subjectId, bookId, chapterId, categoryId, subcategoryId, q, difficulty]
  );

  const selectedIds = useMemo(() => new Set(tray.map((t) => t.id)), [tray]);

  const tokenOrRedirect = useCallback(() => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) {
      router.replace("/signin");
      return null;
    }
    return token;
  }, [router]);

  const loadTests = useCallback(async (token: string) => {
    const t = await api<TestItem[]>("/api/v1/admin/tests", { token });
    setTests(t);
  }, []);

  useEffect(() => {
    const token = tokenOrRedirect();
    if (!token) return;
    loadTests(token).catch(() => router.replace("/signin"));
  }, [loadTests, router, tokenOrRedirect]);

  useEffect(() => {
    const t = setTimeout(() => setQ(qDraft.trim()), 300);
    return () => clearTimeout(t);
  }, [qDraft]);

  useEffect(() => {
    const token = tokenOrRedirect();
    if (!token) return;
    const query = qs({ programId, subjectId, bookId, chapterId, categoryId });
    api<PickerOptions>(`/api/v1/admin/mcq-picker/options${query ? `?${query}` : ""}`, { token })
      .then(setOptions)
      .catch(() => router.replace("/signin"));
  }, [programId, subjectId, bookId, chapterId, categoryId, router, tokenOrRedirect]);

  useEffect(() => {
    setCursor(undefined);
    setCursorStack([undefined]);
  }, [programId, subjectId, bookId, chapterId, categoryId, subcategoryId, q, difficulty]);

  useEffect(() => {
    if (!bookId) {
      setPage({ items: [], nextCursor: null, totalInFilter: 0 });
      return;
    }
    const token = tokenOrRedirect();
    if (!token) return;
    let cancelled = false;
    setLoadingQs(true);
    const query = qs({ ...filterParams, cursor, take: "50" });
    api<McqPage>(`/api/v1/admin/mcqs?${query}`, { token })
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch((err) => {
        if (!cancelled) setMsg(err instanceof Error ? err.message : "Could not load questions");
      })
      .finally(() => {
        if (!cancelled) setLoadingQs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, filterParams, cursor, tokenOrRedirect]);

  function resetFrom(level: "program" | "subject" | "book" | "chapter" | "category") {
    if (level === "program") {
      setSubjectId("");
      setBookId("");
      setChapterId("");
      setCategoryId("");
      setSubcategoryId("");
    } else if (level === "subject") {
      setBookId("");
      setChapterId("");
      setCategoryId("");
      setSubcategoryId("");
    } else if (level === "book") {
      setChapterId("");
      setCategoryId("");
      setSubcategoryId("");
    } else if (level === "chapter") {
      setCategoryId("");
      setSubcategoryId("");
    } else {
      setSubcategoryId("");
    }
  }

  function addToTray(rows: TrayItem[]) {
    setTray((prev) => {
      const map = new Map(prev.map((x) => [x.id, x]));
      let skipped = 0;
      for (const row of rows) {
        if (map.has(row.id)) continue;
        if (map.size >= MAX_QUESTIONS) {
          skipped += 1;
          continue;
        }
        map.set(row.id, row);
      }
      if (skipped > 0) {
        setMsg(`Tray is capped at ${MAX_QUESTIONS} questions (${skipped} not added).`);
      }
      return [...map.values()];
    });
  }

  function toggleRow(row: McqRow) {
    if (selectedIds.has(row.id)) {
      setTray((prev) => prev.filter((x) => x.id !== row.id));
      return;
    }
    addToTray([{ id: row.id, question: row.question }]);
  }

  function selectPage() {
    addToTray(page.items.map((m) => ({ id: m.id, question: m.question })));
  }

  async function selectAllInFilter() {
    const token = tokenOrRedirect();
    if (!token || !bookId) return;
    const data = await api<{ ids: string[]; items: TrayItem[]; totalInFilter: number }>(
      `/api/v1/admin/mcqs/ids?${qs({ ...filterParams, take: String(MAX_QUESTIONS) })}`,
      { token }
    );
    addToTray(data.items);
    if (data.totalInFilter > MAX_QUESTIONS) {
      setMsg(`Added the first ${MAX_QUESTIONS} of ${data.totalInFilter} matching questions.`);
    }
  }

  async function selectRandom() {
    const token = tokenOrRedirect();
    if (!token || !bookId) return;
    const take = Math.min(MAX_QUESTIONS, Math.max(1, randomN));
    const data = await api<{ items: TrayItem[]; totalInFilter: number }>(
      `/api/v1/admin/mcqs/ids?${qs({ ...filterParams, take: String(take), random: "1" })}`,
      { token }
    );
    addToTray(data.items);
  }

  function nextPage() {
    if (!page.nextCursor) return;
    setCursorStack((s) => [...s, page.nextCursor!]);
    setCursor(page.nextCursor);
  }

  function prevPage() {
    if (cursorStack.length < 2) return;
    const next = cursorStack.slice(0, -1);
    setCursorStack(next);
    setCursor(next[next.length - 1]);
  }

  async function createTest(e: FormEvent) {
    e.preventDefault();
    const token = tokenOrRedirect();
    if (!token) return;
    if (tray.length < 1) {
      setMsg("Select at least one MCQ");
      return;
    }
    const duration = Math.round(Number(durationMinutes));
    if (!Number.isFinite(duration) || duration < 1 || duration > 300) {
      setMsg("Duration must be between 1 and 300 minutes");
      return;
    }
    const cleanPrizes = prizes
      .map((p) => ({ rank: Math.round(Number(p.rank)), amount: Number(p.amount) }))
      .filter((p) => p.rank >= 1 && p.amount > 0);
    if (giveAwards && awardMode === "fixed" && cleanPrizes.length < 1) {
      setMsg("Add at least one prize amount, or turn awards off");
      return;
    }
    const pool = giveAwards
      ? awardMode === "fixed"
        ? cleanPrizes.reduce((n, p) => n + p.amount, 0)
        : Math.round(Number(minAwardPool))
      : 0;
    if (giveAwards && awardMode === "pool" && (!Number.isFinite(pool) || pool < 1)) {
      setMsg("Enter an award pool of at least ₹1, or turn awards off");
      return;
    }
    const awardRules = !giveAwards
      ? { mode: "none" as const }
      : awardMode === "fixed"
        ? { mode: "fixed" as const, prizes: cleanPrizes }
        : {
            mode: "pool" as const,
            minAwardPool: pool,
            winnerPercent,
            topBandCount,
            topSharePercent,
          };
    try {
      const scheduledAt = new Date(Date.now() + 30_000).toISOString();
      const data = await api<{ id: string }>("/api/v1/admin/tests", {
        method: "POST",
        token,
        body: JSON.stringify({
          title,
          subject: "General",
          scheduledAt,
          durationMinutes: duration,
          entryFee,
          minAwardPool: pool,
          awardRules,
          platformFeePercent: awardMode === "pool" && giveAwards ? platformFeePercent : 0,
          negativeMark: 0,
          marksPerCorrect: 1,
          mcqIds: tray.map((t) => t.id),
        }),
      });
      setMsg(
        `Created test ${data.id} (${duration} min${
          awardRules.mode === "none" ? ", no awards" : `, ${awardRules.mode === "fixed" ? cleanPrizes.map((p) => `R${p.rank} ₹${p.amount}`).join(" · ") : `pool ₹${pool}`}`
        }, starts in ~30s)`
      );
      setTray([]);
      setFormOpen(false);
      await loadTests(token);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function declare(id: string) {
    const token = tokenOrRedirect();
    if (!token) return;
    const report = await api<{ netDistributable: number; winners: unknown[] }>(
      `/api/v1/admin/tests/${id}/declare-results`,
      { method: "POST", token }
    );
    const winners = report.winners as Array<{ rank: number; amount: number }>;
    const preview = winners.slice(0, 5).map((w) => `R${w.rank} ₹${w.amount}`).join(", ");
    setMsg(
      winners.length > 0
        ? `Results declared. Drafted ${winners.length} payout${winners.length === 1 ? "" : "s"} (₹${report.netDistributable}${
            preview ? `: ${preview}` : ""
          }). Review the list, then Approve awards to credit wallets.`
        : `Results declared. Rankings are set. No prize payouts to approve.`
    );
    await loadTests(token);
    await viewAwards(id);
  }

  async function viewAwards(id: string) {
    const token = tokenOrRedirect();
    if (!token) return;
    const report = await api<{ awards: AwardRow[] }>(`/api/v1/admin/tests/${id}/awards`, { token });
    setAwardPreview({ testId: id, awards: report.awards });
  }

  async function approve(id: string) {
    const token = tokenOrRedirect();
    if (!token) return;
    const res = await api<{ credited: number }>(`/api/v1/admin/tests/${id}/approve-awards`, {
      method: "POST",
      token,
    });
    setMsg(`Awarded ${res.credited} winners`);
    await loadTests(token);
    await viewAwards(id);
  }

  async function viewSubmissions(test: TestItem) {
    const token = tokenOrRedirect();
    if (!token) return;
    setSubmissionsFor({ testId: test.id, title: test.title });
    setSubmissionDetail(null);
    setSubmissionsError(null);
    setSubmissionsLoading(true);
    try {
      const rows = await api<LiveSubmission[]>(
        `/api/v1/admin/submissions/live?testId=${encodeURIComponent(test.id)}`,
        { token }
      );
      setSubmissions(rows);
    } catch (err) {
      setSubmissions([]);
      setSubmissionsError(err instanceof Error ? err.message : "Could not load submissions");
    } finally {
      setSubmissionsLoading(false);
    }
  }

  async function openSubmissionDetail(id: string) {
    const token = tokenOrRedirect();
    if (!token) return;
    setSubmissionsError(null);
    try {
      const data = await api<LiveSubmissionDetail>(`/api/v1/admin/submissions/live/${id}`, { token });
      setSubmissionDetail(data);
    } catch (err) {
      setSubmissionsError(err instanceof Error ? err.message : "Could not load submission");
    }
  }

  function closeSubmissions() {
    setSubmissionsFor(null);
    setSubmissions([]);
    setSubmissionDetail(null);
    setSubmissionsError(null);
  }

  return (
    <AdminShell
      title="Live tests"
      subtitle="Review scheduled contests, or create a live test when you are ready to pick questions."
    >
      {msg && !formOpen ? <p className="msg-ok mb-6">{msg}</p> : null}

      {formOpen ? (
        <AdminDialog title="Create live test" onClose={() => setFormOpen(false)} xl>
          {msg ? <p className="msg-err mb-4">{msg}</p> : null}
          <form onSubmit={createTest} className="space-y-6">
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="admin-label">Title</label>
              <input
                className="admin-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="admin-label">Duration (minutes)</label>
              <input
                type="number"
                min={1}
                max={300}
                className="admin-input"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="admin-label">Entry fee (₹) — 0 is Free</label>
              <input
                type="number"
                className="admin-input"
                value={entryFee}
                onChange={(e) => setEntryFee(Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2 rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-4">
              <div className="flex items-start justify-between gap-3">
                <label className="flex min-w-0 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 accent-[var(--accent)]"
                    checked={giveAwards}
                    onChange={(e) => setGiveAwards(e.target.checked)}
                  />
                  <span>
                    <span className="admin-label mb-0">Give awards</span>
                    <span className="mt-1 block text-sm text-[var(--ink-soft)]">
                      Set exact prizes per rank, or share a pool among the top percent.
                    </span>
                  </span>
                </label>
                <AwardHelpTip />
              </div>
              {giveAwards ? (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`btn-sm ${awardMode === "fixed" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setAwardMode("fixed")}
                    >
                      Fixed prizes
                    </button>
                    <button
                      type="button"
                      className={`btn-sm ${awardMode === "pool" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setAwardMode("pool")}
                    >
                      Shared pool
                    </button>
                  </div>
                  {awardMode === "fixed" ? (
                    <div className="space-y-3">
                      {prizes.map((p, i) => (
                        <div key={`${p.rank}-${i}`} className="grid grid-cols-[4.5rem_1fr_auto] items-end gap-2">
                          <div>
                            <label className="admin-label">Rank</label>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              className="admin-input"
                              value={p.rank}
                              onChange={(e) =>
                                setPrizes((rows) =>
                                  rows.map((row, idx) =>
                                    idx === i ? { ...row, rank: Number(e.target.value) } : row
                                  )
                                )
                              }
                            />
                          </div>
                          <div>
                            <label className="admin-label">Amount (₹)</label>
                            <input
                              type="number"
                              min={0}
                              className="admin-input"
                              value={p.amount}
                              onChange={(e) =>
                                setPrizes((rows) =>
                                  rows.map((row, idx) =>
                                    idx === i ? { ...row, amount: Number(e.target.value) } : row
                                  )
                                )
                              }
                            />
                          </div>
                          <button
                            type="button"
                            className="btn-secondary btn-sm mb-0.5"
                            onClick={() => setPrizes((rows) => rows.filter((_, idx) => idx !== i))}
                            disabled={prizes.length <= 1}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() =>
                          setPrizes((rows) => [...rows, { rank: (rows[rows.length - 1]?.rank ?? 0) + 1, amount: 100 }])
                        }
                      >
                        Add rank
                      </button>
                      <p className="text-sm text-[var(--ink-soft)]">
                        Total ₹{prizes.filter((p) => p.amount > 0).reduce((n, p) => n + Number(p.amount || 0), 0)} ·
                        unpaid ranks get nothing
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldHelp label="Award pool (₹)">
                          <p>
                            This is the <strong className="text-[var(--ink)]">minimum</strong> scholarship pot, not
                            always the exact amount paid out.
                          </p>
                          <h3 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">
                            How the net pool is built
                          </h3>
                          <ol className="mt-2 list-decimal space-y-1 pl-5">
                            <li>Gross = number of students who joined × entry fee.</li>
                            <li>Platform fee is taken from that gross.</li>
                            <li>Net starts as gross minus the fee.</li>
                            <li>
                              If gross is below this award pool, the platform tops the pot up. The top-up still
                              respects the platform fee, so the guaranteed net is{" "}
                              <strong className="text-[var(--ink)]">award pool × (100% − platform fee)</strong>.
                            </li>
                            <li>
                              If entry fees already beat the award pool, winners share the larger net. Extra
                              collection is not thrown away.
                            </li>
                          </ol>
                          <h3 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">
                            Examples with a ₹1,000 pool and 10% fee
                          </h3>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>2 joiners at ₹10: gross ₹20. Too small, so the pot is topped up. Net ≈ ₹900.</li>
                            <li>20 joiners at ₹100: gross ₹2,000. No top-up. Net = ₹1,800 to share.</li>
                          </ul>
                          <p className="mt-3">
                            This number is what students see as the prize line on Quiz. Set it to what you are
                            willing to guarantee if few people join.
                          </p>
                        </FieldHelp>
                        <input
                          type="number"
                          min={1}
                          className="admin-input"
                          value={minAwardPool}
                          onChange={(e) => setMinAwardPool(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <FieldHelp label="Winners (top %)">
                          <p>
                            How wide the paid group is. The system takes this percent of{" "}
                            <strong className="text-[var(--ink)]">students who joined</strong>, rounds up, and pays
                            that many of the <strong className="text-[var(--ink)]">highest-ranked submitted</strong>{" "}
                            attempts.
                          </p>
                          <h3 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">
                            The rule
                          </h3>
                          <p className="mt-2">
                            Winner count = <strong className="text-[var(--ink)]">ceil(joined × this % / 100)</strong>.
                            If anyone joined, the count is at least 1. If fewer people submit than that count, only
                            those who finished can be paid.
                          </p>
                          <h3 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">
                            Examples at 30%
                          </h3>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>10 joined → ceil(3.0) = 3 winners (ranks 1–3).</li>
                            <li>11 joined → ceil(3.3) = 4 winners.</li>
                            <li>1 joined → 1 winner, even though 30% of 1 is 0.3.</li>
                            <li>100% means every joiner who submitted can receive a share.</li>
                          </ul>
                          <p className="mt-3">
                            This only decides <em>who is in the paid group</em>. How much each of them gets is
                            controlled by top band size and top band share.
                          </p>
                        </FieldHelp>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className="admin-input"
                          value={winnerPercent}
                          onChange={(e) => setWinnerPercent(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <FieldHelp label="Top band size">
                          <p>
                            Inside the winner group, this is how many leading ranks are treated as the{" "}
                            <strong className="text-[var(--ink)]">top band</strong> (the first prize tier). They
                            split the top band share of the net pool equally with each other.
                          </p>
                          <h3 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">
                            How it is used
                          </h3>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Ranks 1 through this number = top band.</li>
                            <li>Any remaining winners (still inside the top %) = second tier.</li>
                            <li>
                              If this number is larger than the winner count,{" "}
                              <strong className="text-[var(--ink)]">everyone is in the top band</strong>. There is
                              no second tier.
                            </li>
                          </ul>
                          <h3 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">
                            Example
                          </h3>
                          <p className="mt-2">
                            20 winners and top band size 10: ranks 1–10 share the top-band slice equally. Ranks 11–20
                            share the leftover slice equally. Each person in a tier gets the same amount — the band
                            is not 1st / 2nd / 3rd unless you use Fixed prizes instead.
                          </p>
                          <p className="mt-3">
                            Default 10 comes from a “top 10” idea. Lower it (for example 3) if you want a small
                            leading group and a larger rest of winners.
                          </p>
                        </FieldHelp>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className="admin-input"
                          value={topBandCount}
                          onChange={(e) => setTopBandCount(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <FieldHelp label="Top band share (%)">
                          <p>
                            How the <strong className="text-[var(--ink)]">net pool</strong> is split between the two
                            tiers. It is not a bonus on top of the pool — the two slices always add up to 100%.
                          </p>
                          <ul className="mt-3 list-disc space-y-1 pl-5">
                            <li>Top band slice = net pool × this %.</li>
                            <li>Rest slice = net pool × (100% − this %).</li>
                            <li>Each top-band winner gets an equal part of the top slice.</li>
                            <li>Each remaining winner gets an equal part of the rest slice.</li>
                          </ul>
                          <h3 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">
                            Example with net ₹1,000, 25% share, 10 in the top band, 20 winners
                          </h3>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Ranks 1–10 share ₹250 → ₹25 each.</li>
                            <li>Ranks 11–20 share ₹750 → ₹75 each.</li>
                          </ul>
                          <p className="mt-3">
                            Notice the “rest” can earn more per person if that slice is larger. Raise this percent
                            (for example 70%) if the leading ranks should take most of the money.
                          </p>
                          <h3 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">
                            When the whole pool is not paid
                          </h3>
                          <p className="mt-2">
                            If every winner fits in the top band (winner count ≤ top band size), they split{" "}
                            <strong className="text-[var(--ink)]">only this percent</strong>. The rest slice has
                            nobody to receive it and is not paid. Defaults of 10 winners and band size 10 hit this
                            case: 3 winners would share only 25%. Set this to{" "}
                            <strong className="text-[var(--ink)]">100%</strong> if you want the full net pool paid
                            whenever everyone is in the top band.
                          </p>
                        </FieldHelp>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="admin-input"
                          value={topSharePercent}
                          onChange={(e) => setTopSharePercent(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <FieldHelp label="Platform fee (%)">
                          <p>
                            The platform’s cut of <strong className="text-[var(--ink)]">collected entry fees</strong>{" "}
                            before scholarship money is shared. It applies only in Shared pool mode. Fixed prizes
                            ignore it.
                          </p>
                          <h3 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">
                            What it does
                          </h3>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Fee = (joiners × entry fee) × this %.</li>
                            <li>That fee is removed first. Winners share what remains (the net pool).</li>
                            <li>0% means the full collection can go to winners (still subject to the award pool).</li>
                          </ul>
                          <h3 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">
                            How it meets the award pool
                          </h3>
                          <p className="mt-2">
                            If too few people join, the platform tops up. The guaranteed net is still reduced by this
                            fee: a ₹1,000 pool at 10% guarantees about ₹900, not ₹1,000. At 0% fee the guarantee is
                            the full award pool.
                          </p>
                          <h3 className="mt-4 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">
                            Example
                          </h3>
                          <p className="mt-2">
                            50 joiners × ₹100 entry = ₹5,000 gross. At 10%, the fee is ₹500 and the net pool is
                            ₹4,500 (already above a ₹1,000 award pool, so no extra top-up).
                          </p>
                        </FieldHelp>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="admin-input"
                          value={platformFeePercent}
                          onChange={(e) => setPlatformFeePercent(Number(e.target.value))}
                        />
                      </div>
                      <p className="self-end text-sm text-[var(--ink-soft)] sm:col-span-2">
                        Top {topBandCount} winners share {topSharePercent}% of the net pool. Everyone else in the top{" "}
                        {winnerPercent}% shares the rest.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <p className="admin-label">Question bank</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <select
                className="admin-input"
                value={programId}
                onChange={(e) => {
                  setProgramId(e.target.value);
                  resetFrom("program");
                }}
              >
                <option value="">Program</option>
                {options.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                className="admin-input"
                value={subjectId}
                disabled={!programId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  resetFrom("subject");
                }}
              >
                <option value="">Subject</option>
                {options.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="admin-input"
                value={bookId}
                disabled={!subjectId}
                onChange={(e) => {
                  setBookId(e.target.value);
                  resetFrom("book");
                }}
              >
                <option value="">Book (required)</option>
                {options.books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.authorName ? `${b.name} — ${b.authorName}` : b.name}
                  </option>
                ))}
              </select>
              <select
                className="admin-input"
                value={chapterId}
                disabled={!bookId}
                onChange={(e) => {
                  setChapterId(e.target.value);
                  resetFrom("chapter");
                }}
              >
                <option value="">Chapter (optional)</option>
                {options.chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="admin-input"
                value={categoryId}
                disabled={!bookId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  resetFrom("category");
                }}
              >
                <option value="">Category (optional)</option>
                {options.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="admin-input"
                value={subcategoryId}
                disabled={!categoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
              >
                <option value="">Subcategory (optional)</option>
                {options.subcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="admin-input max-w-sm"
                placeholder="Search within questions"
                value={qDraft}
                disabled={!bookId}
                onChange={(e) => setQDraft(e.target.value)}
              />
              {(["", "easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d || "all"}
                  type="button"
                  className={`btn-sm ${difficulty === d ? "btn-primary" : "btn-secondary"}`}
                  disabled={!bookId}
                  onClick={() => setDifficulty(d)}
                >
                  {d ? d : "All difficulty"}
                </button>
              ))}
            </div>
          </div>

          {!bookId ? (
            <p className="text-sm text-[var(--muted)]">
              Choose a program, subject, and book to load questions. The full bank is never listed.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-[var(--ink-soft)]">
                  {loadingQs ? "Loading…" : `${page.totalInFilter} matching`} · page{" "}
                  {cursorStack.length}
                </p>
                <button type="button" className="btn-secondary btn-sm" onClick={selectPage} disabled={page.items.length === 0}>
                  Select page
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => void selectAllInFilter()}
                  disabled={page.totalInFilter === 0}
                >
                  Select all in filter
                </button>
                <input
                  type="number"
                  min={1}
                  max={MAX_QUESTIONS}
                  className="admin-input w-20"
                  value={randomN}
                  onChange={(e) => setRandomN(Number(e.target.value))}
                />
                <button type="button" className="btn-secondary btn-sm" onClick={() => void selectRandom()}>
                  Random N
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm ml-auto"
                  onClick={prevPage}
                  disabled={cursorStack.length < 2}
                >
                  Previous
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={nextPage} disabled={!page.nextCursor}>
                  Next 50
                </button>
              </div>
              <div className="max-h-72 overflow-auto rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--bg-elevated)]">
                {page.items.length === 0 && !loadingQs ? (
                  <p className="p-4 text-sm text-[var(--muted)]">No questions in this filter.</p>
                ) : (
                  <div className="row-list">
                    {page.items.map((m) => (
                      <label key={m.id} className="flex cursor-pointer gap-3 px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-[var(--accent)]"
                          checked={selectedIds.has(m.id)}
                          onChange={() => toggleRow(m)}
                        />
                        <span>
                          {m.chapter ? <span className="chip chip-accent mr-2">{m.chapter.title}</span> : null}
                          {m.difficulty ? <span className="chip mr-2">{m.difficulty}</span> : null}
                          {m.question}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="admin-label mb-0">Selected tray ({tray.length}/{MAX_QUESTIONS})</label>
              {tray.length > 0 ? (
                <button type="button" className="btn-secondary btn-sm" onClick={() => setTray([])}>
                  Clear tray
                </button>
              ) : null}
            </div>
            <div className="max-h-40 overflow-auto rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--bg-elevated)]">
              {tray.length === 0 ? (
                <p className="p-4 text-sm text-[var(--muted)]">Nothing selected yet. Choices stay while you page.</p>
              ) : (
                <div className="row-list">
                  {tray.map((t) => (
                    <div key={t.id} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
                      <span>{t.question}</span>
                      <button
                        type="button"
                        className="btn-secondary btn-sm shrink-0"
                        onClick={() => setTray((prev) => prev.filter((x) => x.id !== t.id))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button className="btn-primary" disabled={tray.length < 1}>
            Create (starts in 30s)
          </button>
        </form>
        </AdminDialog>
      ) : null}

      <PageSection
        title="Scheduled & live"
        action={
          <button type="button" className="btn-primary btn-sm" onClick={() => { setMsg(null); setFormOpen(true); }}>
            Create live test
          </button>
        }
      >
        {tests.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No tests yet.</p>
        ) : (
          <div className="row-list">
            {tests.map((t) => (
              <div key={t.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    <span className="chip chip-accent mr-2">{t.status}</span>
                    {t.durationMinutes} min · {Number(t.entryFee) === 0 ? "Free" : `₹${t.entryFee}`} ·{" "}
                    {t.awardLabel || (Number(t.minAwardPool) > 0 ? `Pool ₹${t.minAwardPool}` : "No awards")} ·{" "}
                    {t.scheduledAt ? new Date(t.scheduledAt).toLocaleString() : "On demand"} ·{" "}
                    {t.participantCount} joined
                  </p>
                  {awardPreview?.testId === t.id ? (
                    <div className="mt-3 space-y-1 text-sm text-[var(--ink-soft)]">
                      {awardPreview.awards.length === 0 ? (
                        <p>No award rows yet. Declare results first.</p>
                      ) : (
                        awardPreview.awards.map((a) => (
                          <p key={`${a.rank}-${a.email}`}>
                            Rank {a.rank} · ₹{a.amount} · {a.fullName || a.email} · {awardStatusLabel(a.status)}
                          </p>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void viewSubmissions(t)} className="btn-secondary btn-sm" type="button">
                    Submissions
                  </button>
                  <button
                    onClick={() => declare(t.id)}
                    className="btn-secondary btn-sm"
                    type="button"
                    disabled={t.status === "COMPLETED" || t.status === "CANCELLED"}
                  >
                    {t.status === "COMPLETED"
                      ? "Results declared"
                      : t.status === "CANCELLED"
                        ? "Cancelled"
                        : "Declare results"}
                  </button>
                  {Number(t.minAwardPool) > 0 || (t.pendingAwardCount ?? 0) > 0 || (t.creditedAwardCount ?? 0) > 0 ? (
                    <>
                      <button onClick={() => void viewAwards(t.id)} className="btn-secondary btn-sm" type="button">
                        View awards
                      </button>
                      <button
                        onClick={() => void approve(t.id)}
                        className="btn-primary btn-sm"
                        type="button"
                        disabled={(t.pendingAwardCount ?? 0) < 1}
                      >
                        {(t.creditedAwardCount ?? 0) > 0 && (t.pendingAwardCount ?? 0) < 1
                          ? "Awards approved"
                          : "Approve awards"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      {submissionsFor ? (
        <AdminDialog
          title={
            submissionDetail
              ? `${submissionDetail.fullName ?? submissionDetail.email} · ${submissionsFor.title}`
              : `${submissionsFor.title} — submissions`
          }
          onClose={closeSubmissions}
          wide
        >
          {submissionsError ? <p className="msg-err mb-3">{submissionsError}</p> : null}
          {submissionDetail ? (
            <>
              <button
                type="button"
                className="btn-secondary btn-sm mb-4"
                onClick={() => setSubmissionDetail(null)}
              >
                Back to list
              </button>
              <div className="mb-6 space-y-1">
                <p className="text-sm text-[var(--ink-soft)]">
                  {submissionDetail.fullName ?? "—"} · {submissionDetail.email}
                </p>
                <p className="text-sm text-[var(--ink-soft)]">
                  Score {submissionDetail.score} · {submissionDetail.correctCount} correct ·{" "}
                  {submissionDetail.incorrectCount} incorrect · {submissionDetail.skippedCount} skipped
                  {submissionDetail.rank != null ? ` · Rank ${submissionDetail.rank}` : ""}
                  {submissionDetail.appSwitchCount > 0
                    ? ` · App switches ${submissionDetail.appSwitchCount}`
                    : ""}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {submissionDetail.status}
                  {submissionDetail.submittedAt
                    ? ` · ${new Date(submissionDetail.submittedAt).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <div className="row-list">
                {submissionDetail.answers.map((a) => (
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
                {submissionDetail.answers.length === 0 ? (
                  <p className="py-3 text-sm text-[var(--muted)]">No answer rows stored.</p>
                ) : null}
              </div>
            </>
          ) : submissionsLoading ? (
            <p className="text-sm text-[var(--muted)]">Loading submissions…</p>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No submitted attempts for this test yet.</p>
          ) : (
            <div className="row-list">
              {submissions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => void openSubmissionDetail(r.id)}
                  className="flex w-full flex-col gap-1 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{r.fullName ?? "—"}</p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">{r.email}</p>
                  </div>
                  <div className="text-sm text-[var(--ink-soft)] sm:text-right">
                    <p className="metric font-semibold text-[var(--ink)]">Score {r.score}</p>
                    <p>
                      <span className="chip chip-accent mr-1">{r.status}</span>
                      {r.rank != null ? `Rank ${r.rank} · ` : ""}
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminDialog>
      ) : null}
    </AdminShell>
  );
}

function FieldHelp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
      <HelpPopup title={label} compact>
        <div className="space-y-2 text-sm leading-relaxed text-[var(--ink-soft)]">{children}</div>
      </HelpPopup>
    </div>
  );
}

function AwardHelpTip() {
  return (
    <HelpPopup title="How awards work">
      <div className="space-y-5 text-sm leading-relaxed text-[var(--ink-soft)]">
        <p>
          Leave <strong className="text-[var(--ink)]">Give awards</strong> off for a scored contest with no prize
          money. Turn it on to choose either fixed prizes or a shared pool. Students see that prize line on Quiz.
        </p>
        <section>
          <h3 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">Fixed prizes</h3>
          <p className="mt-2">
            You set each rank and rupee amount. Rank 1 gets exactly that amount, rank 2 theirs, and so on.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Ranks you do not list get nothing.</li>
            <li>If fewer students finish than prize rows, leftover ranks are unpaid.</li>
            <li>The total is the sum of the rows — entry fees and platform fee do not change these amounts.</li>
          </ul>
        </section>
        <section>
          <h3 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">Shared pool</h3>
          <p className="mt-2">
            The award pool is the minimum pot. Net pool = entry fees minus platform fee, or a topped-up guarantee if
            collection is too small (guarantee = award pool × (100% − fee)). If collection is larger, winners share
            that larger net.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong className="text-[var(--ink)]">Winners (top %)</strong> — ceil(joined × %) people, at least one.
              Only submitted attempts are paid, in rank order.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Top band size</strong> — how many leading winners sit in the first
              tier and split the top-band slice equally.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Top band share %</strong> — that first-tier slice of the net pool.
              Remaining winners split the other slice equally.
            </li>
            <li>
              If every winner fits in the top band, they share only the top-band percent. The leftover slice is not
              paid. Set share to 100% to pay the full net in that case.
            </li>
          </ul>
          <p className="mt-2">Open the ? next to each Shared pool field for examples.</p>
        </section>
        <section>
          <h3 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">Ranking</h3>
          <p className="mt-2">Higher score wins. Ties break in this order:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Faster time</li>
            <li>More correct</li>
            <li>Fewer incorrect</li>
            <li>Who submitted first</li>
          </ol>
        </section>
        <section>
          <h3 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">After the test</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              <strong className="text-[var(--ink)]">Declare results</strong> — rank everyone and draft pending
              payouts.
            </li>
            <li>
              <strong className="text-[var(--ink)]">View awards</strong> — check the list.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Approve awards</strong> — credit each winner’s Award wallet.
            </li>
          </ol>
          <p className="mt-2">Withdrawals from that wallet still need finance review.</p>
        </section>
      </div>
    </HelpPopup>
  );
}

function HelpPopup({
  title,
  children,
  compact,
}: {
  title: string;
  children: ReactNode;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const headingId = `help-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={title}
        onClick={() => setOpen(true)}
        className={`flex items-center justify-center rounded-full border border-[var(--line)] font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)] ${
          compact ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm"
        }`}
      >
        ?
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                className="max-h-[min(36rem,calc(100vh-2rem))] w-full max-w-lg overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-card)]"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id={headingId} className="text-xl font-extrabold tracking-tight text-[var(--ink)]">
                  {title}
                </h2>
                <div className="mt-5">{children}</div>
                <button type="button" className="btn-primary mt-6 w-full" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
