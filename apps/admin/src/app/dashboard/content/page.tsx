"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog, AdminShell, PageSection } from "@/components/admin-shell";
import { adminTokenKey, api, apiUpload } from "@/lib/api";
import {
  SERVER_IMPORT_BYTES,
  SERVER_IMPORT_ROWS,
  chunk,
  hasCatalogPath,
  mapBookRows,
  mapFlashRows,
  mapMcqRows,
  parseSpreadsheetFile,
  type RowError,
} from "@/lib/spreadsheet";

type ImportKind = "mcq" | "flash" | "book";

function importResultMessage(
  kind: ImportKind,
  data: {
    created: number;
    skipped?: number;
    questionsCreated?: number;
    questionsSkipped?: number;
    categoriesCreated?: number;
    subcategoriesCreated?: number;
    errorCount?: number;
  }
) {
  const noun = kind === "mcq" ? "MCQ" : kind === "flash" ? "flash card" : "book";
  const parts = [`Imported ${data.created} ${noun}${data.created === 1 ? "" : "s"}`];
  if (kind === "book") {
    if (data.categoriesCreated) {
      parts.push(`${data.categoriesCreated} categor${data.categoriesCreated === 1 ? "y" : "ies"}`);
    }
    if (data.subcategoriesCreated) {
      parts.push(
        `${data.subcategoriesCreated} subcategor${data.subcategoriesCreated === 1 ? "y" : "ies"}`
      );
    }
    if (data.questionsCreated || data.questionsSkipped) {
      parts.push(`${data.questionsCreated ?? 0} question${data.questionsCreated === 1 ? "" : "s"}`);
      if (data.questionsSkipped) {
        parts.push(`${data.questionsSkipped} question${data.questionsSkipped === 1 ? "" : "s"} skipped`);
      }
    }
  }
  if (data.skipped) parts.push(`${data.skipped} skipped (duplicates)`);
  if (data.errorCount) parts.push(`${data.errorCount} row error(s)`);
  return parts.join(" · ");
}

type Chapter = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  status: string;
  mcqCount: number;
  flashCardCount: number;
};

type FlashRow = {
  id: string;
  front: string;
  back: string;
  subject: string | null;
  createdAt: string;
  chapter: { id: string; title: string; subject: string } | null;
};

type McqRow = {
  id: string;
  question: string;
  correctOption: string;
  subject: string | null;
  createdAt: string;
  chapter: { id: string; title: string; subject: string } | null;
};

type Panel = null | "chapter" | "mcq" | "flash" | "import";

