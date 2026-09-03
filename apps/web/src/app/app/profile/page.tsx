"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api, tokenKey } from "@/lib/api";

type Me = {
  user: { id: string; fullName: string | null; email: string };
  profile: {
    mobile: string | null;
    classOrExam: string | null;
    city: string | null;
    state: string | null;
    parentGuardian: string | null;
    dateOfBirth: string | null;
    consentAccepted: boolean;
    consentAt: string | null;
    profileComplete: boolean;
  } | null;
  curriculum: { programName: string; targetYear: number | null } | null;
};

function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatDob(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

function yearsOld(iso: string | null | undefined) {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const month = now.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-3 last:border-0">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [classOrExam, setClassOrExam] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [parentGuardian, setParentGuardian] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentAt, setConsentAt] = useState<string | null>(null);
  const [programName, setProgramName] = useState("");
  const [targetYear, setTargetYear] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
      router.replace("/auth");
      return;
    }
    api<Me>("/api/v1/me", { token })
      .then((data) => {
        setEmail(data.user.email);
        setFullName(data.user.fullName ?? "");
        setMobile(data.profile?.mobile ?? "");
        setClassOrExam(data.profile?.classOrExam ?? "");
        setCity(data.profile?.city ?? "");
        setState(data.profile?.state ?? "");
        setParentGuardian(data.profile?.parentGuardian ?? "");
        setDateOfBirth(toDateInput(data.profile?.dateOfBirth));
        setConsent(Boolean(data.profile?.consentAccepted));
        setConsentAt(data.profile?.consentAt ?? null);
        setProgramName(data.curriculum?.programName ?? "");
        setTargetYear(data.curriculum?.targetYear ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const saved = await api<Me>("/api/v1/me/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          fullName: fullName.trim() || undefined,
          mobile: mobile.trim() || null,
          classOrExam: classOrExam.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          parentGuardian: parentGuardian.trim() || null,
          dateOfBirth: dateOfBirth || null,
          ...(consent ? { consentAccepted: true } : {}),
        }),
      });
      setConsent(Boolean(saved.profile?.consentAccepted));
      setConsentAt(saved.profile?.consentAt ?? null);
      setDateOfBirth(toDateInput(saved.profile?.dateOfBirth));
      setMsg("Profile saved");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function resetPasswordForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwError(null);
    setChangingPassword(false);
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match");
      setPwMsg(null);
      return;
    }
    setPwBusy(true);
    setPwError(null);
    setPwMsg(null);
    try {
      await api("/api/v1/me/password", {
        method: "PATCH",
        token,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwMsg("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangingPassword(false);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setPwBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="My profile">
        <p className="text-sm text-[var(--muted)]">Loading profile…</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="My profile" subtitle="Scholarship details stay on this account.">
      {error ? <p className="msg-err mb-4">{error}</p> : null}
      {msg ? <p className="msg-ok mb-4">{msg}</p> : null}

      {!editing ? (
        <div className="card p-6">
          <Row label="Email" value={email} />
          <Row label="Full name" value={fullName} />
          <Row label="Mobile" value={mobile} />
          <Row label="Class / exam" value={classOrExam} />
          <Row label="City" value={city} />
          <Row label="State" value={state} />
          <Row label="Program" value={programName} />
          <Row label="Target year" value={targetYear ? String(targetYear) : "Later"} />
          <Row label="Date of birth" value={formatDob(dateOfBirth) || "—"} />
          <Row label="Parent / guardian" value={parentGuardian} />
          <Row
            label="Consent"
            value={
              consent
                ? consentAt
                  ? `Accepted · ${new Date(consentAt).toLocaleDateString("en-IN")}`
                  : "Accepted"
                : "Not yet"
            }
          />
          <button className="btn-primary mt-6 w-full" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        </div>
      ) : (
        <form onSubmit={onSave} className="card space-y-4 p-6">
          <div>
            <label className="label">Email</label>
            <input className="field bg-[var(--bg)] text-[var(--ink-soft)]" value={email} disabled readOnly />
          </div>
          <div>
            <label className="label">Full name</label>
            <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="label">Mobile</label>
            <input
              className="field"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="10-digit mobile"
            />
          </div>
          <div>
            <label className="label">Class / exam</label>
            <input
              className="field"
              value={classOrExam}
              onChange={(e) => setClassOrExam(e.target.value)}
              placeholder="e.g. Class 12 · JEE"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">City</label>
              <input className="field" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="field" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input
              className="field"
              type="date"
              value={dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
            {yearsOld(dateOfBirth) != null && yearsOld(dateOfBirth)! < 18 ? (
              <p className="mt-2 text-xs text-[var(--ink-soft)]">
                Under 18 — add a parent or guardian name so admin can see consent is supported.
              </p>
            ) : null}
          </div>
          <div>
            <label className="label">Parent / guardian</label>
            <input className="field" value={parentGuardian} onChange={(e) => setParentGuardian(e.target.value)} />
          </div>
          <label className="flex items-start gap-3 text-sm text-[var(--ink-soft)]">
            <input
              type="checkbox"
              className="mt-1 accent-[var(--accent)]"
              checked={consent}
              disabled={consent && Boolean(consentAt)}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I accept the terms and consent to process my profile data
              {consent && consentAt
                ? ` (accepted ${new Date(consentAt).toLocaleDateString("en-IN")})`
                : ""}
              . To withdraw later, use Help &amp; support.
            </span>
          </label>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button disabled={busy} className="btn-primary flex-1">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      {pwMsg ? <p className="msg-ok mt-6">{pwMsg}</p> : null}
      {pwError ? <p className="msg-err mt-6">{pwError}</p> : null}

      {!changingPassword ? (
        <button
          type="button"
          className="btn-secondary mt-6 w-full"
          onClick={() => {
            setChangingPassword(true);
            setPwError(null);
            setPwMsg(null);
          }}
        >
          Change password
        </button>
      ) : (
        <form onSubmit={onChangePassword} className="card mt-6 space-y-4 p-6">
          <h2 className="font-semibold">Change password</h2>
          <div>
            <label className="label" htmlFor="currentPassword">
              Current password
            </label>
            <input
              id="currentPassword"
              className="field"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="newPassword">
              New password
            </label>
            <input
              id="newPassword"
              className="field"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              className="field"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={resetPasswordForm}>
              Cancel
            </button>
            <button disabled={pwBusy} className="btn-primary flex-1">
              {pwBusy ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      )}

      {!city.trim() ? (
        <p className="mt-6 rounded-[1.25rem] bg-[#f2f4f6] p-4 text-sm text-[var(--ink-soft)]">
          Add your city so you can appear on the leaderboard (initials only).
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/app/leaderboard" className="text-[var(--accent)]">
          Leaderboard
        </Link>
        <Link href="/app/wallet" className="text-[var(--accent)]">
          Wallet
        </Link>
        <Link href="/app/tests" className="text-[var(--accent)]">
          Live tests
        </Link>
        <Link href="/app/curriculum?rebuild=1" className="text-[var(--accent)]">
          Rebuild curriculum
        </Link>
        <Link href="/app/about" className="text-[var(--accent)]">
          About Rising Rankers
        </Link>
        <Link href="/app/support" className="text-[var(--accent)]">
          Help &amp; support
        </Link>
        <Link href="/legal" className="text-[var(--accent)]">
          Legal, FAQ &amp; policies
        </Link>
      </div>
    </AppShell>
  );
}
