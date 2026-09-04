import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { LandingFeatures, LandingHeroScene } from "@/components/landing-showcase";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-6">
        <section className="animate-fade-rise grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="page-kicker">Competitive learning</p>
            <h1 className="mt-3 max-w-xl font-headline text-4xl font-extrabold tracking-tight md:text-5xl">
              Practice hard. Compete fairly. Rise in the ranks.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-[var(--ink-soft)]">
              Rising Rankers is the student home for flash cards, MCQs, live tests, and a wallet that
              keeps deposits, awards, and promo money distinct.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/auth" className="btn-primary">
                Sign in / Sign up
              </Link>
              <Link href="/legal" className="btn-secondary">
                Policies &amp; FAQ
              </Link>
            </div>
          </div>
          <LandingHeroScene />
        </section>
        <LandingFeatures />
        <p className="mt-16 text-center text-sm font-semibold tracking-tight text-[var(--gold)]">
          Rise. Rank. Earn.
        </p>
      </main>
    </div>
  );
}
