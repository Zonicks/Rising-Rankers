"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { IconBook, IconClose, IconPerson, IconQuiz, IconSearch, IconStudy } from "@/components/icons";
import { SearchSkeleton, SkeletonList, SkeletonRegion } from "@/components/skeleton";
import { UnlockBookSheet } from "@/components/unlock-book-sheet";
import { api, tokenKey } from "@/lib/api";

type Cta = "study" | "add" | "unlock" | "books";
type Kind = "book" | "author" | "subject" | "chapter";
type Filter = "all" | Kind;

type Hit = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string | null;
  program?: string | null;
  subjectId?: string;
  bookId?: string;
  inProgram?: boolean | null;
  price?: number | null;
  granted?: boolean;
  cta: Cta;
};

type SearchData = {
  q: string;
  books: Hit[];
  authors: Hit[];
  subjects: Hit[];
  chapters: Hit[];
};

const SEARCH_HINTS = [
  { q: "Laxmikanth", label: "Indian Polity", blurb: "UPSC · in your syllabus" },
  { q: "Spectrum", label: "Modern India", blurb: "National movement" },
  { q: "HC Verma", label: "NEET Physics", blurb: "Paid add-on · ₹49" },
  { q: "NEET", label: "NEET catalog", blurb: "Books outside UPSC" },
];

function priceLabel(hit: Hit) {
  if (hit.cta === "unlock") return hit.price ? `₹${hit.price}` : "Add-on";
  if (hit.cta === "study" && (hit.price === 0 || hit.granted)) return "FREE";
  if (hit.price == null) return null;
  if (hit.price === 0) return "FREE";
  return `₹${hit.price}`;
}

function ctaHref(hit: Hit) {
  if (hit.cta === "study") {
    if (hit.kind === "chapter") return `/app/mcq?chapterId=${hit.id}`;
    if (hit.kind === "subject") return `/app/study?subjectId=${hit.id}`;
    if (hit.kind === "book") return `/app/study?bookId=${hit.id}`;
  }
  if (hit.cta === "books") return `/app/search?authorId=${hit.id}`;
  return null;
}

function ctaLabel(hit: Hit) {
  if (hit.cta === "study") return "Study";
  if (hit.cta === "add") return "Add";
  if (hit.cta === "books") return "See books";
  return hit.price ? `Unlock ₹${hit.price}` : "Unlock";
}

function unlockBookId(hit: Hit) {
  if (hit.kind === "book") return hit.id;
  if (hit.kind === "chapter" && hit.bookId) return hit.bookId;
  return null;
}

