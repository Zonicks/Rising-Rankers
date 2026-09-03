"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { api, tokenKey } from "@/lib/api";

type Program = { id: string; name: string; slug: string; examBoard: string | null };
type Me = {
  user: { firstName?: string | null; lastName?: string | null; fullName: string | null };
  profile: { curriculumComplete?: boolean } | null;
  curriculum: { programId: string; targetYear: number | null } | null;
};

function yearOptions() {
  const y = new Date().getFullYear();
  return [y, y + 1, y + 2];
}

function splitName(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

function CurriculumPage() {
  const router = useRouter();
  const search = useSearchParams();
  const rebuild = search.get("rebuild") === "1";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState<string>("");
  const [targetYear, setTargetYear] = useState<number | null>(new Date().getFullYear() + 1);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(() => yearOptions(), []);

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      router.replace("/auth");
      return;
    }
    Promise.all([
      api<Me>("/api/v1/me", { token }),
      api<Program[]>("/api/v1/programs", { token }),
    ])
      .then(([me, list]) => {
        const done = Boolean(me.profile?.curriculumComplete);
        setComplete(done);
        if (done && !rebuild) {
          router.replace("/app");
          return;
        }
        const split = splitName(me.user.fullName);
        setFirstName(me.user.firstName || split.first);
        setLastName(me.user.lastName || split.last);
        setPrograms(list);
        setProgramId(me.curriculum?.programId || list[0]?.id || "");
        setTargetYear(me.curriculum?.targetYear ?? new Date().getFullYear() + 1);
        setLoading(false);
      })
      .catch(() => router.replace("/auth"));
  }, [rebuild, router]);

  function onBack() {
    if (rebuild && complete) {
      router.push("/app/profile");
      return;
    }
    localStorage.removeItem(tokenKey);
    router.replace("/auth");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(tokenKey);
    if (!token || !programId) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/me/curriculum", {
        method: "POST",
        token,
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          programId,
          targetYear,
        }),
      });
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build curriculum");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <BrandMark size={48} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 pb-16 pt-2">
      <header className="sticky top-0 z-10 -mx-6 flex items-center gap-3 bg-[var(--bg)]/80 px-6 py-4 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--accent)] hover:bg-[var(--accent-soft)]"
          aria-label={rebuild ? "Back" : "Back to sign in"}
        >
          ←
        </button>
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={32} />
          <span className="font-headline text-lg font-extrabold tracking-tight text-[var(--accent)]">Rising Rankers</span>
        </Link>
      </header>

      <section className="animate-fade-rise mt-8 text-center">
        <div
          className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full text-white shadow-[var(--shadow-lift)]"
          style={{ background: "var(--accent)" }}
        >
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="currentColor">
            <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-8 1.67-8 5v1h16v-1c0-3.33-4.7-5-8-5Z" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--accent)] md:text-4xl">
          Let&apos;s set the stage for your success.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[var(--ink-soft)]">
          Help us personalize your learning path by sharing a few details. This takes less than a minute.
        </p>
      </section>

      <form onSubmit={onSubmit} className="mt-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#F1F3FB] p-8 md:p-12">
          <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-[var(--accent)]/5 blur-3xl" />
          <div className="relative space-y-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label uppercase tracking-[0.15em] text-[var(--accent)]" htmlFor="firstName">
                  First name
                </label>
                <input
                  id="firstName"
                  className="field h-14 rounded-2xl"
                  placeholder="Arjun"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="label uppercase tracking-[0.15em] text-[var(--accent)]" htmlFor="lastName">
                  Last name
                </label>
                <input
                  id="lastName"
                  className="field h-14 rounded-2xl"
                  placeholder="Sharma"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <p className="label uppercase tracking-[0.15em] text-[var(--accent)]">Target program</p>
              {programs.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No programs yet. Ask an admin to add one in Syllabus.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {programs.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`choice-chip ${programId === p.id ? "is-on" : ""}`}
                      onClick={() => setProgramId(p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="label uppercase tracking-[0.15em] text-[var(--accent)]">Target year</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`choice-chip ${targetYear === y ? "is-on" : ""}`}
                    onClick={() => setTargetYear(y)}
                  >
                    {y}
                  </button>
                ))}
                <button
                  type="button"
                  className={`choice-chip ${targetYear === null ? "is-on" : ""}`}
                  onClick={() => setTargetYear(null)}
                >
                  Later
                </button>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl border border-[var(--accent)]/10 bg-[var(--accent-soft)]/70 p-5">
              <span className="mt-0.5 text-[var(--accent)]" aria-hidden>
                ✦
              </span>
              <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
                This helps us tailor your <strong className="text-[var(--accent)]">Daily Study Plan</strong> and
                curated current affairs to your timeline.
              </p>
            </div>
          </div>
        </div>

        {error ? <p className="msg-err mt-6">{error}</p> : null}

        <button
          className="btn-primary mt-8 h-auto w-full rounded-3xl py-5 text-lg font-extrabold"
          disabled={busy || !programId}
        >
          {busy ? "Building…" : "Build My Curriculum"}
        </button>
        <p className="mt-4 text-center text-xs tracking-wide text-[var(--muted)]">
          By continuing, you agree to our{" "}
          <Link href="/legal" className="font-semibold text-[var(--accent)]">
            Terms of Service
          </Link>
        </p>
      </form>

      <div className="mt-16 h-40 overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--deep)] via-[#0c1b3d] to-[var(--accent)] opacity-80">
        <div className="flex h-full items-end justify-between p-6">
          <BrandMark size={56} />
          <p className="text-sm font-semibold text-white/70">Rise. Rank. Earn.</p>
        </div>
      </div>
    </main>
  );
}

export default function CurriculumRoute() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <BrandMark size={48} />
        </main>
      }
    >
      <CurriculumPage />
    </Suspense>
  );
}
