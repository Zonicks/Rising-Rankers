"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { IconChevron } from "@/components/icons";
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
};

type Feed = {
  range: "today" | "week" | "archive";
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

function Meta({ article }: { article: NewsCard }) {
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
    </div>
  );
}

export default function NewsPage() {
  const router = useRouter();
  const [range, setRange] = useState<"today" | "week" | "archive">("today");
  const [feed, setFeed] = useState<Feed | null>(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return router.replace("/auth");
    try {
      const data = await api<Feed>(`/api/v1/articles?range=${range}`, { token });
      setFeed(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load news");
    }
  }, [range, router]);

  useEffect(() => {
    setBookmarks(loadBookmarks());
    void load();
  }, [load]);

  function toggleBookmark(id: string) {
    setBookmarks((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      saveBookmarks(next);
      return next;
    });
  }

  const featured = feed?.featured;
  const articles = feed?.articles ?? [];

  return (
    <AppShell>
      <section className="mb-10">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">The Daily Digest</span>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight text-[var(--accent)]">
          Curated
          <br />
          Insights.
        </h1>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--ink-soft)]">
          Stay ahead of the curve with daily snippets structured for your program.
        </p>
      </section>

      <nav className="mb-12 flex rounded-2xl bg-[#f2f4f6] p-1.5">
        {(["today", "week", "archive"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-bold capitalize transition ${
              range === key ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--ink-soft)]"
            }`}
          >
            {key === "week" ? "This Week" : key === "archive" ? "Archived" : "Today"}
          </button>
        ))}
      </nav>

      {error ? <p className="msg-err mb-6">{error}</p> : null}

      <div className="space-y-12">
        {featured ? (
          <article className="rounded-[2rem] bg-[#f2f4f6] p-8">
            <Meta article={featured} />
            <h2 className="text-2xl font-extrabold leading-tight">{featured.title}</h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--ink-soft)]">{featured.excerpt}</p>
            <div className="mt-6 flex items-center justify-between">
              <Link href={`/app/news/${featured.id}`} className="btn-primary text-xs uppercase tracking-widest">
                Deep dive
              </Link>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-white"
                onClick={() => toggleBookmark(featured.id)}
                aria-label="Bookmark"
              >
                {bookmarks.includes(featured.id) ? "★" : "☆"}
              </button>
            </div>
          </article>
        ) : null}

        {articles.map((article) => {
          const src = mediaUrl(article.imageUrl);
          return (
            <article key={article.id} className="group">
              <Meta article={article} />
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

        {!featured && articles.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--ink-soft)]">
            {range === "today"
              ? "No briefs published today. Check This Week."
              : range === "week"
                ? "Nothing in the last seven days."
                : "The archive is empty for your program."}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
