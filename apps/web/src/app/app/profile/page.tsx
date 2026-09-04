"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  IconBook,
  IconChevron,
  IconClose,
  IconGavel,
  IconHeadset,
  IconInfo,
  IconLock,
  IconPencil,
  IconTrophy,
  IconWallet,
} from "@/components/icons";
import { ProfileSkeleton } from "@/components/skeleton";
import { api, tokenKey } from "@/lib/api";
import { achievementGlyph, requestStreakSheet } from "@/lib/rewards";

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
  wallet: { deposited: string; award: string; promo: string } | null;
  pointsBalance?: number;
  streakCount?: number;
};

type Achievement = {
  id: string;
  name: string;
  iconKey: string;
  tier: "GOLD" | "SILVER" | "BRONZE";
};

type Achievements = {
  earned: Achievement[];
  locked: Achievement[];
};

type Sheet = "edit" | "edit-city" | "password" | "signout" | null;

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

function initialsOf(name: string) {
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "");
  return parts.join("") || "S";
}

function display(value: string) {
  return value.trim() ? value.trim() : "—";
}

function formatAward(raw: string | null | undefined) {
  if (raw == null || raw === "") return "—";
  return raw.startsWith("₹") ? raw : `₹${raw}`;
}

function formatPoints(n: number | null) {
  if (n == null) return "—";
  return `${n.toLocaleString("en-IN")} pts`;
}

function formatConsent(consent: boolean, consentAt: string | null) {
  if (!consent) return "Not yet";
  const when = formatDob(consentAt);
  return when ? `Accepted · ${when}` : "Accepted";
}

