"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api, mediaUrl, newsBookmarkKey, tokenKey } from "@/lib/api";
import { emitRewards, type RewardsDelta } from "@/lib/rewards";

type Article = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  imageUrl: string | null;
  tag: string | null;
  featured: boolean;
  publishedAt: string | null;
  timeAgo: string;
  read: boolean;
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

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const marked = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const markRead = useCallback(async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token || !id || marked.current) return;
    marked.current = true;
    try {
      const data = await api<{ read: boolean; rewards?: RewardsDelta }>(`/api/v1/articles/${id}/read`, {
        method: "POST",
        token,
      });
      setArticle((cur) => (cur ? { ...cur, read: true } : cur));
      emitRewards(data.rewards);
    } catch {
      marked.current = false;
    }
  }, [id]);

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      router.replace("/auth");
      return;
    }
    api<Article>(`/api/v1/articles/${id}`, { token })
      .then((data) => {
        setArticle(data);
        setBookmarked(loadBookmarks().includes(data.id));
        if (data.read) marked.current = true;
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Article not found"));
  }, [id, router]);

  useEffect(() => {
    if (!article || article.read) return;
    const t = window.setTimeout(() => {
      void markRead();
    }, 20_000);
    return () => window.clearTimeout(t);
  }, [article, markRead]);

  useEffect(() => {
    if (!article || article.read) return;
    const node = endRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void markRead();
      },
      { threshold: 0.6 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [article, markRead]);

  function toggleBookmark() {
    if (!article) return;
    const next = loadBookmarks();
    const i = next.indexOf(article.id);
    if (i >= 0) next.splice(i, 1);
    else next.push(article.id);
    localStorage.setItem(newsBookmarkKey, JSON.stringify(next));
    setBookmarked(i < 0);
  }

  const src = mediaUrl(article?.imageUrl);
  const tag = article?.tag
    ? article.tag.startsWith("#")
      ? article.tag
      : `#${article.tag.replace(/\s+/g, "")}`
    : null;
  const paragraphs = (article?.body ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <AppShell>
      <Link href="/app/news" className="text-sm text-[var(--ink-soft)] hover:text-[var(--accent)]">
        ← Daily Digest
      </Link>
      {error ? <p className="msg-err mt-6">{error}</p> : null}
      {article ? (
        <article className="mt-6">
          <div className="mb-4 flex items-center gap-3">
            {tag ? (
              <span className="rounded-md bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                {tag}
              </span>
            ) : null}
            <time className="text-xs font-medium text-[var(--ink-soft)]">{article.timeAgo}</time>
            <button type="button" className="ml-auto text-lg" onClick={toggleBookmark} aria-label="Bookmark">
              {bookmarked ? "★" : "☆"}
            </button>
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">{article.title}</h1>
          {src ? (
            <div className="mt-6 overflow-hidden rounded-[1.5rem] bg-[#eceef0]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="max-h-80 w-full object-cover" />
            </div>
          ) : null}
          <div className="mt-8 space-y-4 text-[0.95rem] leading-relaxed text-[var(--ink-soft)]">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div ref={endRef} className="h-8" />
          {article.read ? (
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-[var(--accent)]">Marked as read · +2 pts</p>
          ) : (
            <p className="mt-4 text-xs text-[var(--muted)]">Stay 20 seconds or scroll to the end to count this towards your streak.</p>
          )}
        </article>
      ) : !error ? (
        <p className="mt-8 text-sm text-[var(--ink-soft)]">Loading brief…</p>
      ) : null}
    </AppShell>
  );
}
