"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { AuthStoryPanel } from "@/components/auth-story";
import { api, tokenKey } from "@/lib/api";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ token: string }>(
        mode === "signin" ? "/api/v1/auth/signin" : "/api/v1/auth/signup",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            ...(mode === "signup" && fullName ? { fullName } : {}),
          }),
        }
      );
      localStorage.setItem(tokenKey, data.token);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <AuthStoryPanel />

      <section className="flex items-center justify-center bg-[var(--bg)] px-6 py-16">
        <div className="animate-fade-rise w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size={40} />
            <p className="font-headline text-xl font-extrabold text-[var(--accent)]">Rising Rankers</p>
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Student {mode === "signin" ? "sign in" : "sign up"}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            {mode === "signin"
              ? "Your cards, tests, and awards are waiting."
              : "Create an account, then we’ll set up your curriculum."}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-2xl bg-[var(--accent-soft)] p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-xl py-2 text-sm font-semibold transition-colors ${
                  mode === m ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--ink-soft)]"
                }`}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6 shadow-[var(--shadow-lift)]">
            {mode === "signup" ? (
              <div>
                <label className="label" htmlFor="fullName">
                  Full name
                </label>
                <input
                  id="fullName"
                  className="field"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            ) : null}
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="field"
                placeholder="you@email.com"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  className="field pr-12"
                  placeholder="At least 8 characters"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--muted)]"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {error ? <p className="msg-err">{error}</p> : null}
            <button disabled={busy} className="btn-primary w-full">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs leading-relaxed text-[var(--muted)]">
            By continuing you agree to Rising Rankers’{" "}
            <Link href="/legal/terms" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
              terms
            </Link>
            ,{" "}
            <Link href="/legal/privacy" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
              privacy
            </Link>
            , and{" "}
            <Link href="/legal/fair-play" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
              fair play
            </Link>{" "}
            rules.
          </p>
        </div>
      </section>
    </main>
  );
}