function tierClass(tier: string) {
  if (tier === "GOLD") return "badge-gold";
  if (tier === "SILVER") return "badge-silver";
  return "badge-bronze";
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
  const [streak, setStreak] = useState<number | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [award, setAward] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achievementTotal, setAchievementTotal] = useState(0);
  const [achsFailed, setAchsFailed] = useState(false);

  const [draftName, setDraftName] = useState("");
  const [draftMobile, setDraftMobile] = useState("");
  const [draftClass, setDraftClass] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftState, setDraftState] = useState("");
  const [draftParent, setDraftParent] = useState("");
  const [draftDob, setDraftDob] = useState("");
  const [draftConsent, setDraftConsent] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const cityRef = useRef<HTMLInputElement>(null);

  const applyMe = useCallback((data: Me) => {
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
    setStreak(typeof data.streakCount === "number" ? data.streakCount : 0);
    setPoints(typeof data.pointsBalance === "number" ? data.pointsBalance : 0);
    setAward(data.wallet?.award ?? null);
  }, []);

  const load = useCallback(
    async (silent = false) => {
      const token = localStorage.getItem(tokenKey);
      if (!token) {
        router.replace("/auth");
        return;
      }
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const mePromise = api<Me>("/api/v1/me", { token });
        const achPromise = api<Achievements>("/api/v1/me/achievements", { token }).catch(() => null);
        const data = await mePromise;
        const achs = await achPromise;
        applyMe(data);
        if (achs) {
          const source = achs.earned.length > 0 ? achs.earned : achs.locked;
          setAchievementTotal(source.length);
          setAchievements(source.slice(0, 4));
          setAchsFailed(false);
        } else {
          setAchsFailed(true);
          setAchievements([]);
          setAchievementTotal(0);
        }
        setReady(true);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load profile");
      } finally {
        setLoading(false);
      }
    },
    [applyMe, router],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 2800);
    return () => window.clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (sheet === "edit-city") cityRef.current?.focus();
  }, [sheet]);

  useEffect(() => {
    if (!sheet) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy && !pwBusy) setSheet(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, busy, pwBusy]);

  function openEdit(focusCity = false) {
    setDraftName(fullName);
    setDraftMobile(mobile);
    setDraftClass(classOrExam);
    setDraftCity(city);
    setDraftState(state);
    setDraftParent(parentGuardian);
    setDraftDob(dateOfBirth);
    setDraftConsent(consent);
    setSheetError(null);
    setSheet(focusCity ? "edit-city" : "edit");
  }

  function openPassword() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setSheetError(null);
    setSheet("password");
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    setBusy(true);
    setSheetError(null);
    try {
      await api<Me>("/api/v1/me/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          fullName: draftName.trim() || undefined,
          mobile: draftMobile.trim() || null,
          classOrExam: draftClass.trim() || null,
          city: draftCity.trim() || null,
          state: draftState.trim() || null,
          parentGuardian: draftParent.trim() || null,
          dateOfBirth: draftDob || null,
          ...(draftConsent ? { consentAccepted: true } : {}),
        }),
      });
      setSheet(null);
      setFlash("Profile saved");
      await load(true);
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    if (newPassword !== confirmPassword) {
      setSheetError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setSheetError("New password must be at least 8 characters");
      return;
    }
    setPwBusy(true);
    setSheetError(null);
    try {
      await api("/api/v1/me/password", {
        method: "PATCH",
        token,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setSheet(null);
      setFlash("Password updated");
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setPwBusy(false);
    }
  }

  function signOut() {
    localStorage.removeItem(tokenKey);
    router.replace("/auth");
  }

  const name = fullName.trim() || "Student";
  const goldRing = (streak ?? 0) >= 1 || (points ?? 0) > 0;
  const yearLabel = targetYear == null ? "Later" : String(targetYear);
  const editing = sheet === "edit" || sheet === "edit-city";
  const lockedConsent = consent && Boolean(consentAt);
  const visibleAchs = achievementTotal > 4 ? achievements.slice(0, 3) : achievements;

  return (
    <AppShell>
      {flash ? <p className="msg-ok mb-4">{flash}</p> : null}

      {!ready && loading ? (
        <ProfileSkeleton />
      ) : !ready && error ? (
        <div>
          <p className="msg-err">{error}</p>
          <button type="button" className="btn-secondary mt-4" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : (
        <>
          {error ? <p className="msg-err mb-4">{error}</p> : null}

          <section className="hero-progress relative p-6 sm:p-7">
            <div className="relative flex items-start gap-3.5">
              <div
                className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-white/10 text-xl font-extrabold text-white ${
                  goldRing ? "ring-[1.5px] ring-[var(--gold)]" : "ring-[1.5px] ring-white/25"
                }`}
              >
                {initialsOf(name)}
              </div>
              <div className="min-w-0 flex-1 pt-1.5">
                <h1 className="truncate font-headline text-2xl font-extrabold tracking-tight text-white sm:text-[1.75rem]">
                  {name}
                </h1>
                <p className="mt-1 truncate text-sm text-white/60">{email || "—"}</p>
              </div>
              <button
                type="button"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.14] text-white"
                aria-label="Edit profile"
                onClick={() => openEdit()}
              >
                <IconPencil className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-4 flex flex-wrap gap-2">
              {programName.trim() ? <HeroChip>{programName}</HeroChip> : null}
              <HeroChip>{yearLabel}</HeroChip>
              {city.trim() ? <HeroChip>{city.trim()}</HeroChip> : null}
            </div>

            <div className="relative mt-[18px] grid grid-cols-3 border-t border-white/15 pt-3.5">
              <HeroStat label="Streak" value={streak == null ? "—" : `🔥 ${streak}`} onClick={() => requestStreakSheet()} />
              <HeroStat
                label="Points"
                value={formatPoints(points)}
                onClick={() => router.push("/app/leaderboard")}
                divided
              />
              <HeroStat
                label="Award"
                value={formatAward(award)}
                onClick={() => router.push("/app/wallet")}
                divided
              />
            </div>
          </section>

          {!city.trim() ? (
            <div className="mt-4 rounded-3xl bg-[#FBF6DC] px-5 pb-2 pt-[18px]">
              <p className="font-headline text-base font-extrabold tracking-tight">Show up on the leaderboard</p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">
                Add your city. Ranks show initials and city only.
              </p>
              <button
                type="button"
                className="mt-1 py-2 text-sm font-bold text-[var(--accent)]"
                onClick={() => openEdit(true)}
              >
                Add city
              </button>
            </div>
          ) : null}

          {!achsFailed ? (
            <section className="mt-6">
              <p className="section-label">Achievements</p>
              {visibleAchs.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--ink-soft)]">Earn badges from streaks, cards, and tests.</p>
              ) : (
                <Link href="/app/leaderboard" className="mt-3 flex items-center gap-2.5 no-underline">
                  {visibleAchs.map((a) => (
                    <span
                      key={a.id}
                      className={`grid h-14 w-14 place-items-center rounded-full text-xl ${tierClass(a.tier)}`}
                      title={a.name}
                    >
                      {achievementGlyph(a.iconKey)}
                    </span>
                  ))}
                  {achievementTotal > 4 ? (
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--bg-low)] text-sm font-extrabold text-[var(--ink-soft)]">
                      +{achievementTotal - 3}
                    </span>
                  ) : null}
                </Link>
              )}
            </section>
          ) : null}

          <section className="mt-6">
            <p className="section-label">Shortcuts</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <ShortcutTile
                href="/app/leaderboard"
                title="Leaderboard"
                subtitle="Initials and city"
                well="bg-[#FBF6DC] text-[var(--deep)]"
                Icon={IconTrophy}
              />
              <ShortcutTile
                href="/app/wallet"
                title="Wallet"
                subtitle="Awards and deposits"
                well="bg-[var(--accent-soft)] text-[var(--accent)]"
                Icon={IconWallet}
              />
              <ShortcutTile
                href="/app/support"
                title="Help & support"
                subtitle="Tickets and account"
                well="bg-[var(--accent-soft)] text-[var(--accent)]"
                Icon={IconHeadset}
              />
              <ShortcutTile
                href="/app/about"
                title="About"
                subtitle="App and version"
                well="bg-[var(--bg-low)] text-[var(--ink-soft)]"
                Icon={IconInfo}
              />
            </div>
          </section>

          <section className="mt-7">
            <div className="flex items-center justify-between">
              <p className="section-label">About you</p>
              <button type="button" className="text-sm font-bold text-[var(--accent)]" onClick={() => openEdit()}>
                Edit
              </button>
            </div>
            <div className="card mt-3 space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <Fact label="Mobile" value={display(mobile)} />
                <Fact label="Class / exam" value={display(classOrExam)} />
                <Fact label="City" value={display(city)} />
                <Fact label="State" value={display(state)} />
                <Fact label="Date of birth" value={display(formatDob(dateOfBirth))} />
                <Fact label="Parent / guardian" value={display(parentGuardian)} />
              </div>
              {consent ? (
                <span className="inline-flex rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-bold text-[var(--success)]">
                  {formatConsent(consent, consentAt)}
                </span>
              ) : (
                <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={() => openEdit()}>
                  Not yet — add consent
                </button>
              )}
            </div>
          </section>

          <section className="mt-7">
            <p className="section-label">Account</p>
            <div className="card mt-3 overflow-hidden px-2 py-1">
              <AccountRow icon={IconLock} title="Change password" onClick={openPassword} />
              <AccountRow
                icon={IconBook}
                title="Rebuild curriculum"
                subtitle="Change program or target year. Your question bank stays."
                href="/app/curriculum?rebuild=1"
              />
              <AccountRow icon={IconGavel} title="Legal, FAQ & policies" href="/legal" last />
            </div>
          </section>

          <div className="mt-7 pb-4 text-center">
            <button
              type="button"
              className="px-4 py-2 font-headline text-base font-extrabold text-[var(--danger)]"
              onClick={() => setSheet("signout")}
            >
              Sign out
            </button>
          </div>
        </>
      )}

      {editing ? (
        <div className="sheet-scrim" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
          <form className="sheet-panel" onSubmit={onSave}>
            <div className="sheet-handle sm:hidden" />
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 id="edit-profile-title" className="font-headline text-xl font-extrabold tracking-tight">
                Edit profile
              </h2>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-full text-[var(--ink-soft)] disabled:opacity-40"
                aria-label="Close"
                disabled={busy}
                onClick={() => setSheet(null)}
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
              {sheetError ? <p className="msg-err">{sheetError}</p> : null}
              <div>
                <label className="label" htmlFor="pf-name">
                  Full name
                </label>
                <input id="pf-name" className="field" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="pf-mobile">
                  Mobile
                </label>
                <input
                  id="pf-mobile"
                  className="field"
                  value={draftMobile}
                  onChange={(e) => setDraftMobile(e.target.value)}
                  placeholder="10-digit mobile"
                  inputMode="tel"
                />
              </div>
              <div>
                <label className="label" htmlFor="pf-class">
                  Class / exam
                </label>
                <input
                  id="pf-class"
                  className="field"
                  value={draftClass}
                  onChange={(e) => setDraftClass(e.target.value)}
                  placeholder="e.g. Class 12 · JEE"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="pf-city">
                    City
                  </label>
                  <input
                    id="pf-city"
                    ref={cityRef}
                    className="field"
                    value={draftCity}
                    onChange={(e) => setDraftCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="pf-state">
                    State
                  </label>
                  <input id="pf-state" className="field" value={draftState} onChange={(e) => setDraftState(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="pf-dob">
                  Date of birth
                </label>
                <input
                  id="pf-dob"
                  className="field"
                  type="date"
                  value={draftDob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDraftDob(e.target.value)}
                />
                {yearsOld(draftDob) != null && yearsOld(draftDob)! < 18 ? (
                  <p className="mt-2 text-xs text-[var(--ink-soft)]">
                    Under 18 — add a parent or guardian name so admin can see consent is supported.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="label" htmlFor="pf-parent">
                  Parent / guardian
                </label>
                <input
                  id="pf-parent"
                  className="field"
                  value={draftParent}
                  onChange={(e) => setDraftParent(e.target.value)}
                />
              </div>
              <label className="flex items-start gap-3 text-sm text-[var(--ink-soft)]">
                <input
                  type="checkbox"
                  className="mt-1 accent-[var(--accent)]"
                  checked={draftConsent}
                  disabled={lockedConsent}
                  onChange={(e) => setDraftConsent(e.target.checked)}
                />
                <span>
                  I accept the terms and consent to process my profile data
                  {lockedConsent ? ` (accepted ${formatDob(consentAt)}). To withdraw later, use Help & support.` : ""}
                </span>
              </label>
            </div>
            <div className="space-y-2.5 border-t border-[var(--ghost)] px-5 py-4">
              <button disabled={busy} className="btn-primary w-full">
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="btn-secondary w-full" disabled={busy} onClick={() => setSheet(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {sheet === "password" ? (
        <div className="sheet-scrim" role="dialog" aria-modal="true" aria-labelledby="password-title">
          <form className="sheet-panel" onSubmit={onChangePassword}>
            <div className="sheet-handle sm:hidden" />
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 id="password-title" className="font-headline text-xl font-extrabold tracking-tight">
                Change password
              </h2>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-full text-[var(--ink-soft)] disabled:opacity-40"
                aria-label="Close"
                disabled={pwBusy}
                onClick={() => setSheet(null)}
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
              {sheetError ? <p className="msg-err">{sheetError}</p> : null}
              <PasswordField
                id="currentPassword"
                label="Current password"
                autoComplete="current-password"
                value={currentPassword}
                visible={showCurrent}
                onToggle={() => setShowCurrent((v) => !v)}
                onChange={setCurrentPassword}
              />
              <PasswordField
                id="newPassword"
                label="New password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                value={newPassword}
                visible={showNew}
                onToggle={() => setShowNew((v) => !v)}
                onChange={setNewPassword}
              />
              <PasswordField
                id="confirmPassword"
                label="Confirm new password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                visible={showConfirm}
                onToggle={() => setShowConfirm((v) => !v)}
                onChange={setConfirmPassword}
              />
            </div>
            <div className="space-y-2.5 border-t border-[var(--ghost)] px-5 py-4">
              <button disabled={pwBusy} className="btn-primary w-full">
                {pwBusy ? "Updating…" : "Update password"}
              </button>
              <button type="button" className="btn-secondary w-full" disabled={pwBusy} onClick={() => setSheet(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {sheet === "signout" ? (
        <div className="sheet-scrim" role="dialog" aria-modal="true" aria-labelledby="signout-title">
          <div className="card w-full max-w-md p-6">
            <h2 id="signout-title" className="font-headline text-xl font-extrabold tracking-tight">
              Sign out?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              You’ll need your email and password to get back in.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setSheet(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-2xl px-4 py-2 font-headline text-sm font-extrabold text-[var(--danger)]"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function HeroChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/[0.14] px-2.5 py-1 text-xs font-semibold text-white">{children}</span>
  );
}

function HeroStat({
  label,
  value,
  onClick,
  divided,
}: {
  label: string;
  value: string;
  onClick: () => void;
  divided?: boolean;
}) {
  return (
    <button
      type="button"
      className={`min-w-0 text-left ${divided ? "border-l border-white/15 pl-3" : "pr-3"}`}
      onClick={onClick}
    >
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-white/60">{label}</span>
      <span className="mt-1 block truncate font-headline text-lg font-extrabold text-white">{value}</span>
    </button>
  );
}

function ShortcutTile({
  href,
  title,
  subtitle,
  well,
  Icon,
}: {
  href: string;
  title: string;
  subtitle: string;
  well: string;
  Icon: (props: { className?: string }) => ReactNode;
}) {
  return (
    <Link href={href} className="focus-tile min-h-[8.5rem] no-underline">
      <span className={`grid h-12 w-12 place-items-center rounded-xl ${well}`}>
        <Icon className="h-6 w-6" />
      </span>
      <span>
        <span className="block font-bold leading-tight text-[var(--ink)]">{title}</span>
        <span className="mt-1 block text-xs font-medium text-[var(--ink-soft)]">{subtitle}</span>
      </span>
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const empty = value === "—";
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${empty ? "text-[var(--muted)]" : "text-[var(--ink)]"}`}>{value}</p>
    </div>
  );
}

function AccountRow({
  icon: Icon,
  title,
  subtitle,
  href,
  onClick,
  last,
}: {
  icon: (props: { className?: string }) => ReactNode;
  title: string;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  last?: boolean;
}) {
  const inner = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--bg-low)] text-[var(--ink-soft)]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-semibold">{title}</span>
        {subtitle ? <span className="mt-0.5 block text-xs text-[var(--ink-soft)]">{subtitle}</span> : null}
      </span>
      <IconChevron className="h-4 w-4 shrink-0 text-[var(--muted)]" />
    </>
  );
  const className = `flex w-full items-center gap-3 rounded-2xl px-2 py-3 ${last ? "" : "border-b border-[var(--ghost)]"}`;
  if (href) {
    return (
      <Link href={href} className={`${className} no-underline`}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {inner}
    </button>
  );
}

function PasswordField({
  id,
  label,
  value,
  visible,
  onToggle,
  onChange,
  autoComplete,
  placeholder,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
  minLength?: number;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="field pr-16"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--muted)]"
          onClick={onToggle}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
