import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { LEGAL_UPDATED } from "@/lib/legal";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="animate-fade-rise mx-auto max-w-2xl px-5 pb-16">
        <Link href="/legal" className="text-sm text-[var(--ink-soft)] hover:text-[var(--accent)]">
          ← All policies
        </Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="card mt-6 space-y-4 p-6 leading-relaxed text-[var(--ink-soft)]">{children}</div>
        <p className="mt-8 text-xs text-[var(--muted)]">
          Last updated {LEGAL_UPDATED}. Have a lawyer review this pack before a public paid launch.
        </p>
      </main>
    </div>
  );
}