export default function ContentPage() {
  const router = useRouter();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [flashCards, setFlashCards] = useState<FlashRow[]>([]);
  const [mcqs, setMcqs] = useState<McqRow[]>([]);
  const [libraryFilter, setLibraryFilter] = useState<string>("all");
  const [libraryTab, setLibraryTab] = useState<"mcq" | "flash">("mcq");
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [chapterForm, setChapterForm] = useState({
    title: "",
    subject: "",
    description: "",
  });
  const [flashFront, setFlashFront] = useState("");
  const [flashBack, setFlashBack] = useState("");
  const [mcq, setMcq] = useState({
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "A",
    explanation: "",
  });
  const [importKind, setImportKind] = useState<ImportKind>("mcq");
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<RowError[]>([]);
  const [importReady, setImportReady] = useState(0);
  const [importBusy, setImportBusy] = useState(false);
  const [pendingMcqs, setPendingMcqs] = useState<ReturnType<typeof mapMcqRows>["items"]>([]);
  const [pendingFlash, setPendingFlash] = useState<ReturnType<typeof mapFlashRows>["items"]>([]);
  const [pendingBooks, setPendingBooks] = useState<ReturnType<typeof mapBookRows>["items"]>([]);
  const [serverFile, setServerFile] = useState<File | null>(null);
  const [createMissingPath, setCreateMissingPath] = useState(true);

  const selected = useMemo(
    () => chapters.find((c) => c.id === selectedId) ?? null,
    [chapters, selectedId]
  );

  const loadAll = useCallback(async () => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) {
      router.replace("/signin");
      return;
    }
    const mcqQs = new URLSearchParams({ take: "100" });
    if (libraryFilter !== "all") mcqQs.set("chapterId", libraryFilter);
    const [c, f, m] = await Promise.all([
      api<Chapter[]>("/api/v1/admin/chapters", { token }),
      api<FlashRow[]>("/api/v1/admin/flashcards", { token }),
      api<{ items: McqRow[] }>(`/api/v1/admin/mcqs?${mcqQs}`, { token }),
    ]);
    setChapters(c);
    setFlashCards(f);
    setMcqs(m.items);
    setSelectedId((prev) => prev || c[0]?.id || "");
  }, [router, libraryFilter]);

  useEffect(() => {
    loadAll().catch(() => router.replace("/signin"));
  }, [loadAll, router]);

  function resetImport() {
    setImportFileName(null);
    setImportErrors([]);
    setImportReady(0);
    setPendingMcqs([]);
    setPendingFlash([]);
    setPendingBooks([]);
    setServerFile(null);
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setMsg(null);
    try {
      if (file.size > SERVER_IMPORT_BYTES) {
        setServerFile(file);
        setPendingMcqs([]);
        setPendingFlash([]);
        setPendingBooks([]);
        setImportErrors([]);
        setImportReady(-1);
        setImportFileName(file.name);
        return;
      }
      const rows = await parseSpreadsheetFile(file);
      if (rows.length === 0) {
        resetImport();
        setError("No data rows found in that file");
        return;
      }
      if (rows.length > SERVER_IMPORT_ROWS) {
        setServerFile(file);
        setPendingMcqs([]);
        setPendingFlash([]);
        setPendingBooks([]);
        setImportErrors([]);
        setImportReady(-1);
        setImportFileName(`${file.name} · ${rows.length} rows (server import)`);
        return;
      }
      setServerFile(null);
      if (importKind === "mcq") {
        const mapped = mapMcqRows(rows);
        setPendingMcqs(mapped.items);
        setPendingFlash([]);
        setPendingBooks([]);
        setImportErrors(mapped.errors);
        setImportReady(mapped.items.length);
      } else if (importKind === "flash") {
        const mapped = mapFlashRows(rows);
        setPendingFlash(mapped.items);
        setPendingMcqs([]);
        setPendingBooks([]);
        setImportErrors(mapped.errors);
        setImportReady(mapped.items.length);
      } else {
        const mapped = mapBookRows(rows);
        setPendingBooks(mapped.items);
        setPendingMcqs([]);
        setPendingFlash([]);
        setImportErrors(mapped.errors);
        setImportReady(mapped.items.length);
      }
      setImportFileName(file.name);
    } catch (err) {
      resetImport();
      setError(err instanceof Error ? err.message : "Could not read file");
    }
  }

  async function runImport() {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    const path =
      importKind === "mcq"
        ? "/api/v1/admin/mcqs"
        : importKind === "flash"
          ? "/api/v1/admin/flashcards"
          : "/api/v1/admin/books/import";
    const items =
      importKind === "mcq" ? pendingMcqs : importKind === "flash" ? pendingFlash : pendingBooks;
    if (!serverFile && items.length === 0) {
      setError("Fix the row errors or choose a file with valid rows");
      return;
    }
    if (
      importKind !== "book" &&
      !serverFile &&
      !selectedId &&
      items.some((item) => !hasCatalogPath(item as { program?: string; subject?: string; book?: string; chapter?: string; category?: string }))
    ) {
      setError("Select a default chapter, or include program/subject/book/chapter in the file");
      return;
    }
    setImportBusy(true);
    setError(null);
    try {
      if (serverFile) {
        const data = await apiUpload<{
          created: number;
          skipped: number;
          questionsCreated?: number;
          questionsSkipped?: number;
          categoriesCreated?: number;
          subcategoriesCreated?: number;
          errors: RowError[];
          errorCount: number;
        }>(
          "/api/v1/admin/imports",
          serverFile,
          {
            kind: importKind,
            defaultChapterId: selectedId || undefined,
            createMissingPath: createMissingPath ? "true" : "false",
          },
          token
        );
        setMsg(importResultMessage(importKind, data));
        if (data.errors?.length) setImportErrors(data.errors);
      } else {
        let created = 0;
        let skipped = 0;
        let questionsCreated = 0;
        let questionsSkipped = 0;
        let categoriesCreated = 0;
        let subcategoriesCreated = 0;
        const rowErrors: RowError[] = [...importErrors];
        const batches =
          importKind === "mcq"
            ? chunk(pendingMcqs, 500)
            : importKind === "flash"
              ? chunk(pendingFlash, 500)
              : chunk(pendingBooks, 500);
        for (const batch of batches) {
          const data = await api<{
            created: number;
            skipped?: number;
            questionsCreated?: number;
            questionsSkipped?: number;
            categoriesCreated?: number;
            subcategoriesCreated?: number;
            errors?: RowError[];
          }>(path, {
            method: "POST",
            token,
            body: JSON.stringify({
              items: batch,
              defaultChapterId: selectedId || undefined,
              createMissingPath,
            }),
          });
          created += data.created;
          skipped += data.skipped ?? 0;
          questionsCreated += data.questionsCreated ?? 0;
          questionsSkipped += data.questionsSkipped ?? 0;
          categoriesCreated += data.categoriesCreated ?? 0;
          subcategoriesCreated += data.subcategoriesCreated ?? 0;
          if (data.errors?.length) rowErrors.push(...data.errors);
        }
        setMsg(
          importResultMessage(importKind, {
            created,
            skipped,
            questionsCreated,
            questionsSkipped,
            categoriesCreated,
            subcategoriesCreated,
            errorCount: rowErrors.length,
          })
        );
        if (rowErrors.length) setImportErrors(rowErrors);
      }
      resetImport();
      setOpenPanel(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function createChapter(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setError(null);
    try {
      const data = await api<Chapter>("/api/v1/admin/chapters", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: chapterForm.title,
          subject: chapterForm.subject,
          description: chapterForm.description || undefined,
        }),
      });
      setMsg(`Chapter “${data.title}” created`);
      setChapterForm({ title: "", subject: "", description: "" });
      setOpenPanel(null);
      await loadAll();
      setSelectedId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function addFlash(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token || !selectedId) return;
    setError(null);
    try {
      const data = await api<{ created: number }>("/api/v1/admin/flashcards", {
        method: "POST",
        token,
        body: JSON.stringify({
          front: flashFront,
          back: flashBack,
          chapterId: selectedId,
        }),
      });
      setMsg(`Created ${data.created} flash card(s)`);
      setFlashFront("");
      setFlashBack("");
      setOpenPanel(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function addMcq(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token || !selectedId) return;
    setError(null);
    try {
      const data = await api<{ created: number }>("/api/v1/admin/mcqs", {
        method: "POST",
        token,
        body: JSON.stringify({ ...mcq, chapterId: selectedId }),
      });
      setMsg(`Created ${data.created} MCQ(s)`);
      setMcq({
        question: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctOption: "A",
        explanation: "",
      });
      setOpenPanel(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  const filteredMcqs =
    libraryFilter === "all" ? mcqs : mcqs.filter((m) => m.chapter?.id === libraryFilter);
  const filteredFlash =
    libraryFilter === "all"
      ? flashCards
      : flashCards.filter((f) => f.chapter?.id === libraryFilter);

  return (
    <AdminShell
      title="Content"
      subtitle="Browse chapters and question history. Open a form only when you need to add or import."
    >
      {msg ? <p className="msg-ok mb-4">{msg}</p> : null}
      {error ? <p className="msg-err mb-4">{error}</p> : null}

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => setOpenPanel("chapter")}
        >
          Add chapter
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => setOpenPanel("mcq")}
          disabled={chapters.length === 0}
        >
          Add MCQ to chapter
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => setOpenPanel("flash")}
          disabled={chapters.length === 0}
        >
          Add flash card to chapter
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            resetImport();
            setImportKind("mcq");
            setOpenPanel("import");
          }}
        >
          Import CSV / Excel
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            resetImport();
            setImportKind("book");
            setOpenPanel("import");
          }}
        >
          Import book
        </button>
      </div>

      {openPanel === "chapter" ? (
        <AdminDialog title="New chapter" onClose={() => setOpenPanel(null)}>
          <form onSubmit={createChapter} className="space-y-4">
            <div>
              <label className="admin-label">Subject</label>
              <input
                className="admin-input"
                placeholder="Science"
                value={chapterForm.subject}
                onChange={(e) => setChapterForm({ ...chapterForm, subject: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="admin-label">Chapter title</label>
              <input
                className="admin-input"
                placeholder="Basics of Science"
                value={chapterForm.title}
                onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="admin-label">Description (optional)</label>
              <input
                className="admin-input"
                value={chapterForm.description}
                onChange={(e) => setChapterForm({ ...chapterForm, description: e.target.value })}
              />
            </div>
            <button className="btn-primary">Save chapter</button>
          </form>
        </AdminDialog>
      ) : null}

      {openPanel === "mcq" ? (
        <AdminDialog title="New MCQ" onClose={() => setOpenPanel(null)}>
          <form onSubmit={addMcq} className="space-y-4">
            <div>
              <label className="admin-label">Chapter</label>
              <select
                className="admin-input"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                required
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subject} · {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-label">Question</label>
              <input
                className="admin-input"
                value={mcq.question}
                onChange={(e) => setMcq({ ...mcq, question: e.target.value })}
                required
              />
            </div>
            {(["optionA", "optionB", "optionC", "optionD"] as const).map((k, i) => (
              <div key={k}>
                <label className="admin-label">Option {String.fromCharCode(65 + i)}</label>
                <input
                  className="admin-input"
                  value={mcq[k]}
                  onChange={(e) => setMcq({ ...mcq, [k]: e.target.value })}
                  required
                />
              </div>
            ))}
            <div>
              <label className="admin-label">Correct option</label>
              <select
                className="admin-input"
                value={mcq.correctOption}
                onChange={(e) => setMcq({ ...mcq, correctOption: e.target.value })}
              >
                {["A", "B", "C", "D"].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-label">Explanation</label>
              <input
                className="admin-input"
                value={mcq.explanation}
                onChange={(e) => setMcq({ ...mcq, explanation: e.target.value })}
              />
            </div>
            <button className="btn-primary" disabled={!selected}>
              Save MCQ
            </button>
          </form>
        </AdminDialog>
      ) : null}

      {openPanel === "flash" ? (
        <AdminDialog title="New flash card" onClose={() => setOpenPanel(null)}>
          <form onSubmit={addFlash} className="space-y-4">
            <div>
              <label className="admin-label">Chapter</label>
              <select
                className="admin-input"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                required
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subject} · {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-label">Front</label>
              <input
                className="admin-input"
                value={flashFront}
                onChange={(e) => setFlashFront(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="admin-label">Back</label>
              <input
                className="admin-input"
                value={flashBack}
                onChange={(e) => setFlashBack(e.target.value)}
                required
              />
            </div>
            <button className="btn-primary" disabled={!selected}>
              Save flash card
            </button>
          </form>
        </AdminDialog>
      ) : null}

      {openPanel === "import" ? (
        <AdminDialog title="Import CSV / Excel / JSON" onClose={() => setOpenPanel(null)}>
          <p className="text-sm text-[var(--ink-soft)]">
            {importKind === "book" ? (
              <>
                Each row needs <strong>program, subject, book</strong>. Add{" "}
                <strong>chapter, category, subcategory</strong> to build the tree, and{" "}
                <strong>question, optionA–D, correctOption</strong> to import questions on the same
                row. Program and subject must already exist on Syllabus.
              </>
            ) : (
              <>
                Include <strong>program, subject, book, author, chapter, category, subcategory</strong>{" "}
                so rows land in the tree. A selected chapter is only the fallback when those columns
                are blank. Files over ~2,000 rows are uploaded to the server.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <a className="text-[var(--accent)] underline-offset-2 hover:underline" href="/templates/mcq-template.csv">
              MCQ template
            </a>
            <a
              className="text-[var(--accent)] underline-offset-2 hover:underline"
              href="/templates/flashcards-template.csv"
            >
              Flash card template
            </a>
            <a
              className="text-[var(--accent)] underline-offset-2 hover:underline"
              href="/templates/books-template.csv"
            >
              Book template
            </a>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="admin-label">Type</label>
              <select
                className="admin-input"
                value={importKind}
                onChange={(e) => {
                  setImportKind(e.target.value as ImportKind);
                  resetImport();
                }}
              >
                <option value="mcq">MCQs</option>
                <option value="flash">Flash cards</option>
                <option value="book">Books</option>
              </select>
            </div>
            {importKind !== "book" ? (
              <div>
                <label className="admin-label">Default chapter (optional)</label>
                <select
                  className="admin-input"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  <option value="">None — path columns in the file</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.subject} · {c.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                checked={createMissingPath}
                onChange={(e) => setCreateMissingPath(e.target.checked)}
              />
              {importKind === "book"
                ? "Create missing author, chapter, and category"
                : "Create missing book / author / chapter / category / subcategory"}
            </label>
            <div>
              <label className="admin-label">File</label>
              <input
                className="admin-input"
                type="file"
                accept=".csv,.xlsx,.xls,.json,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json"
                onChange={(e) => onImportFile(e.target.files?.[0])}
              />
            </div>
            {importFileName ? (
              <p className="text-sm text-[var(--ink-soft)]">
                {importFileName}
                {importReady >= 0
                  ? ` · ${importReady} valid row${importReady === 1 ? "" : "s"}`
                  : " · will be parsed on the server"}
                {importErrors.length ? ` · ${importErrors.length} skipped` : ""}
              </p>
            ) : null}
            {importErrors.length > 0 ? (
              <div className="max-h-40 overflow-auto rounded-[var(--radius-md)] border border-[var(--line)] p-3 text-sm text-[var(--ink-soft)]">
                {importErrors.slice(0, 30).map((err) => (
                  <p key={`${err.row}-${err.message}`}>
                    Row {err.row}: {err.message}
                  </p>
                ))}
                {importErrors.length > 30 ? (
                  <p>…and {importErrors.length - 30} more</p>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="btn-primary"
              disabled={importBusy || (!serverFile && importReady <= 0)}
              onClick={() => void runImport()}
            >
              {importBusy
                ? "Importing…"
                : serverFile
                  ? "Upload and import"
                  : `Import ${importReady} row${importReady === 1 ? "" : "s"}`}
            </button>
          </div>
        </AdminDialog>
      ) : null}

      <PageSection title="Chapters">
        {chapters.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No chapters yet. Use <strong>Add chapter</strong> to start.
          </p>
        ) : (
          <div className="row-list">
            {chapters.map((c) => (
              <div key={c.id} className="py-3">
                <p className="font-semibold">{c.title}</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  {c.subject} · {c.mcqCount} MCQs · {c.flashCardCount} flash cards
                  {c.description ? ` · ${c.description}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Library history">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`btn-sm ${libraryTab === "mcq" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setLibraryTab("mcq")}
          >
            MCQs ({filteredMcqs.length})
          </button>
          <button
            type="button"
            className={`btn-sm ${libraryTab === "flash" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setLibraryTab("flash")}
          >
            Flash cards ({filteredFlash.length})
          </button>
          <select
            className="admin-input ml-auto max-w-xs"
            value={libraryFilter}
            onChange={(e) => setLibraryFilter(e.target.value)}
          >
            <option value="all">All chapters</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.subject} · {c.title}
              </option>
            ))}
          </select>
        </div>

        {libraryTab === "mcq" ? (
          filteredMcqs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No MCQs yet.</p>
          ) : (
            <div className="row-list">
              {filteredMcqs.map((m) => (
                <div key={m.id} className="py-3">
                  <p className="font-semibold">{m.question}</p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {m.chapter ? (
                      <span className="chip chip-accent mr-2">{m.chapter.title}</span>
                    ) : (
                      <span className="chip mr-2">Unassigned</span>
                    )}
                    Answer {m.correctOption} · {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )
        ) : filteredFlash.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No flash cards yet.</p>
        ) : (
          <div className="row-list">
            {filteredFlash.map((f) => (
              <div key={f.id} className="py-3">
                <p className="font-semibold">{f.front}</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">{f.back}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {f.chapter ? (
                    <span className="chip chip-accent mr-2">{f.chapter.title}</span>
                  ) : (
                    <span className="chip mr-2">Unassigned</span>
                  )}
                  {new Date(f.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </PageSection>
    </AdminShell>
  );
}
