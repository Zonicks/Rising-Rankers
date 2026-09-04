import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PageHeader } from "@/components/page-header";
import { LEGAL_INDEX } from "@/lib/legal";

export default function LegalIndexPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="animate-fade-rise mx-auto max-w-2xl px-5 pb-16">
        <PageHeader
          overline="Legal"
          title="Policies & help"
          subtitle="Terms, privacy, contest and wallet rules, FAQ, and how to reach support."
        />
        <ul className="card divide-y divide-[var(--line)] rounded-3xl">
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
