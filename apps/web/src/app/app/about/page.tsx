"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BrandMark } from "@/components/brand";
import { ABOUT_PARAGRAPHS, APP_NAME, APP_PLATFORM, APP_VERSION } from "@/lib/about";

export default function AboutPage() {
  return (
    <AppShell overline="Rising Rankers" title="About" subtitle={`${APP_NAME} · Version ${APP_VERSION}`}>
      <div className="card rounded-3xl p-6">
        <div className="flex items-center gap-4">
          <BrandMark size={56} />
          <div>
            <h2 className="font-headline text-xl font-extrabold tracking-tight">{APP_NAME}</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Practice. Compete. Rise.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <span className="chip">Version {APP_VERSION}</span>
          <span className="chip">{APP_PLATFORM}</span>
        </div>
        <div className="mt-5 space-y-3 text-sm leading-relaxed text-[var(--ink-soft)]">
          {ABOUT_PARAGRAPHS.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/app/support" className="text-[var(--accent)]">
          Help &amp; support
        </Link>
        <Link href="/legal/about" className="text-[var(--accent)]">
          Full about &amp; policies
        </Link>
      </div>
    </AppShell>
  );
}
