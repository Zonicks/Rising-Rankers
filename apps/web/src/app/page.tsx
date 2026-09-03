import Link from "next/link";
import { PublicHeader } from "@/components/public-header";

const features = [
  {
    title: "Flash Cards",
    body: "Flip cards to lock in concepts. Daily free quota, unlock more when you need it.",
  },
  {
    title: "MCQ Practice",
    body: "Timed-style questions with explanations so you know why an answer is right.",
  },
  {
    title: "Live Tests",
    body: "Join scheduled contests, compete fairly, and see rank after declaration.",
  },
  {
    title: "Wallet",
    body: "Deposits, awards, and promo balances stay separate — withdrawals from awards only.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-6">
        <section className="animate-fade-rise grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Competitive learning
            </p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight md:text-5xl">
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
          <div className="hero-wallet p-7">
            <p className="text-sm text-white/65">Award balance</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight">₹0.00</p>
            <p className="mt-1 text-sm text-white/55">Shown after you sign in</p>
            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/15 pt-5">
              <div>
                <p className="text-xs text-white/50">Deposited</p>
                <p className="mt-1 text-lg font-semibold">₹0.00</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Promo</p>
                <p className="mt-1 text-lg font-semibold">₹0.00</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <article key={f.title} className="card p-6">
              <h2 className="text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{f.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
