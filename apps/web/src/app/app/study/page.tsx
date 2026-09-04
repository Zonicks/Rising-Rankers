"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StudySkeleton } from "@/components/skeleton";
import { UnlockBookSheet } from "@/components/unlock-book-sheet";
import { api, tokenKey } from "@/lib/api";

type Chapter = {
  id: string;
  title: string;
  completionPct: number;
  masteryPct: number | null;
  masteryAttempts: number;
  reliable: boolean;
  mcqCount: number;
  flashCount: number;
};

type Subject = {
  id: string;
  name: string;
  blurb: string | null;
  addon?: boolean;
  completionPct: number;
  masteryPct: number | null;
  reliable: boolean;
  cta: "practice" | "review";
  chapters: Chapter[];
};

type CatalogBook = {
  id: string;
  title: string;
  subtitle: string;
  authorName: string;
  subjectId: string;
  subjectName: string;
  cta: "study" | "add" | "unlock";
  price: number;
  granted: boolean;
  inProgram: boolean;
  chapters: Array<{ id: string; title: string; mcqCount: number; flashCount: number }>;
};

type Tracker = {
  program: { name: string } | null;
  completion: { pct: number; touchedModules: number; totalModules: number };
  subjects: Subject[];
  recommended: {
    chapterId: string;
    title: string;
    subjectId: string;
    subjectName: string;
    reason: string;
  } | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function StudyPage() {
  return (
    <Suspense
      fallback={
        <AppShell wide>
          <StudySkeleton />
        </AppShell>
      }
    >
      <StudyInner />
    </Suspense>
  );
}

function StudyInner() {
  const router = useRouter();
  const search = useSearchParams();
  const subjectId = search.get("subjectId");
  const bookId = search.get("bookId");
  const [data, setData] = useState<Tracker | null>(null);
  const [book, setBook] = useState<CatalogBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      router.replace("/auth");
      return;
    }
    api<Tracker>("/api/v1/me/tracker", { token })
      .then(setData)
      .catch((e) => setError(e.message));
    if (bookId) {
      api<CatalogBook>(`/api/v1/catalog/books/${bookId}`, { token })
        .then(setBook)
        .catch((e) => setError(e.message));
    } else {
      setBook(null);
    }
  }, [router, bookId]);

  const focused = useMemo(
    () => data?.subjects.find((s) => s.id === subjectId) ?? null,
    [data, subjectId]
  );

  const rec = data?.recommended;
  const waitingOnBook = Boolean(bookId) && !book && !error;
  const waitingOnTracker = !data && !error;

  if (!data && error) {
    return (
      <AppShell wide>
        <p className="msg-err">{error}</p>
      </AppShell>
    );
  }

  if (waitingOnTracker || waitingOnBook) {
    return (
      <AppShell wide>
        <StudySkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      {error ? <p className="msg-err mb-6">{error}</p> : null}

      {book ? (
        <div className="mb-6">
          <Link href="/app/search" className="text-sm font-semibold text-[var(--accent)]">
            ← Search
          </Link>
          <p className="page-kicker mt-4">{book.inProgram ? "In syllabus" : "Add-on"}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{book.title}</h1>
          <p className="mt-2 text-[var(--ink-soft)]">{book.subtitle}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="chip">{book.inProgram ? "In your syllabus" : `${book.subjectName} add-on`}</span>
            <span className={`text-sm font-bold ${book.price === 0 ? "text-[var(--success)]" : ""}`}>
              {book.price === 0 || book.granted ? "FREE" : `₹${book.price}`}
            </span>
          </div>
          {book.cta !== "study" ? (
            <div className="mt-4">
              <p className="text-sm text-[var(--ink-soft)]">
                Add this book to practice its chapters. Browse the list below while you decide.
              </p>
              <button type="button" className="btn-primary mt-3" onClick={() => setPayOpen(true)}>
                {book.price > 0 ? `Unlock ₹${book.price}` : "Add to study set"}
              </button>
            </div>
          ) : null}
        </div>
      ) : focused ? (
        <div className="mb-6">
          <Link href="/app/study" className="text-sm font-semibold text-[var(--accent)]">
            ← All subjects
          </Link>
          <p className="page-kicker mt-4">{focused.addon ? "Add-on" : "Subject"}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{focused.name}</h1>
          {focused.blurb ? <p className="mt-2 text-[var(--ink-soft)]">{focused.blurb}</p> : null}
        </div>
      ) : (
        <section className="hero-progress p-8">
          <p className="page-kicker">Overall preparation</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-extrabold">{data?.completion.pct ?? 0}%</span>
            <span className="text-sm text-white/70">Syllabus covered</span>
          </div>
          <div className="progress-track mt-6 h-2">
            <div className="progress-fill" style={{ width: `${data?.completion.pct ?? 0}%` }} />
          </div>
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="flex -space-x-2">
              {(data?.subjects ?? []).slice(0, 4).map((s) => (
                <span
                  key={s.id}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0c1b3d] bg-white text-[10px] font-bold text-[var(--accent)]"
                >
                  {initials(s.name)}
                </span>
              ))}
            </div>
            {rec ? (
              <p className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                Next: {rec.title}
              </p>
            ) : null}
          </div>
        </section>
      )}

      {book ? (
        <section className="space-y-3">
          {book.chapters.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No chapters in this book yet.</p>
          ) : (
            book.chapters.map((ch) => (
              <div key={ch.id} className="card p-5">
                <p className="font-bold">{ch.title}</p>
                <p className="mt-1 text-xs text-[var(--ink-soft)]">
                  {ch.mcqCount} MCQs · {ch.flashCount} cards
                </p>
                {book.cta === "study" ? (
                  <div className="mt-4 flex gap-2">
                    <Link href={`/app/mcq?chapterId=${ch.id}`} className="btn-primary flex-1 text-sm">
                      Practice MCQ
                    </Link>
                    <Link href={`/app/flashcards?chapterId=${ch.id}`} className="btn-secondary flex-1 text-sm">
                      Flashcards
                    </Link>
                  </div>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-[var(--muted)]">Locked until you add this book</p>
                )}
              </div>
            ))
          )}
        </section>
      ) : focused ? (
        <section className="space-y-3">
          {focused.chapters.map((ch) => (
            <div key={ch.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{ch.title}</p>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">
                    {ch.mcqCount} MCQs · {ch.flashCount} cards
                  </p>
                </div>
                <span className="text-xs font-bold text-[var(--accent)]">{ch.completionPct}% done</span>
              </div>
              <div className="progress-track-thin mt-3">
                <div className="progress-fill-accent" style={{ width: `${ch.completionPct}%` }} />
              </div>
              <p className={`mt-2 text-xs font-semibold ${ch.reliable ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>
                Mastery {ch.masteryPct == null ? "—" : `${ch.masteryPct}%`}
                {!ch.reliable ? " · needs 5 attempts" : ""}
              </p>
              <div className="mt-4 flex gap-2">
                <Link href={`/app/mcq?chapterId=${ch.id}`} className="btn-primary flex-1 text-sm">
                  Practice MCQ
                </Link>
                <Link href={`/app/flashcards?chapterId=${ch.id}`} className="btn-secondary flex-1 text-sm">
                  Flashcards
                </Link>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <>
          {rec ? (
            <section className="hero-progress relative mt-8 p-6 sm:p-7">
              <p className="page-kicker">Recommended</p>
              <h3 className="relative mt-3 font-headline text-xl font-extrabold tracking-tight sm:text-2xl">
                {rec.title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-white/75">
                {rec.reason} · {rec.subjectName}
              </p>
              <div className="relative mt-5 flex gap-2">
                <Link
                  href={`/app/mcq?chapterId=${rec.chapterId}`}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[var(--accent)] shadow-xl"
                >
                  MCQ
                </Link>
                <Link
                  href={`/app/flashcards?chapterId=${rec.chapterId}`}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold text-white"
                >
                  Flashcards
                </Link>
              </div>
            </section>
          ) : null}

          <section className="mt-10">
            <p className="page-kicker mb-4">Core subjects</p>
            <div className="grid gap-5 md:grid-cols-2">
              {(data?.subjects ?? []).length === 0 ? (
                <div className="card p-6 md:col-span-2">
                  <p className="font-bold">No subjects in your study set yet</p>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">
                    Finish curriculum setup, or search for a book to add.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/app/curriculum" className="btn-primary text-sm">
                      Build curriculum
                    </Link>
                    <Link href="/app/search" className="btn-secondary text-sm">
                      Search books
                    </Link>
                  </div>
                </div>
              ) : null}
              {(data?.subjects ?? []).map((s) => (
                <div key={s.id} className="card p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)]">
                      {initials(s.name)}
                    </span>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                        s.completionPct >= 50
                          ? "bg-[#4edea3]/25 text-[#027a48]"
                          : "bg-[var(--accent-soft)] text-[var(--accent)]"
                      }`}
                    >
                      {s.completionPct}% Done
                    </span>
                  </div>
                  <p className="page-kicker">{s.addon ? "Add-on" : "Subject"}</p>
                  <h3 className="mt-1 text-lg font-bold">{s.name}</h3>
                  <p className="mt-1 mb-6 min-h-[2.5rem] text-sm leading-relaxed text-[var(--ink-soft)]">
                    {s.blurb ?? (s.addon ? "Paid add-on from another program." : "Practice this subject from your curriculum.")}
                  </p>
                  <div className="progress-track-thin mb-4">
                    <div className="progress-fill-accent" style={{ width: `${s.completionPct}%` }} />
                  </div>
                  {s.cta === "practice" ? (
                    <Link href={`/app/mcq?subjectId=${s.id}`} className="btn-primary w-full text-sm">
                      Start Practice
                    </Link>
                  ) : (
                    <Link href={`/app/study?subjectId=${s.id}`} className="btn-secondary w-full text-sm">
                      Review
                    </Link>
                  )}
                  <Link
                    href={`/app/study?subjectId=${s.id}`}
                    className="mt-3 block text-center text-sm font-semibold text-[var(--accent)]"
                  >
                    View chapters
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {payOpen && bookId ? (
        <UnlockBookSheet
          bookId={bookId}
          onClose={() => setPayOpen(false)}
          onUnlocked={() => {
            setPayOpen(false);
            const token = localStorage.getItem(tokenKey);
            if (!token) return;
            api<Tracker>("/api/v1/me/tracker", { token }).then(setData).catch((e) => setError(e.message));
            api<CatalogBook>(`/api/v1/catalog/books/${bookId}`, { token }).then(setBook).catch((e) => setError(e.message));
          }}
        />
      ) : null}
    </AppShell>
  );
}
