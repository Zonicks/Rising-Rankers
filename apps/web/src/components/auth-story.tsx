"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";

export const AUTH_STORIES = [
  {
    overline: "Practice",
    title: "Practice that actually sticks",
    body: "Flip cards and drill MCQs from real chapters. A little every day is enough.",
  },
  {
    overline: "Compete",
    title: "Sit the live tests",
    body: "Timed contests. One device. Fair rank. Strong scores can earn Award credit.",
  },
  {
    overline: "Earn",
    title: "Awards you can withdraw",
    body: "Winnings land in your Award wallet. Practice is free. Compete when you are ready.",
  },
] as const;

export function AuthStoryPanel({
  rotating = true,
  overline,
  title,
  body,
  sceneIndex,
}: {
  rotating?: boolean;
  overline?: string;
  title?: string;
  body?: string;
  sceneIndex?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!rotating || paused) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % AUTH_STORIES.length), 4500);
    return () => window.clearInterval(t);
  }, [rotating, paused]);

  const story = AUTH_STORIES[index];
  const heading = title ?? story.title;
  const copy = body ?? story.body;
  const kicker = overline ?? story.overline;

  return (
    <section
      className="relative hidden overflow-hidden bg-[var(--deep)] px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="pointer-events-none absolute -top-24 -right-16 h-80 w-80 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(30,79,196,0.55), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-10 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(240,194,26,0.16), transparent 70%)" }}
      />

      <div className="relative">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark size={48} />
          <p className="font-headline text-2xl font-extrabold tracking-tight">Rising Rankers</p>
        </Link>
      </div>

      <div className="relative my-10 flex justify-center">
        <ProductScene index={sceneIndex ?? (rotating ? index : 2)} />
      </div>

      <div className="relative max-w-sm">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--gold)]">{kicker}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{heading}</h1>
        <p className="mt-4 text-white/70">{copy}</p>
        {rotating ? (
          <div className="mt-6 flex gap-2">
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
        ) : null}
      </div>

      <p className="relative text-sm font-semibold tracking-tight text-[var(--gold)]">Rise. Rank. Earn.</p>
    </section>
  );
}

export function ProductScene({ index }: { index: number }) {
  if (index === 1) return <LiveScene />;
  if (index === 2) return <AwardScene />;
  return <DeckScene />;
}

function DeckScene() {
  return (
    <div className="relative h-[16.5rem] w-[14.5rem]">
      <div className="absolute inset-0 translate-x-4 translate-y-5 rotate-6 rounded-[2rem] bg-black/30" />
      <div className="absolute inset-0 translate-x-2 translate-y-2.5 rotate-3 rounded-[2rem] bg-[#0C1B3D]/80" />
      <div className="relative flex h-full -rotate-2 flex-col rounded-[2rem] bg-white p-5 shadow-[0_14px_28px_rgba(30,79,196,0.28)]">
        <span className="w-fit rounded-full bg-[#FBF6DC] px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-[#0C1B3D]">
          PROMPT
        </span>
        <div className="mt-8 space-y-2">
          <div className="h-2 rounded-full bg-[#E7EEFB]" />
          <div className="h-2 w-4/5 rounded-full bg-[#E7EEFB]" />
          <div className="h-2 w-1/2 rounded-full bg-[#E7EEFB]" />
        </div>
        <p className="mt-auto text-center text-[11px] font-extrabold tracking-[0.18em] text-[var(--gold)]">
          ‹&nbsp;&nbsp;swipe&nbsp;&nbsp;›
        </p>
      </div>
    </div>
  );
}

function LiveScene() {
  return (
    <div className="flex h-[16.5rem] w-[15.5rem] flex-col rounded-[3rem] border border-white/15 bg-white/10 px-5 py-4">
      <span className="w-fit rounded-full bg-[var(--gold)] px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-[var(--deep)]">
        LIVE
      </span>
      <div className="mx-auto mt-3 grid h-[6.6rem] w-[6.6rem] place-items-center rounded-full border-[8px] border-[var(--gold)] border-r-white/15 border-b-white/15">
        <span className="font-headline text-xl font-extrabold tracking-tight">08:42</span>
      </div>
      <p className="mt-3 text-center font-headline text-3xl font-extrabold text-[var(--gold)]">#12</p>
      <div className="mt-2 space-y-1.5">
        <div className="h-1.5 w-[82%] rounded-full bg-white/20" />
        <div className="h-1.5 w-[64%] rounded-full bg-white/20" />
        <div className="h-1.5 w-[48%] rounded-full bg-white/20" />
      </div>
    </div>
  );
}

function AwardScene() {
  return (
    <div className="hero-wallet w-[15.5rem] p-6">
      <p className="text-sm text-white/65">Award balance</p>
      <p className="mt-2 font-headline text-5xl font-extrabold tracking-tight text-[var(--gold)]">₹</p>
      <p className="mt-2 text-sm text-white/55">Withdraw when you win</p>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
        <div>
          <p className="text-xs text-white/50">Deposited</p>
          <p className="mt-1 text-sm font-semibold">Practice</p>
        </div>
        <div>
          <p className="text-xs text-white/50">Promo</p>
          <p className="mt-1 text-sm font-semibold">Boosts</p>
        </div>
      </div>
    </div>
  );
}
