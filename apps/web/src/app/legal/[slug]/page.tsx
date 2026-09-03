import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalShell } from "@/components/legal-shell";
import { LEGAL_BY_SLUG, LEGAL_PAGES } from "@/lib/legal";

export function generateStaticParams() {
  return LEGAL_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = LEGAL_BY_SLUG[slug];
  return { title: page ? `${page.title} · Rising Rankers` : "Legal · Rising Rankers" };
}

export default async function LegalSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = LEGAL_BY_SLUG[slug];
  if (!page) notFound();

  return (
    <LegalShell title={page.title}>
      {page.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {slug === "contact" ? (
        <p>
          <Link href="/app/support" className="font-semibold text-[var(--accent)]">
            Open Help &amp; support
          </Link>
        </p>
      ) : null}
    </LegalShell>
  );
}