function kindMeta(kind: string) {
  if (kind === "author") {
    return { label: "Author", Icon: IconPerson, tile: "bg-[#fbf6dc] text-[#8a6a00]" };
  }
  if (kind === "subject") {
    return { label: "Subject", Icon: IconStudy, tile: "bg-[var(--success-soft)] text-[var(--success)]" };
  }
  if (kind === "chapter") {
    return { label: "Chapter", Icon: IconQuiz, tile: "bg-[var(--bg-low)] text-[var(--ink-soft)]" };
  }
  return { label: "Book", Icon: IconBook, tile: "bg-[var(--accent-soft)] text-[var(--accent)]" };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ResultCard({
  hit,
  onAuthor,
  onPay,
  onSubjectUnlock,
}: {
  hit: Hit;
  onAuthor?: (id: string) => void;
  onPay?: (bookId: string) => void;
  onSubjectUnlock?: (title: string) => void;
}) {
  const href = ctaHref(hit);
  const label = ctaLabel(hit);
  const price = priceLabel(hit);
  const payId = unlockBookId(hit);
  const needsPay = hit.cta === "add" || hit.cta === "unlock";
  const meta = kindMeta(hit.kind);
  const Icon = meta.Icon;
  const free = price === "FREE";
  const paid = Boolean(price && price !== "FREE" && price !== "Add-on");

  let action: ReactNode;
  if (hit.cta === "books") {
    action = (
      <button type="button" className="btn-secondary text-sm" onClick={() => onAuthor?.(hit.id)}>
        {label}
      </button>
    );
  } else if (needsPay && hit.kind === "subject") {
    action = (
      <button type="button" className="btn-primary text-sm" onClick={() => onSubjectUnlock?.(hit.title)}>
        See books
      </button>
    );
  } else if (needsPay && payId) {
    action = (
      <button type="button" className="btn-primary text-sm" onClick={() => onPay?.(payId)}>
        {label}
      </button>
    );
  } else if (href) {
    action = (
      <Link href={href} className="btn-primary text-sm">
        {label}
      </Link>
    );
  } else {
    action = <span className="btn-secondary cursor-default text-sm opacity-70">{label}</span>;
  }

  return (
    <article className="lift-face group flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.tile}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{meta.label}</span>
            {hit.inProgram ? <span className="chip">In syllabus</span> : null}
            {hit.program && hit.inProgram === false ? (
              <span className="rounded-full bg-[#fbf6dc] px-2.5 py-0.5 text-xs font-bold text-[#8a6a00]">
                {hit.program} add-on
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 text-lg font-extrabold tracking-tight">{hit.title}</h3>
          {hit.subtitle ? (
            <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{hit.subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
        {price ? (
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide ${
              free
                ? "bg-[#FBF6DC] text-[var(--deep)]"
                : paid
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "bg-[var(--bg-low)] text-[var(--ink-soft)]"
            }`}
          >
            {price}
          </span>
        ) : null}
        {action}
      </div>
    </article>
  );
}

function HintGrid({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SEARCH_HINTS.map((h, i) => (
        <button
          type="button"
          key={h.q}
          onClick={() => onPick(h.q)}
          className={`rounded-full px-3.5 py-2 text-sm font-bold ${
            i % 2 === 0
              ? "bg-[#FBF6DC] text-[var(--deep)]"
              : "bg-[var(--deep)] text-[var(--gold)]"
          }`}
        >
          {h.q}
        </button>
      ))}
    </div>
  );
}

function EmptyPanel({
  title,
  body,
  onPick,
}: {
  title: string;
  body: string;
  onPick: (q: string) => void;
}) {
  return (
    <div className="card px-6 py-10 text-center sm:px-10">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
        <IconSearch className="h-6 w-6" />
      </span>
      <h2 className="mt-5 text-xl font-extrabold tracking-tight">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--ink-soft)]">{body}</p>
      <div className="mt-6">
        <HintGrid onPick={onPick} />
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <SearchSkeleton />
        </AppShell>
      }
    >
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const authorId = params.get("authorId");
  const [draft, setDraft] = useState(initialQ);
  const [q, setQ] = useState(initialQ);
  const [data, setData] = useState<SearchData | null>(null);
  const [authorBooks, setAuthorBooks] = useState<{
    author: { id?: string; name: string; bio?: string | null };
    books: Hit[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [payBookId, setPayBookId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const t = window.setTimeout(() => setQ(draft.trim()), 300);
    return () => window.clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      router.replace("/auth");
      return;
    }
    setError(null);
    if (authorId) {
      setLoading(true);
      api<{ author: { id?: string; name: string; bio?: string | null }; books: Hit[] }>(
        `/api/v1/catalog/authors/${authorId}/books`,
        { token }
      )
        .then(setAuthorBooks)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
      return;
    }
    setAuthorBooks(null);
    if (q.length < 2) {
      setData({ q, books: [], authors: [], subjects: [], chapters: [] });
      setLoading(false);
      return;
    }
    const next = new URLSearchParams({ q });
    router.replace(`/app/search?${next.toString()}`);
    setLoading(true);
    setFilter("all");
    api<SearchData>(`/api/v1/search?q=${encodeURIComponent(q)}`, { token })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, authorId, router, retry]);

  const counts = useMemo(
    () => ({
      book: data?.books.length ?? 0,
      author: data?.authors.length ?? 0,
      subject: data?.subjects.length ?? 0,
      chapter: data?.chapters.length ?? 0,
    }),
    [data]
  );
  const total = counts.book + counts.author + counts.subject + counts.chapter;
  const kindsWithHits = (["book", "author", "subject", "chapter"] as Kind[]).filter((k) => counts[k] > 0);
  const empty = Boolean(data) && q.length >= 2 && total === 0 && !loading;

  function pickHint(value: string) {
    setDraft(value);
    setQ(value);
    router.push(`/app/search?q=${encodeURIComponent(value)}`);
  }

  function openAuthor(id: string) {
    router.push(`/app/search?authorId=${id}`);
  }

  function cardProps() {
    return {
      onAuthor: openAuthor,
      onPay: setPayBookId,
      onSubjectUnlock: (title: string) => {
        setDraft(title);
        setQ(title);
      },
    };
  }

  function section(kind: Kind, title: string, items: Hit[]) {
    if (filter !== "all" && filter !== kind) return null;
    if (!items.length) return null;
    return (
      <section className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{title}</h2>
          <span className="text-xs font-semibold text-[var(--muted)]">{items.length}</span>
        </div>
        {items.map((hit) => (
          <ResultCard key={`${kind}-${hit.id}`} hit={hit} {...cardProps()} />
        ))}
      </section>
    );
  }

  return (
    <AppShell>
      <section className="hero-progress relative p-7 sm:p-8">
        <p className="page-kicker">Catalog</p>
        <h1 className="relative z-10 mt-2 text-3xl font-extrabold tracking-tight">What do you want to learn?</h1>
        <p className="relative z-10 mt-2 max-w-md text-sm leading-relaxed text-white/75">
          Search a book, author, or topic. Add-ons outside your program show a price first.
        </p>
        <label className="sr-only" htmlFor="catalog-search">
          Search catalog
        </label>
        <div className="relative z-10 mt-6">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            id="catalog-search"
            className="w-full rounded-2xl border-0 bg-white py-4 pl-12 pr-12 text-base text-[var(--ink)] outline-none shadow-[var(--shadow-card)] placeholder:text-[var(--muted)] focus:shadow-[0_0_0_4px_rgba(240,194,26,0.35)]"
            placeholder="Try Laxmikanth, Spectrum, or HC Verma"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          {draft ? (
            <button
              type="button"
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--bg-low)] hover:text-[var(--ink)]"
              aria-label="Clear search"
              onClick={() => {
                setDraft("");
                setQ("");
                router.push("/app/search");
              }}
            >
              <IconClose className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </section>

      <div className="mt-8">
        {error ? (
          <div className="card mb-6 p-5">
            <p className="msg-err">{error}</p>
            <button type="button" className="btn-secondary mt-3 text-sm" onClick={() => setRetry((n) => n + 1)}>
              Try again
            </button>
          </div>
        ) : null}

        {authorBooks ? (
          <section>
            <Link href="/app/search" className="text-sm font-semibold text-[var(--accent)]">
              ← All results
            </Link>
            <div className="mt-5 flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fbf6dc] text-lg font-extrabold text-[#8a6a00]">
                {initials(authorBooks.author.name)}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Author</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{authorBooks.author.name}</h2>
                {authorBooks.author.bio ? (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{authorBooks.author.bio}</p>
                ) : null}
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {loading ? (
                <SkeletonRegion>
                  <SkeletonList />
                </SkeletonRegion>
              ) : authorBooks.books.length === 0 ? (
                <EmptyPanel
                  title="No books for this author yet"
                  body="Try another name from the catalog."
                  onPick={pickHint}
                />
              ) : (
                authorBooks.books.map((hit) => <ResultCard key={hit.id} hit={hit} {...cardProps()} />)
              )}
            </div>
          </section>
        ) : q.length < 2 ? (
          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
              Popular searches
            </h2>
            <HintGrid onPick={pickHint} />
          </div>
        ) : loading ? (
          <SkeletonRegion>
            <SkeletonList />
          </SkeletonRegion>
        ) : empty ? (
          <EmptyPanel
            title="No matches"
            body="Try an author, book, or topic — or pick one of the demo searches below."
            onPick={pickHint}
          />
        ) : (
          <div className="space-y-8">
            {kindsWithHits.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "All", total],
                    ["book", "Books", counts.book],
                    ["author", "Authors", counts.author],
                    ["subject", "Subjects", counts.subject],
                    ["chapter", "Chapters", counts.chapter],
                  ] as Array<[Filter, string, number]>
                )
                  .filter(([id, , n]) => id === "all" || n > 0)
                  .map(([id, label, n]) => (
                    <button
                      key={id}
                      type="button"
                      className={`choice-chip min-h-10 px-4 py-2 text-sm ${filter === id ? "is-on" : ""}`}
                      onClick={() => setFilter(id)}
                    >
                      {label} · {n}
                    </button>
                  ))}
              </div>
            ) : null}
            {section("book", "Books", data?.books ?? [])}
            {section("author", "Authors", data?.authors ?? [])}
            {section("subject", "Subjects", data?.subjects ?? [])}
            {section("chapter", "Chapters", data?.chapters ?? [])}
          </div>
        )}
      </div>

      {payBookId ? (
        <UnlockBookSheet
          bookId={payBookId}
          onClose={() => setPayBookId(null)}
          onUnlocked={(id) => router.push(`/app/study?bookId=${id}`)}
        />
      ) : null}
    </AppShell>
  );
}
