"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { AuthStoryPanel } from "@/components/auth-story";
import { api } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      });
      router.replace("/auth");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <AuthStoryPanel
        rotating={false}
        overline="Password"
        title="Choose a new password."
        body="This link works once and expires in an hour. After you save, sign in again."
      />

      <section className="flex items-center justify-center px-6 py-16">
        <div className="animate-fade-rise w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size={40} />
            <p className="font-headline text-xl font-extrabold text-[var(--accent)]">Rising Rankers</p>
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Password reset
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Set a new password</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Support cannot see your password. Use at least 8 characters.
          </p>

          {!token ? (
            <p className="card mt-6 p-6 text-sm text-[var(--ink-soft)]">
              This page needs a reset link from support.{" "}
              <Link href="/auth" className="text-[var(--accent)] underline-offset-2 hover:underline">
                Back to sign in
              </Link>
            </p>
          ) : (
            <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
              <div>
                <label className="label" htmlFor="password">
                  New password
                </label>
                <input
                  id="password"
                  className="field"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="confirm">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  className="field"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error ? <p className="msg-err">{error}</p> : null}
              <button disabled={busy} className="btn-primary w-full">
                {busy ? "Please wait…" : "Save password"}
              </button>
              <Link href="/auth" className="block text-center text-sm text-[var(--accent)] underline-offset-2 hover:underline">
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-[var(--muted)]">Loading…</p>}>
      <ResetForm />
    </Suspense>
  );
}
