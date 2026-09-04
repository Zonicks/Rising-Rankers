"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { IconChevron } from "@/components/icons";
import { NewsSkeleton } from "@/components/skeleton";
import { api, mediaUrl, newsBookmarkKey, tokenKey } from "@/lib/api";

export type NewsCard = {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  tag: string | null;
  featured: boolean;
  publishedAt: string | null;
  timeAgo: string;
  read: boolean;
  bookmarked?: boolean;
};

type Range = "today" | "week" | "archive" | "saved";

type Feed = {
  range: Range;
  featured: NewsCard | null;
  articles: NewsCard[];
};

function loadBookmarks(): string[] {
  try {
    const raw = localStorage.getItem(newsBookmarkKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(ids: string[]) {
  localStorage.setItem(newsBookmarkKey, JSON.stringify(ids));
}

function tagLabel(tag?: string | null) {
  if (!tag) return null;
  return tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "")}`;
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function Meta({
  article,
  bookmarked,
  onToggle,
}: {
  article: NewsCard;
  bookmarked?: boolean;
  onToggle?: () => void;
}) {
  const tag = tagLabel(article.tag);
  return (
    <div className="mb-4 flex items-center gap-3">
      {tag ? (
        <span className="rounded-md bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
          {tag}
        </span>
      ) : null}
      {tag && article.timeAgo ? <span className="h-1 w-1 rounded-full bg-[var(--muted)]" /> : null}
      {article.timeAgo ? (
        <time className="text-xs font-medium text-[var(--ink-soft)]">{article.timeAgo}</time>
      ) : null}
      {article.read ? (
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Read</span>
      ) : null}
      {onToggle ? (
        <button
          type="button"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          onClick={onToggle}
          aria-label={bookmarked ? "Remove from Saved" : "Save article"}
        >
          <BookmarkIcon filled={Boolean(bookmarked)} />
        </button>
      ) : null}
    </div>
  );
}

export default function NewsPage() {
  const router = useRouter();
  const [range, setRange] = useState<Range>("today");
  const [feed, setFeed] = useState<Feed | null>(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ saved: boolean } | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("range");
    if (raw === "today" || raw === "week" || raw === "archive" || raw === "saved") {
      setRange(raw);
    }
  }, []);

  const migrate = useCallback(async (token: string) => {
    const local = loadBookmarks();
    if (local.length === 0) return;
    try {
      const data = await api<{ imported: string[] }>("/api/v1/articles/bookmarks/import", {
        method: "POST",
        token,
        body: JSON.stringify({ ids: local }),
      });
      const ok = new Set((data.imported ?? []).map(String));
      saveBookmarks(local.filter((id) => !ok.has(id)));
    } catch {
      // keep local
    }
  }, []);

  const load = useCallback(async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return router.replace("/auth");
    try {
      await migrate(token);
      const data = await api<Feed>(`/api/v1/articles?range=${range}`, { token });
      if (range === "saved" && data.range !== "saved") {
        const ids = loadBookmarks();
        const cards: NewsCard[] = [];
        const kept: string[] = [];
        for (const id of ids) {
          try {
            const card = await api<NewsCard>(`/api/v1/articles/${id}`, { token });
            cards.push(card);
            kept.push(id);
          } catch {
            /* prune */
          }
        }
        saveBookmarks(kept);
        setFeed({ range: "saved", featured: null, articles: cards });
        setBookmarks(kept);
      } else {
        setFeed(data);
        const marks = new Set(loadBookmarks());
        const collect = (row?: NewsCard | null) => {
          if (!row || typeof row.bookmarked !== "boolean") return;
          if (row.bookmarked) marks.add(row.id);
          else marks.delete(row.id);
        };
        collect(data.featured);
        data.articles.forEach(collect);
        const next = [...marks];
        saveBookmarks(next);
        setBookmarks(next);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load news");
    }
  }, [migrate, range, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleBookmark(id: string) {
    const token = localStorage.getItem(tokenKey);
    const saving = !bookmarks.includes(id);
    if (token) {
      try {
        await api(saving ? `/api/v1/articles/${id}/bookmark` : `/api/v1/articles/${id}/bookmark`, {
          method: saving ? "POST" : "DELETE",
          token,
        });
      } catch {
        /* local fallback */
      }
    }
    setBookmarks((cur) => {
      const next = saving ? [...cur, id] : cur.filter((x) => x !== id);
      saveBookmarks(next);
      return next;
    });
    if (!saving && range === "saved") {
      setFeed((cur) =>
        cur
          ? {
              ...cur,
              articles: cur.articles.filter((a) => a.id !== id),
              featured: cur.featured?.id === id ? null : cur.featured,
            }
          : cur
      );
    }
    setToast({ saved: saving });
  }

  const featured = range === "saved" ? null : feed?.featured;
  const articles = feed?.articles ?? [];

  return (
    <AppShell>
      <section className="mb-10">
        {range === "saved" ? (
          <>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Your shelf</span>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight text-[#050B18]">
              Saved
              <br />
              briefs.
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--ink-soft)]">
              {articles.length === 0 ? "Tap the bookmark on a brief to keep it here." : `${articles.length} kept for later.`}
            </p>
          </>
        ) : (
          <>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">The Daily Digest</span>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight text-[var(--accent)]">
              Curated
              <br />
              Insights.
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--ink-soft)]">
              Stay ahead of the curve with daily snippets structured for your program.
            </p>
          </>
        )}
      </section>

      <nav className="mb-8 flex rounded-2xl bg-[#f2f4f6] p-1.5">
        {(["today", "week", "archive", "saved"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            className={`flex-1 rounded-xl px-2 py-2.5 text-[11px] font-bold capitalize transition sm:px-4 sm:text-xs ${
              range === key
                ? key === "saved"
                  ? "bg-[#FBF6DC] text-[#050B18] shadow-sm"
                  : "bg-white text-[var(--accent)] shadow-sm"
                : "text-[var(--ink-soft)]"
            }`}
          >
            {key === "week" ? "Week" : key === "archive" ? "Archive" : key === "saved" ? "Saved" : "Today"}
          </button>
        ))}
      </nav>

      {toast ? (
        <p className="mb-6 text-sm font-semibold text-[var(--accent)]">
          {toast.saved ? "Saved · " : "Removed from Saved"}
          {toast.saved ? (
            <button type="button" className="underline" onClick={() => setRange("saved")}>
              view in Saved
            </button>
          ) : null}
        </p>
      ) : null}

      {error ? <p className="msg-err mb-6">{error}</p> : null}

      {!feed && !error ? <NewsSkeleton /> : null}

      <div className={range === "saved" ? "space-y-3.5" : "space-y-12"}>
        {featured ? (
          <article className="overflow-hidden rounded-[3rem] bg-gradient-to-br from-[#050B18] via-[#0C1B3D] to-[#1E4FC4] shadow-[0_14px_28px_rgba(30,79,196,0.16)]">
            {mediaUrl(featured.imageUrl) ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(featured.imageUrl)!} alt="" className="h-44 w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#050B18] to-transparent" />
                <span className="absolute left-4 top-4 rounded-full bg-[#F0C21A] px-2.5 py-1 text-[10px] font-extrabold tracking-[0.12em] text-[#050B18]">
                  LEAD BRIEF
                </span>
                <button
                  type="button"
                  className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ${
                    bookmarks.includes(featured.id) ? "text-[#F0C21A]" : "text-white"
                  }`}
                  onClick={() => void toggleBookmark(featured.id)}
                  aria-label={bookmarks.includes(featured.id) ? "Remove from Saved" : "Save article"}
                >
                  <BookmarkIcon filled={bookmarks.includes(featured.id)} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-6 pt-5">
                <span className="rounded-full bg-[#F0C21A] px-2.5 py-1 text-[10px] font-extrabold tracking-[0.12em] text-[#050B18]">
                  LEAD BRIEF
                </span>
                <button
                  type="button"
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ${
                    bookmarks.includes(featured.id) ? "text-[#F0C21A]" : "text-white"
                  }`}
                  onClick={() => void toggleBookmark(featured.id)}
                  aria-label={bookmarks.includes(featured.id) ? "Remove from Saved" : "Save article"}
                >
                  <BookmarkIcon filled={bookmarks.includes(featured.id)} />
                </button>
              </div>
            )}
            <div className="px-6 pb-6 pt-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {tagLabel(featured.tag) ? (
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    {tagLabel(featured.tag)}
                  </span>
                ) : null}
                {featured.timeAgo ? (
                  <time className="text-xs font-medium text-white/60">{featured.timeAgo}</time>
                ) : null}
              </div>
              <Link href={`/app/news/${featured.id}`} className="no-underline">
                <h2 className="text-2xl font-extrabold leading-tight text-white">{featured.title}</h2>
              </Link>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/70">{featured.excerpt}</p>
              <Link
                href={`/app/news/${featured.id}`}
                className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-[#F0C21A] text-xs font-extrabold uppercase tracking-[0.12em] text-[#050B18] no-underline"
              >
                Deep dive
              </Link>
            </div>
          </article>
        ) : null}

        {range === "saved"
          ? articles.map((article) => {
              const src = mediaUrl(article.imageUrl);
              const tag = tagLabel(article.tag);
              return (
                <article
                  key={article.id}
                  className="flex gap-4 rounded-3xl bg-white p-3.5 shadow-[0_10px_24px_rgba(25,28,30,0.05)]"
                >
                  <Link
                    href={`/app/news/${article.id}`}
                    className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-[#E7EEFB]"
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[var(--accent)]">
                        <BookmarkIcon filled />
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {tag ? (
                        <span className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                          {tag}
                        </span>
                      ) : null}
                      {article.timeAgo ? (
                        <time className="text-xs font-medium text-[var(--ink-soft)]">{article.timeAgo}</time>
                      ) : null}
                      {article.read ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Read</span>
                      ) : null}
                    </div>
                    <Link href={`/app/news/${article.id}`} className="no-underline">
                      <h2 className="line-clamp-2 text-[15px] font-bold leading-snug text-[var(--ink)]">{article.title}</h2>
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ink-soft)]">{article.excerpt}</p>
                  </div>
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FBF6DC] text-[#050B18]"
                    onClick={() => void toggleBookmark(article.id)}
                    aria-label="Remove from Saved"
                  >
                    <BookmarkIcon filled />
                  </button>
                </article>
              );
            })
          : articles.map((article) => {
          const src = mediaUrl(article.imageUrl);
          return (
            <article key={article.id} className="group">
              <Meta
                article={article}
                bookmarked={bookmarks.includes(article.id)}
                onToggle={() => void toggleBookmark(article.id)}
              />
              <div className="flex flex-col gap-6 sm:flex-row">
                <div className="flex-1">
                  <Link href={`/app/news/${article.id}`} className="no-underline">
                    <h2 className="text-xl font-bold leading-snug text-[var(--ink)] group-hover:text-[var(--accent)]">
                      {article.title}
                    </h2>
                  </Link>
                  <p className="mt-3 mb-4 text-sm leading-relaxed text-[var(--ink-soft)]">{article.excerpt}</p>
                  <Link
                    href={`/app/news/${article.id}`}
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--accent)]"
                  >
                    Read full analysis
                    <IconChevron className="h-4 w-4" />
                  </Link>
                </div>
                {src ? (
                  <Link href={`/app/news/${article.id}`} className="h-32 w-full shrink-0 overflow-hidden rounded-2xl bg-[#eceef0] sm:w-32">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}

        {feed && !featured && articles.length === 0 ? (
          range === "saved" ? (
            <div className="flex flex-col items-center py-16 text-center">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#FBF6DC] text-[#050B18]">
                <BookmarkIcon filled={false} />
              </span>
              <p className="mt-5 text-lg font-bold text-[var(--ink)]">Nothing saved yet</p>
              <p className="mt-2 max-w-xs text-sm text-[var(--ink-soft)]">
                Tap the bookmark on a brief to keep it on this shelf.
              </p>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--ink-soft)]">
              {range === "today"
                ? "No briefs published today. Check This Week."
                : range === "week"
                  ? "Nothing in the last seven days."
                  : "The archive is empty for your program."}
            </p>
          )
        ) : null}
      </div>
    </AppShell>
  );
}
