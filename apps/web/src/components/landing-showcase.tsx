"use client";

import { useEffect, useState } from "react";
import { AUTH_STORIES, ProductScene } from "@/components/auth-story";

const FEATURES = [
  {
    scene: 0,
    title: "Flash cards",
    body: "Flip cards to lock in concepts. Daily free quota, unlock more when you need it.",
  },
  {
    scene: 1,
    title: "Live tests",
    body: "Join scheduled contests, compete fairly, and see rank after declaration.",
  },
  {
    scene: 2,
    title: "Awards you can withdraw",
    body: "Scholarship winnings land in Award. Practice is free. Compete when you are ready.",
  },
  {
    scene: 2,
    title: "Three wallet buckets",
    body: "Deposits, awards, and promo stay separate — withdrawals from awards only.",
  },
] as const;

export function LandingHeroScene() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % AUTH_STORIES.length), 4500);
    return () => window.clearInterval(t);
  }, [paused]);

  const story = AUTH_STORIES[index];

  return (
    <div
      className="relative flex min-h-[22rem] flex-col items-center justify-center overflow-hidden rounded-[var(--radius-hero)] bg-[var(--deep)] px-6 py-10 text-white shadow-[var(--shadow-lift)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(30,79,196,0.55), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-8 h-44 w-44 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(240,194,26,0.16), transparent 70%)" }}
      />
      <div className="relative">
        <ProductScene index={index} />
      </div>
      <p className="relative mt-6 text-center text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--gold)]">
        {story.overline}
      </p>
      <div className="relative mt-4 flex gap-2">
        {AUTH_STORIES.map((s, i) => (
          <button
            key={s.overline}
            type="button"
            aria-label={s.overline}
            onClick={() => setIndex(i)}
            className={`h-[7px] rounded-full transition-all ${
              i === index ? "w-[18px] bg-[var(--gold)]" : "w-[6px] bg-white/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function LandingFeatures() {
  return (
    <section className="mt-16 grid gap-4 sm:grid-cols-2">
      {FEATURES.map((f) => (
        <article key={f.title} className="card overflow-hidden p-0">
          <div className="flex h-40 items-center justify-center overflow-hidden bg-[var(--deep)]">
            <div className="origin-center scale-[0.55]">
              <ProductScene index={f.scene} />
            </div>
          </div>
          <div className="p-6">
            <h2 className="font-headline text-lg font-extrabold tracking-tight">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{f.body}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
