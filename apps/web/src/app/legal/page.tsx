import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { LEGAL_INDEX } from "@/lib/legal";

export default function LegalIndexPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="animate-fade-rise mx-auto max-w-2xl px-5 pb-16">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Policies &amp; help</h1>
        <p className="mt-3 text-[var(--ink-soft)]">
          Terms, privacy, contest and wallet rules, FAQ, and how to reach support.
        </p>
        <ul className="card mt-8 divide-y divide-[var(--line)]">
          {LEGAL_INDEX.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block px-5 py-4 hover:bg-[var(--accent-soft)]">
                <span className="font-semibold">{item.title}</span>
                <span className="mt-1 block text-sm text-[var(--ink-soft)]">{item.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
