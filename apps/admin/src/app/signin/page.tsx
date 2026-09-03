"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/admin-shell";
import { api, adminTokenKey } from "@/lib/api";

export default function AdminSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@learning.local");
  const [password, setPassword] = useState("Admin123!");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "mfa" | "enroll">("password");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function finish(token: string, role: string) {
    if (role === "STUDENT") {
      setError("Student accounts cannot access admin CMS");
      return;
    }
    localStorage.setItem(adminTokenKey, token);
    router.push("/dashboard");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === "password") {
        const data = await api<{
          token?: string;
          user: { role: string };
          mfaRequired?: boolean;
          mfaToken?: string;
          mfaEnrollRequired?: boolean;
          enrollToken?: string;
        }>("/api/v1/auth/signin", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        if (data.mfaRequired && data.mfaToken) {
          setChallenge(data.mfaToken);
          setStep("mfa");
          return;
        }
        if (data.mfaEnrollRequired && data.enrollToken) {
          setChallenge(data.enrollToken);
          setSetup(await api("/api/v1/auth/mfa/setup", { method: "POST", token: data.enrollToken }));
          setStep("enroll");
          return;
        }
        if (data.token) finish(data.token, data.user.role);
        return;
      }
      if (step === "mfa" && challenge) {
        const data = await api<{ token: string; user: { role: string } }>("/api/v1/auth/mfa/verify", {
          method: "POST",
          token: challenge,
          body: JSON.stringify({ code }),
        });
        finish(data.token, data.user.role);
        return;
      }
      if (step === "enroll" && challenge) {
        const data = await api<{ token: string; user: { role: string } }>("/api/v1/auth/mfa/enable", {
          method: "POST",
          token: challenge,
          body: JSON.stringify({ code }),
        });
        finish(data.token, data.user.role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[var(--deep)] px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -top-24 -right-16 h-80 w-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(30,79,196,0.55), transparent 70%)" }}
        />
        <div>
          <div className="flex items-center gap-3">
            <BrandMark size={48} />
            <p className="text-2xl font-semibold tracking-tight">Rising Rankers</p>
          </div>
          <h1 className="mt-16 max-w-sm text-4xl font-semibold tracking-tight">
            Operate the scholarship platform with clarity.
          </h1>
          <p className="mt-4 max-w-sm text-white/70">
            Content, live tests, awards, withdrawals, and trust — one calm workspace.
          </p>
        </div>
        <p className="text-sm text-white/45">Admin console · Day-1</p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="animate-fade-rise w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size={40} />
            <p className="text-xl font-semibold text-[var(--accent)]">Rising Rankers</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Admin sign in
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            {step === "password"
              ? "Seed: admin@learning.local / Admin123!"
              : step === "mfa"
                ? "Enter the 6-digit authenticator code."
                : "MFA is required. Add this secret, then enter a code."}
          </p>

          <form onSubmit={onSubmit} className="panel mt-8 space-y-4">
            {step === "password" ? (
              <>
                <div>
                  <label className="admin-label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    className="admin-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="username"
                    required
                  />
                </div>
                <div>
                  <label className="admin-label" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    className="admin-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </>
            ) : (
              <>
                {setup ? (
                  <>
                    <p className="break-all rounded-xl bg-[var(--accent-soft)] p-3 font-mono text-xs">{setup.secret}</p>
                    <p className="break-all text-xs text-[var(--muted)]">{setup.otpauthUrl}</p>
                  </>
                ) : null}
                <div>
                  <label className="admin-label" htmlFor="code">
                    Authenticator code
                  </label>
                  <input
                    id="code"
                    className="admin-input"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="one-time-code"
                    required
                  />
                </div>
              </>
            )}
            {error ? <p className="msg-err">{error}</p> : null}
            <button disabled={busy} className="btn-primary w-full">
              {busy ? "Please wait…" : step === "password" ? "Sign in" : "Continue"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
