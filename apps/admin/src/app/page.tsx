import Link from "next/link";
import { BrandMark } from "@/components/admin-shell";

export default function AdminHomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <div className="animate-fade-rise">
        <BrandMark size={56} />
        <p className="mt-6 text-4xl font-semibold tracking-tight text-[var(--accent)]">Rising Rankers</p>
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
          Admin console
        </p>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight md:text-4xl">
          Operate with clarity
        </h1>
        <p className="mt-3 max-w-md text-[var(--ink-soft)]">
          Content, live tests, awards, withdrawals, and trust signals — one calm workspace for
          staff.
        </p>
        <Link href="/signin" className="btn-primary mt-10 inline-flex">
          Admin sign in
        </Link>
      </div>
    </main>
  );
}
