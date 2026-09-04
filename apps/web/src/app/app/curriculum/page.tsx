"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthStoryPanel } from "@/components/auth-story";
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
      <main className="flex min-h-screen items-center justify-center bg-[var(--deep)]">
        <BrandMark size={48} />
      </main>
    );
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <AuthStoryPanel
        rotating={false}
        sceneIndex={0}
        overline="Your path"
        title="Let's set the stage for your success."
        body="Help us personalize your learning path by sharing a few details. This takes less than a minute."
      />

      <section className="flex flex-col bg-[var(--bg)]">
        <div className="bg-[var(--deep)] px-6 pb-10 pt-4 text-white lg:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--gold)] hover:bg-white/10"
              aria-label={rebuild ? "Back" : "Back to sign in"}
            >
              ←
            </button>
            <Link href="/" className="flex items-center gap-2.5">
              <BrandMark size={32} />
              <span className="font-headline text-lg font-extrabold tracking-tight">Rising Rankers</span>
            </Link>
          </div>
          <p className="page-kicker mt-8">Your path</p>
          <h1 className="mt-2 font-headline text-3xl font-extrabold tracking-tight">
            Let&apos;s set the stage for your success.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
            Help us personalize your learning path by sharing a few details. This takes less than a minute.
          </p>
        </div>

        <div className="flex flex-1 items-start justify-center px-6 py-10 sm:items-center lg:py-16">
          <div className="animate-fade-rise w-full max-w-md">
            <div className="mb-8 hidden items-center gap-3 lg:flex">
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
                <span className="font-headline text-lg font-extrabold tracking-tight text-[var(--accent)]">
                  Rising Rankers
                </span>
              </Link>
            </div>

            <p className="page-kicker hidden lg:block">Your path</p>
            <h2 className="mt-2 hidden font-headline text-3xl font-extrabold tracking-tight lg:block">
              Build your curriculum
            </h2>
            <p className="mt-2 hidden text-sm text-[var(--ink-soft)] lg:block">
              Name, program, and target year. We use this to pick your daily plan.
            </p>

            <form onSubmit={onSubmit} className="card mt-6 space-y-6 p-6 shadow-[var(--shadow-lift)]">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="firstName">
                    First name
                  </label>
                  <input
                    id="firstName"
                    className="field"
                    placeholder="Arjun"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="lastName">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    className="field"
                    placeholder="Sharma"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <p className="page-kicker mb-3">Target program</p>
                {programs.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No programs yet. Ask an admin to add one in Syllabus.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
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
                <p className="page-kicker mb-3">Target year</p>
                <div className="grid grid-cols-2 gap-3">
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

              <p className="rounded-2xl bg-[var(--accent-soft)] p-4 text-sm leading-relaxed text-[var(--ink-soft)]">
                This helps us tailor your <strong className="text-[var(--accent)]">Daily Study Plan</strong> and
                curated current affairs to your timeline.
              </p>

              {error ? <p className="msg-err">{error}</p> : null}

              <button className="btn-primary w-full" disabled={busy || !programId}>
                {busy ? "Building…" : "Build My Curriculum"}
              </button>
            </form>

            <p className="mt-5 text-center text-xs leading-relaxed text-[var(--muted)]">
              By continuing, you agree to our{" "}
              <Link href="/legal" className="font-semibold text-[var(--accent)]">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function CurriculumRoute() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--deep)]">
          <BrandMark size={48} />
        </main>
      }
    >
      <CurriculumPage />
    </Suspense>
  );
}
