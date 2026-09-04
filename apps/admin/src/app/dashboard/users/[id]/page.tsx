"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminDialog, AdminShell, PageSection } from "@/components/admin-shell";
import { SkeletonRegion, SkeletonUserDetail } from "@/components/skeleton";
import { adminTokenKey, api } from "@/lib/api";
import { ist, statusChip, statusLabel } from "../user-display";

type AccountStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED" | "WITHDRAWAL_RESTRICTED";

type Permissions = {
  canReveal: boolean;
  canSuspend: boolean;
  canBlock: boolean;
  canRestrictWithdrawals: boolean;
  canRestore: boolean;
  canRevokeSessions: boolean;
  canSupport: boolean;
  canResetPassword: boolean;
  canCredit: boolean;
  canCorrect: boolean;
  canExport: boolean;
  canExportWallet: boolean;
  canErase: boolean;
  canRights: boolean;
};

type TicketNote = {
  id: string;
  body: string;
  visibility: string;
  createdAt: string;
  author: string;
};

type TicketRow = {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  dueAt: string;
  overdue: boolean;
  firstReplyOverdue?: boolean;
  privacySla?: boolean;
  messages: TicketNote[];
};

type RightsRow = {
  id: string;
  type: string;
  status: string;
  purpose: string | null;
  reason: string;
  dueAt: string | null;
  holdUntil: string | null;
  closedAt: string | null;
  createdAt: string;
  overdue: boolean;
  readyToErase: boolean;
  actor: string | null;
};

type LedgerRow = {
  id: string;
  type: string;
  amount: string;
  bucket: string;
  createdAt: string;
  reference: string | null;
};

type AuthEventRow = {
  id: string;
  event: string;
  success: boolean;
  occurredAt: string;
  ipMasked: string | null;
  platform: string | null;
  deviceId: string | null;
  country?: string | null;
  city?: string | null;
};

type DeviceRow = {
  id: string;
  deviceId: string;
  platform: string | null;
  lastSeenAt: string;
  lastIpMasked: string | null;
  revokedAt: string | null;
};

type UserDetail = {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  emailMasked: string;
  status: string;
  disabledAt: string | null;
  disabledReason: string | null;
  lastLoginAt: string | null;
  lastLoginIpMasked: string | null;
  createdAt: string;
  pointsBalance: number;
  streakCount: number;
  under18: boolean | null;
  profile: {
    mobileMasked: string | null;
    city: string | null;
    state: string | null;
    classOrExam: string | null;
    consentAccepted: boolean;
    consentAt?: string | null;
    parentGuardian: string | null;
    parentalConsentStatus?: string;
    parentalConsentRef?: string | null;
    parentalConsentAt?: string | null;
    profileComplete: boolean;
  };
  program: { id: string; name: string; slug: string } | null;
  wallet: { deposited: string; award: string; promo: string };
  openTicketCount: number;
  flagCount: number;
  deviceCount: number;
  recentFailCount: number;
  devices: DeviceRow[];
  authEvents: AuthEventRow[];
  tickets: TicketRow[];
  ledger: LedgerRow[];
  nominee: { name: string; email: string | null; mobile: string | null; relation: string | null } | null;
  rights: RightsRow[];
  actions: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    action: string;
    reason: string;
    notifyStudent: boolean;
    createdAt: string;
    actor: string;
  }>;
  permissions: Permissions;
};

type Revealed = {
  email: string;
  mobile: string | null;
  dateOfBirth: string | null;
  lastLoginIp: string | null;
  authEventIps: Record<string, string | null>;
};

const ACTION_COPY: Record<AccountStatus, { title: string; verb: string; hint: string }> = {
  SUSPENDED: {
    title: "Suspend account",
    verb: "Suspend",
    hint: "They cannot sign in until you restore the account. Current sessions are signed out.",
  },
  BLOCKED: {
    title: "Block account",
    verb: "Block",
    hint: "Use for confirmed fraud or a legal order. Sign-in stays off. Current sessions are signed out.",
  },
  WITHDRAWAL_RESTRICTED: {
    title: "Restrict withdrawals",
    verb: "Restrict withdrawals",
    hint: "They can still study and take tests. Award cash-out is blocked.",
  },
  ACTIVE: {
    title: "Restore account",
    verb: "Restore",
    hint: "Sign-in and withdrawals return to normal. They must sign in again.",
  },
};

function eventLabel(event: string) {
  if (event === "SIGNIN_OK") return "Signed in";
  if (event === "SIGNIN_FAIL") return "Failed sign-in";
  if (event === "SIGNUP_OK") return "Signed up";
  if (event === "ACCOUNT_DISABLED") return "Sign-in blocked";
  if (event === "PASSWORD_CHANGE") return "Password changed";
  if (event === "SESSION_REVOKE") return "Sessions revoked";
  if (event === "RESET_REQUEST") return "Password reset sent";
  if (event === "MFA_CHALLENGE") return "MFA challenge";
  if (event === "MFA_OK") return "MFA ok";
  if (event === "MFA_FAIL") return "MFA failed";
  return event.replaceAll("_", " ");
}

const TICKET_CATEGORIES = [
  "Payment",
  "Wallet",
  "Withdrawal",
  "Question error",
  "Test issue",
  "Account",
  "Privacy",
  "Other",
] as const;

const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [tab, setTab] = useState<"overview" | "activity" | "support" | "money" | "rights">("overview");
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<AccountStatus | null>(null);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [revealUntil, setRevealUntil] = useState<number | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeDeviceId, setRevokeDeviceId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [resetCopied, setResetCopied] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketCategory, setTicketCategory] = useState<(typeof TICKET_CATEGORIES)[number]>("Account");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState(100);
  const [creditBucket, setCreditBucket] = useState<"deposited" | "award" | "promo">("deposited");
  const [creditNote, setCreditNote] = useState("");
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctReason, setCorrectReason] = useState("");
  const [correctForm, setCorrectForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    city: "",
    state: "",
    classOrExam: "",
    parentGuardian: "",
    dateOfBirth: "",
  });
  const [rightsKind, setRightsKind] = useState<"ACCESS" | "ERASE" | "CONSENT_WITHDRAW" | "NOMINATE" | "GRIEVANCE" | null>(null);
  const [rightsReason, setRightsReason] = useState("");
  const [rightsPurpose, setRightsPurpose] = useState<"support_case" | "law_enforcement" | "user_request" | "fraud_review">("user_request");
  const [parentNote, setParentNote] = useState("");
  const [nomineeForm, setNomineeForm] = useState({ name: "", email: "", mobile: "", relation: "" });
  const [exportRid, setExportRid] = useState<string | null>(null);
  const [eraseRid, setEraseRid] = useState<string | null>(null);
  const [parentalOpen, setParentalOpen] = useState(false);
  const [parentalRef, setParentalRef] = useState("");
  const [parentalNote, setParentalNote] = useState("");
  const [parentalMethod, setParentalMethod] = useState<"MANUAL" | "VENDOR_PENDING">("MANUAL");

  const load = useCallback(async () => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) {
      router.replace("/signin");
      return;
    }
    setError(null);
    try {
      setUser(await api<UserDetail>(`/api/v1/admin/users/${id}`, { token }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load user");
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!revealUntil) return;
    const t = setTimeout(() => {
      setRevealed(null);
      setRevealUntil(null);
    }, Math.max(0, revealUntil - Date.now()));
    return () => clearTimeout(t);
  }, [revealUntil]);

  async function reveal() {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setError(null);
    try {
      const data = await api<Revealed>(`/api/v1/admin/users/${id}/reveal`, { method: "POST", token });
      setRevealed(data);
      setRevealUntil(Date.now() + 10 * 60 * 1000);
      setMsg("Personal data visible for 10 minutes. This was logged.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reveal failed");
    }
  }

  async function submitStatus(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ unchanged: boolean; status: string }>(`/api/v1/admin/users/${id}/status`, {
        method: "POST",
        token,
        body: JSON.stringify({ status: pending, reason, notify }),
      });
      setMsg(
        res.unchanged
          ? `Already ${statusLabel(res.status).toLowerCase()}.`
          : `${ACTION_COPY[pending].verb} applied.`
      );
      setPending(null);
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitRevoke(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/users/${id}/sessions/revoke`, {
        method: "POST",
        token,
        body: JSON.stringify({
          reason: revokeReason,
          deviceId: revokeDeviceId ?? undefined,
        }),
      });
      setMsg(
        revokeDeviceId
          ? "Device revoked. The student must sign in again on every device."
          : "All sessions revoked. The student must sign in again."
      );
      setRevokeOpen(false);
      setRevokeReason("");
      setRevokeDeviceId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ resetUrl: string; expiresAt: string }>(
        `/api/v1/admin/users/${id}/password-reset`,
        { method: "POST", token, body: JSON.stringify({ reason: resetReason }) }
      );
      setResetUrl(data.resetUrl);
      setMsg("Reset link created. Copy it and send it to the student — email send comes later.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitTicket(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/users/${id}/tickets`, {
        method: "POST",
        token,
        body: JSON.stringify({
          category: ticketCategory,
          subject: ticketSubject,
          message: ticketMessage,
          visibility: "INTERNAL",
        }),
      });
      setMsg("Ticket opened. The note is internal — the student cannot see it.");
      setTicketOpen(false);
      setTicketSubject("");
      setTicketMessage("");
      setTab("support");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open ticket");
    } finally {
      setBusy(false);
    }
  }

  async function submitNote(e: FormEvent, ticketId: string) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/users/${id}/tickets/${ticketId}/notes`, {
        method: "POST",
        token,
        body: JSON.stringify({ body: noteBody, visibility: "INTERNAL" }),
      });
      setMsg("Internal note saved.");
      setNoteBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setBusy(false);
    }
  }

  async function setTicketStatus(ticketId: string, status: string) {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setError(null);
    try {
      await api(`/api/v1/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update ticket");
    }
  }

  async function submitCredit(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ deposited: string; award: string; promo: string }>(
        "/api/v1/admin/wallet/credit",
        {
          method: "POST",
          token,
          body: JSON.stringify({
            userId: id,
            amount: creditAmount,
            bucket: creditBucket,
            note: creditNote || "Credit from user 360",
          }),
        }
      );
      setMsg(`Credited ₹${creditAmount} to ${creditBucket}. Deposited now ₹${data.deposited}.`);
      setCreditOpen(false);
      setCreditNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credit failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitCorrect(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { reason: correctReason };
      if (correctForm.firstName.trim()) body.firstName = correctForm.firstName.trim();
      if (correctForm.lastName.trim()) body.lastName = correctForm.lastName.trim();
      if (correctForm.mobile.trim()) body.mobile = correctForm.mobile.trim();
      if (correctForm.city.trim()) body.city = correctForm.city.trim();
      if (correctForm.state.trim()) body.state = correctForm.state.trim();
      if (correctForm.classOrExam.trim()) body.classOrExam = correctForm.classOrExam.trim();
      if (correctForm.parentGuardian.trim()) body.parentGuardian = correctForm.parentGuardian.trim();
      if (correctForm.dateOfBirth) body.dateOfBirth = correctForm.dateOfBirth;
      await api(`/api/v1/admin/users/${id}/profile`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setMsg("Profile corrected. This was logged.");
      setCorrectOpen(false);
      setCorrectReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Correction failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitRights(e: FormEvent) {
    e.preventDefault();
    if (!rightsKind) return;
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>(`/api/v1/admin/users/${id}/rights`, {
        method: "POST",
        token,
        body: JSON.stringify({
          type: rightsKind,
          reason: rightsReason,
          purpose: rightsKind === "ACCESS" ? rightsPurpose : undefined,
          parentNote: rightsKind === "ERASE" ? parentNote || undefined : undefined,
          notify: rightsKind === "ERASE",
          nominee:
            rightsKind === "NOMINATE"
              ? {
                  name: nomineeForm.name,
                  email: nomineeForm.email || undefined,
                  mobile: nomineeForm.mobile || undefined,
                  relation: nomineeForm.relation || undefined,
                }
              : undefined,
        }),
      });
      if (rightsKind === "ACCESS") {
        const pack = await api<{ filename: string; htmlFilename: string; pack: unknown; html: string }>(
          `/api/v1/admin/users/${id}/rights/${created.id}/export`,
          { method: "POST", token, body: JSON.stringify({ purpose: rightsPurpose }) }
        );
        downloadText(pack.filename, JSON.stringify(pack.pack, null, 2), "application/json");
        downloadText(pack.htmlFilename, pack.html, "text/html");
        setMsg("Access pack downloaded. This export was logged.");
      } else if (rightsKind === "ERASE") {
        setMsg("Erasure hold started. Profile wipe is blocked for 48 hours.");
      } else if (rightsKind === "CONSENT_WITHDRAW") {
        setMsg("Consent withdrawn. Optional marketing must stay off.");
      } else if (rightsKind === "NOMINATE") {
        setMsg("Nominee saved.");
      } else {
        setMsg("Privacy grievance opened with a 90-day close target.");
      }
      setRightsKind(null);
      setRightsReason("");
      setParentNote("");
      setTab("rights");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rights action failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitExport(e: FormEvent) {
    e.preventDefault();
    if (!exportRid) return;
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const pack = await api<{ filename: string; htmlFilename: string; pack: unknown; html: string }>(
        `/api/v1/admin/users/${id}/rights/${exportRid}/export`,
        { method: "POST", token, body: JSON.stringify({ purpose: rightsPurpose }) }
      );
      downloadText(pack.filename, JSON.stringify(pack.pack, null, 2), "application/json");
      downloadText(pack.htmlFilename, pack.html, "text/html");
      setMsg("Access pack downloaded. This export was logged.");
      setExportRid(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitErase(e: FormEvent) {
    e.preventDefault();
    if (!eraseRid) return;
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/users/${id}/rights/${eraseRid}/erase`, {
        method: "POST",
        token,
        body: JSON.stringify({ reason: rightsReason, parentNote: parentNote || undefined }),
      });
      setMsg("Profile anonymised. Wallet and login logs were kept.");
      setEraseRid(null);
      setRightsReason("");
      setParentNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erasure failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitParental(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/users/${id}/parental-consent`, {
        method: "POST",
        token,
        body: JSON.stringify({
          method: parentalMethod,
          reference: parentalRef,
          note: parentalNote,
        }),
      });
      setMsg("Parental consent recorded. No government ID number was stored.");
      setParentalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record consent");
    } finally {
      setBusy(false);
    }
  }

  if (!user && !error) {
    return (
      <AdminShell title="User" subtitle="Student account">
        <SkeletonRegion>
          <SkeletonUserDetail />
        </SkeletonRegion>
      </AdminShell>
    );
  }

  if (!user) {
    return (
      <AdminShell title="User" subtitle="Could not open this account.">
        <p className="msg-err">{error}</p>
        <Link href="/dashboard/users" className="btn-secondary mt-4 inline-flex">
          Back to users
        </Link>
      </AdminShell>
    );
  }

  const p = user.permissions;
  const place = [user.profile.city, user.profile.state].filter(Boolean).join(", ");

  return (
    <AdminShell
      title={user.fullName || "Student"}
      subtitle={`${user.emailMasked} · joined ${ist(user.createdAt)}`}
    >
      <div className="mb-6">
        <Link href="/dashboard/users" className="text-sm text-[var(--accent)] underline-offset-2 hover:underline">
          ← Users
        </Link>
      </div>
      {msg ? <p className="msg-ok mb-4">{msg}</p> : null}
      {error ? <p className="msg-err mb-4">{error}</p> : null}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className={`chip ${statusChip(user.status)}`}>{statusLabel(user.status)}</span>
        {user.under18 ? <span className="chip chip-accent">Under 18</span> : null}
        {user.under18 === false ? <span className="chip">18+</span> : null}
        {user.under18 && !user.profile.parentGuardian ? (
          <span className="chip chip-danger">Needs parent / guardian</span>
        ) : null}
        {user.under18 && !user.profile.consentAccepted ? (
          <span className="chip chip-danger">Needs consent</span>
        ) : null}
        {user.program ? <span className="chip">{user.program.name}</span> : null}
        {user.recentFailCount >= 5 ? (
          <span className="chip chip-danger">{user.recentFailCount} failed sign-ins (24h)</span>
        ) : null}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={!p.canSuspend || user.status === "SUSPENDED"}
          onClick={() => {
            setPending("SUSPENDED");
            setReason("");
            setNotify(true);
          }}
        >
          {user.status === "SUSPENDED" ? "Suspended" : "Suspend"}
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={!p.canBlock || user.status === "BLOCKED"}
          onClick={() => {
            setPending("BLOCKED");
            setReason("");
            setNotify(true);
          }}
        >
          {user.status === "BLOCKED" ? "Blocked" : "Block"}
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={!p.canRestrictWithdrawals || user.status === "WITHDRAWAL_RESTRICTED"}
          onClick={() => {
            setPending("WITHDRAWAL_RESTRICTED");
            setReason("");
            setNotify(true);
          }}
        >
          {user.status === "WITHDRAWAL_RESTRICTED" ? "Withdrawals restricted" : "Restrict withdrawals"}
        </button>
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={!p.canRestore || user.status === "ACTIVE"}
          onClick={() => {
            setPending("ACTIVE");
            setReason("");
            setNotify(true);
          }}
        >
          {user.status === "ACTIVE" ? "Active" : "Restore"}
        </button>
        {p.canRevokeSessions ? (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              setRevokeDeviceId(null);
              setRevokeReason("");
              setRevokeOpen(true);
            }}
          >
            Revoke all sessions
          </button>
        ) : null}
        {p.canResetPassword ? (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              setResetReason("");
              setResetUrl(null);
              setResetCopied(false);
              setResetOpen(true);
            }}
          >
            Send reset
          </button>
        ) : null}
        {p.canReveal ? (
          <button type="button" className="btn-secondary btn-sm" onClick={() => void reveal()} disabled={Boolean(revealed)}>
            {revealed ? "PII visible" : "Reveal PII"}
          </button>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn-sm ${tab === "overview" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`btn-sm ${tab === "activity" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("activity")}
        >
          Activity
        </button>
        <button
          type="button"
          className={`btn-sm ${tab === "support" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("support")}
        >
          Support{user.openTicketCount ? ` (${user.openTicketCount})` : ""}
        </button>
        <button
          type="button"
          className={`btn-sm ${tab === "money" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("money")}
        >
          Money
        </button>
        <button
          type="button"
          className={`btn-sm ${tab === "rights" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("rights")}
        >
          Rights
        </button>
      </div>

      {tab === "overview" ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <PageSection title="Overview">
              <dl className="space-y-3 text-sm">
                <Row label="Email" value={revealed?.email ?? user.emailMasked} />
                <Row label="Mobile" value={revealed?.mobile ?? user.profile.mobileMasked ?? "—"} />
                <Row
                  label="Date of birth"
                  value={
                    revealed?.dateOfBirth
                      ? ist(revealed.dateOfBirth)
                      : user.under18 == null
                        ? "—"
                        : user.under18
                          ? "Under 18 (date hidden)"
                          : "18+ (date hidden)"
                  }
                />
                <Row label="Program" value={user.program?.name ?? "—"} />
                <Row label="Class / exam" value={user.profile.classOrExam ?? "—"} />
                <Row label="Place" value={place || "—"} />
                <Row label="Parent / guardian" value={user.profile.parentGuardian ?? "—"} />
                <Row label="Consent" value={user.profile.consentAccepted ? "Accepted" : "Not accepted"} />
                <Row label="Last login" value={ist(user.lastLoginAt)} />
                <Row label="Last IP" value={revealed?.lastLoginIp ?? user.lastLoginIpMasked ?? "—"} />
                {user.disabledReason ? <Row label="Disable reason" value={user.disabledReason} /> : null}
              </dl>
            </PageSection>

            <PageSection title="Snapshot">
              <dl className="space-y-3 text-sm">
                <Row label="Deposited" value={`₹${user.wallet.deposited}`} />
                <Row label="Awards" value={`₹${user.wallet.award}`} />
                <Row label="Promo" value={`₹${user.wallet.promo}`} />
                <Row label="Points" value={String(user.pointsBalance)} />
                <Row label="Streak" value={`${user.streakCount} day${user.streakCount === 1 ? "" : "s"}`} />
                <Row label="Open tickets" value={String(user.openTicketCount)} />
                <Row label="Open fraud flags" value={String(user.flagCount)} />
                <Row label="Devices" value={String(user.deviceCount)} />
              </dl>
            </PageSection>
          </div>

          <PageSection title="Status history">
            {user.actions.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No status changes yet.</p>
            ) : (
              <div className="row-list">
                {user.actions.map((a) => (
                  <div key={a.id} className="py-3">
                    <p className="font-semibold">
                      {statusLabel(a.fromStatus)} → {statusLabel(a.toStatus)}
                    </p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">{a.reason}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {a.actor} · {ist(a.createdAt)}
                      {a.notifyStudent ? " · notify marked" : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </PageSection>
        </>
      ) : null}

      {tab === "activity" ? (
        <>
          <PageSection title="Sign-in log">
            {user.authEvents.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No login events yet. They appear after the next sign-in or failed attempt.
              </p>
            ) : (
              <div className="row-list">
                {user.authEvents.map((e) => (
                  <div key={e.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        <span className={`chip mr-2 ${e.success ? "chip-success" : "chip-danger"}`}>
                          {e.success ? "OK" : "Fail"}
                        </span>
                        {eventLabel(e.event)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">
                        {revealed?.authEventIps[e.id] ?? e.ipMasked ?? "IP —"}
                        {e.platform ? ` · ${e.platform}` : ""}
                        {e.country ? ` · ${e.country}` : ""}
                        {e.city ? ` · ${e.city}` : ""}
                        {e.deviceId ? ` · device ${e.deviceId.slice(0, 8)}…` : ""}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--muted)]">{ist(e.occurredAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </PageSection>

          <PageSection title="Devices">
            {user.devices.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No registered devices.</p>
            ) : (
              <div className="row-list">
                {user.devices.map((d) => (
                  <div key={d.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{d.platform || "Unknown platform"}</p>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">
                        {d.lastIpMasked ?? "IP —"} · last seen {ist(d.lastSeenAt)}
                        {d.revokedAt ? (
                          <span className="chip chip-danger ml-2">Revoked</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{d.deviceId}</p>
                    </div>
                    {p.canRevokeSessions && !d.revokedAt ? (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          setRevokeDeviceId(d.deviceId);
                          setRevokeReason("");
                          setRevokeOpen(true);
                        }}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </PageSection>
        </>
      ) : null}

      {tab === "support" ? (
        <PageSection
          title="Tickets"
          action={
            p.canSupport ? (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => {
                  setTicketSubject("");
                  setTicketMessage("");
                  setTicketCategory("Account");
                  setTicketOpen(true);
                }}
              >
                New ticket
              </button>
            ) : null
          }
        >
          {(user.tickets ?? []).length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No tickets yet.</p>
          ) : (
            <div className="row-list">
              {(user.tickets ?? []).map((t) => {
                const open = openTicketId === t.id;
                return (
                  <div key={t.id} className="py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setOpenTicketId(open ? null : t.id)}
                      >
                        <p className="font-semibold">{t.subject}</p>
                        <p className="mt-1 text-sm text-[var(--ink-soft)]">
                          {t.category} · {t.status.replaceAll("_", " ")} · {ist(t.createdAt)}
                        </p>
                        <p className="mt-1 text-sm text-[var(--ink-soft)] whitespace-pre-wrap">{t.message}</p>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        {t.privacySla && t.overdue ? (
                          <span className="chip chip-danger">90-day grievance overdue</span>
                        ) : t.firstReplyOverdue || t.overdue ? (
                          <span className="chip chip-danger">First reply overdue</span>
                        ) : t.privacySla ? (
                          <span className="chip">Privacy · 90-day SLA</span>
                        ) : null}
                        {p.canSupport ? (
                          <select
                            className="admin-input w-auto min-w-40"
                            value={t.status}
                            onChange={(e) => void setTicketStatus(t.id, e.target.value)}
                          >
                            {TICKET_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="chip">{t.status.replaceAll("_", " ")}</span>
                        )}
                      </div>
                    </div>
                    {open ? (
                      <div className="mt-4 space-y-3 rounded-xl bg-[var(--accent-soft)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Internal notes — not visible to the student
                        </p>
                        {t.messages.length === 0 ? (
                          <p className="text-sm text-[var(--muted)]">No notes yet.</p>
                        ) : (
                          t.messages.map((m) => (
                            <div key={m.id}>
                              <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {m.author} · {ist(m.createdAt)} · {m.visibility === "INTERNAL" ? "Internal" : "Student"}
                              </p>
                            </div>
                          ))
                        )}
                        {p.canSupport ? (
                          <form onSubmit={(e) => void submitNote(e, t.id)} className="space-y-3">
                            <textarea
                              className="admin-textarea min-h-20"
                              value={open ? noteBody : ""}
                              onChange={(e) => setNoteBody(e.target.value)}
                              placeholder="Add an internal note…"
                              required
                              maxLength={2000}
                            />
                            <button className="btn-primary btn-sm" disabled={busy || !noteBody.trim()}>
                              {busy ? "Saving…" : "Add note"}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </PageSection>
      ) : null}

      {tab === "money" ? (
        <>
          <PageSection
            title="Wallet"
            action={
              p.canCredit ? (
                <button type="button" className="btn-primary btn-sm" onClick={() => setCreditOpen(true)}>
                  Credit wallet
                </button>
              ) : null
            }
          >
            <dl className="space-y-3 text-sm">
              <Row label="Deposited" value={`₹${user.wallet.deposited}`} />
              <Row label="Awards" value={`₹${user.wallet.award}`} />
              <Row label="Promo" value={`₹${user.wallet.promo}`} />
            </dl>
          </PageSection>
          <PageSection title="Recent ledger">
            {(user.ledger ?? []).length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No wallet movements yet.</p>
            ) : (
              <div className="row-list">
                {(user.ledger ?? []).map((e) => (
                  <div key={e.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        ₹{e.amount} · {e.bucket}
                      </p>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">
                        {e.type.replaceAll("_", " ")}
                        {e.reference ? ` · ${e.reference}` : ""}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--muted)]">{ist(e.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </PageSection>
        </>
      ) : null}

      {tab === "rights" ? (
        <>
          <PageSection title="DPDP desk">
            <p className="mb-4 text-sm text-[var(--ink-soft)]">
              Access, correction, consent, nominee, and erasure. Email cannot be swapped here.
              Under-18 erasure needs a parent note. Wipe waits 48 hours after notice.
            </p>
            <div className="flex flex-wrap gap-2">
              {p.canExportWallet ? (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => {
                    setRightsKind("ACCESS");
                    setRightsReason("");
                    setRightsPurpose("user_request");
                  }}
                >
                  Access export
                </button>
              ) : null}
              {p.canCorrect ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setCorrectForm({
                      firstName: user.firstName ?? "",
                      lastName: user.lastName ?? "",
                      mobile: "",
                      city: user.profile.city ?? "",
                      state: user.profile.state ?? "",
                      classOrExam: user.profile.classOrExam ?? "",
                      parentGuardian: user.profile.parentGuardian ?? "",
                      dateOfBirth: "",
                    });
                    setCorrectReason("");
                    setCorrectOpen(true);
                  }}
                >
                  Correct profile
                </button>
              ) : null}
              {p.canRights ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setRightsKind("CONSENT_WITHDRAW");
                    setRightsReason("");
                  }}
                >
                  Withdraw consent
                </button>
              ) : null}
              {p.canRights ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setNomineeForm({
                      name: user.nominee?.name ?? "",
                      email: user.nominee?.email ?? "",
                      mobile: user.nominee?.mobile ?? "",
                      relation: user.nominee?.relation ?? "",
                    });
                    setRightsKind("NOMINATE");
                    setRightsReason("");
                  }}
                >
                  Nominee
                </button>
              ) : null}
              {p.canRights ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setRightsKind("GRIEVANCE");
                    setRightsReason("");
                  }}
                >
                  Privacy grievance
                </button>
              ) : null}
              {p.canRights ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setParentalRef("");
                    setParentalNote("");
                    setParentalMethod("MANUAL");
                    setParentalOpen(true);
                  }}
                >
                  Parental consent
                </button>
              ) : null}
              {p.canErase ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={(user.rights ?? []).some((r) => r.type === "ERASE" && r.status === "HOLD")}
                  onClick={() => {
                    setRightsKind("ERASE");
                    setRightsReason("");
                    setParentNote("");
                  }}
                >
                  {(user.rights ?? []).some((r) => r.type === "ERASE" && r.status === "HOLD")
                    ? "Erasure on hold"
                    : "Start erasure"}
                </button>
              ) : null}
            </div>
            <dl className="mt-6 space-y-3 text-sm">
              <Row label="Consent" value={user.profile.consentAccepted ? "Accepted" : "Withdrawn / not accepted"} />
              <Row label="Consent at" value={user.profile.consentAt ? ist(user.profile.consentAt) : "—"} />
              <Row
                label="Nominee"
                value={
                  user.nominee
                    ? `${user.nominee.name}${user.nominee.relation ? ` (${user.nominee.relation})` : ""}`
                    : "—"
                }
              />
              <Row
                label="Parental consent"
                value={
                  user.profile.parentalConsentStatus && user.profile.parentalConsentStatus !== "NONE"
                    ? `${user.profile.parentalConsentStatus}${user.profile.parentalConsentAt ? ` · ${ist(user.profile.parentalConsentAt)}` : ""}`
                    : "—"
                }
              />
            </dl>
          </PageSection>
          <PageSection title="Requests">
            {(user.rights ?? []).length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No rights requests yet.</p>
            ) : (
              <div className="row-list">
                {(user.rights ?? []).map((r) => (
                  <div key={r.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        {rightsLabel(r.type)} · {r.status.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">{r.reason}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {r.actor ?? "—"} · {ist(r.createdAt)}
                        {r.holdUntil ? ` · wipe after ${ist(r.holdUntil)}` : ""}
                        {r.dueAt && r.type === "GRIEVANCE" ? ` · due ${ist(r.dueAt)}` : ""}
                      </p>
                      {r.overdue ? <span className="chip chip-danger mt-2">Overdue</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.canExportWallet && r.type === "ACCESS" ? (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => {
                            setExportRid(r.id);
                            setRightsPurpose((r.purpose as typeof rightsPurpose) || "user_request");
                          }}
                        >
                          {r.status === "DONE" ? "Export again" : "Export"}
                        </button>
                      ) : null}
                      {p.canErase && r.type === "ERASE" ? (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={r.status === "DONE" || !r.readyToErase}
                          onClick={() => {
                            setEraseRid(r.id);
                            setRightsReason("");
                            setParentNote("");
                          }}
                        >
                          {r.status === "DONE" ? "Erased" : r.readyToErase ? "Complete wipe" : "Waiting 48h"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PageSection>
        </>
      ) : null}

      {pending ? (
        <AdminDialog title={ACTION_COPY[pending].title} onClose={() => !busy && setPending(null)}>
          <p className="mb-4 text-sm text-[var(--ink-soft)]">{ACTION_COPY[pending].hint}</p>
          <form onSubmit={submitStatus} className="space-y-4">
            <div>
              <label className="admin-label">Reason (required)</label>
              <textarea
                className="admin-textarea min-h-24"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={10}
                maxLength={500}
                required
                placeholder="Why this action is needed (min 10 characters)"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              Mark as notify student (email send comes later)
            </label>
            <button className="btn-primary w-full" disabled={busy || reason.trim().length < 10}>
              {busy ? "Saving…" : ACTION_COPY[pending].verb}
            </button>
          </form>
        </AdminDialog>
      ) : null}

      {resetOpen ? (
        <AdminDialog
          title="Send password reset"
          onClose={() => !busy && setResetOpen(false)}
        >
          {resetUrl ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--ink-soft)]">
                Support cannot set or see a password. Copy this one-hour link and send it to
                the student. Email send is not wired yet.
              </p>
              <p className="break-all rounded-xl bg-[var(--accent-soft)] p-3 text-xs">{resetUrl}</p>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(resetUrl);
                  setResetCopied(true);
                }}
              >
                {resetCopied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : (
            <form onSubmit={submitReset} className="space-y-4">
              <p className="text-sm text-[var(--ink-soft)]">
                Creates a one-time reset link. Typical “cannot login” script: revoke sessions, then send reset.
              </p>
              <div>
                <label className="admin-label">Reason (required)</label>
                <textarea
                  className="admin-textarea min-h-24"
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  minLength={10}
                  maxLength={500}
                  required
                  placeholder="Cannot login, forgotten password…"
                />
              </div>
              <button className="btn-primary w-full" disabled={busy || resetReason.trim().length < 10}>
                {busy ? "Creating…" : "Create reset link"}
              </button>
            </form>
          )}
        </AdminDialog>
      ) : null}

      {ticketOpen ? (
        <AdminDialog title="New ticket" onClose={() => !busy && setTicketOpen(false)}>
          <form onSubmit={submitTicket} className="space-y-4">
            <p className="text-sm text-[var(--ink-soft)]">
              Opens a case on this account. The first note is internal.
            </p>
            <div>
              <label className="admin-label">Category</label>
              <select
                className="admin-input"
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value as (typeof TICKET_CATEGORIES)[number])}
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-label">Subject</label>
              <input
                className="admin-input"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                required
                maxLength={160}
              />
            </div>
            <div>
              <label className="admin-label">Internal note</label>
              <textarea
                className="admin-textarea min-h-24"
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                required
                maxLength={2000}
              />
            </div>
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Saving…" : "Open ticket"}
            </button>
          </form>
        </AdminDialog>
      ) : null}

      {creditOpen ? (
        <AdminDialog title="Credit wallet" onClose={() => !busy && setCreditOpen(false)}>
          <form onSubmit={submitCredit} className="space-y-4">
            <p className="text-sm text-[var(--ink-soft)]">
              Uses the existing finance credit API. This is logged on Audit.
            </p>
            <div>
              <label className="admin-label">Amount (₹)</label>
              <input
                type="number"
                min={1}
                step="0.01"
                className="admin-input metric"
                value={creditAmount}
                onChange={(e) => setCreditAmount(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="admin-label">Bucket</label>
              <select
                className="admin-input"
                value={creditBucket}
                onChange={(e) => setCreditBucket(e.target.value as "deposited" | "award" | "promo")}
              >
                <option value="deposited">Deposited</option>
                <option value="award">Award</option>
                <option value="promo">Promo</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Note</label>
              <input
                className="admin-input"
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                maxLength={240}
                placeholder="Support credit, prize correction…"
              />
            </div>
            <button className="btn-primary w-full" disabled={busy || creditAmount <= 0}>
              {busy ? "Crediting…" : "Credit"}
            </button>
          </form>
        </AdminDialog>
      ) : null}

      {correctOpen ? (
        <AdminDialog title="Correct profile" onClose={() => !busy && setCorrectOpen(false)}>
          <form onSubmit={submitCorrect} className="space-y-3">
            <p className="text-sm text-[var(--ink-soft)]">
              Student-visible fields only. Do not change email here.
            </p>
            {(
              [
                ["firstName", "First name"],
                ["lastName", "Last name"],
                ["mobile", "Mobile"],
                ["city", "City"],
                ["state", "State"],
                ["classOrExam", "Class / exam"],
                ["parentGuardian", "Parent / guardian"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="admin-label">{label}</label>
                <input
                  className="admin-input"
                  value={correctForm[key]}
                  onChange={(e) => setCorrectForm({ ...correctForm, [key]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <label className="admin-label">Date of birth</label>
              <input
                type="date"
                className="admin-input"
                value={correctForm.dateOfBirth}
                onChange={(e) => setCorrectForm({ ...correctForm, dateOfBirth: e.target.value })}
              />
            </div>
            <div>
              <label className="admin-label">Reason (required)</label>
              <textarea
                className="admin-textarea min-h-20"
                value={correctReason}
                onChange={(e) => setCorrectReason(e.target.value)}
                minLength={10}
                required
              />
            </div>
            <button className="btn-primary w-full" disabled={busy || correctReason.trim().length < 10}>
              {busy ? "Saving…" : "Save correction"}
            </button>
          </form>
        </AdminDialog>
      ) : null}

      {rightsKind ? (
        <AdminDialog
          title={rightsLabel(rightsKind)}
          onClose={() => !busy && setRightsKind(null)}
        >
          <form onSubmit={submitRights} className="space-y-4">
            {rightsKind === "ACCESS" ? (
              <div>
                <label className="admin-label">Purpose</label>
                <select
                  className="admin-input"
                  value={rightsPurpose}
                  onChange={(e) => setRightsPurpose(e.target.value as typeof rightsPurpose)}
                >
                  <option value="user_request">User request</option>
                  <option value="support_case">Support case</option>
                  <option value="fraud_review">Fraud review</option>
                  <option value="law_enforcement">Law enforcement</option>
                </select>
              </div>
            ) : null}
            {rightsKind === "ERASE" && user.under18 ? (
              <div>
                <label className="admin-label">Parent / guardian note</label>
                <textarea
                  className="admin-textarea min-h-20"
                  value={parentNote}
                  onChange={(e) => setParentNote(e.target.value)}
                  minLength={10}
                  required
                  placeholder="Who authorised this erasure for the child"
                />
              </div>
            ) : null}
            {rightsKind === "NOMINATE" ? (
              <>
                <div>
                  <label className="admin-label">Nominee name</label>
                  <input
                    className="admin-input"
                    value={nomineeForm.name}
                    onChange={(e) => setNomineeForm({ ...nomineeForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="admin-label">Relation</label>
                  <input
                    className="admin-input"
                    value={nomineeForm.relation}
                    onChange={(e) => setNomineeForm({ ...nomineeForm, relation: e.target.value })}
                  />
                </div>
                <div>
                  <label className="admin-label">Email</label>
                  <input
                    className="admin-input"
                    type="email"
                    value={nomineeForm.email}
                    onChange={(e) => setNomineeForm({ ...nomineeForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="admin-label">Mobile</label>
                  <input
                    className="admin-input"
                    value={nomineeForm.mobile}
                    onChange={(e) => setNomineeForm({ ...nomineeForm, mobile: e.target.value })}
                  />
                </div>
              </>
            ) : null}
            <div>
              <label className="admin-label">Reason (required)</label>
              <textarea
                className="admin-textarea min-h-20"
                value={rightsReason}
                onChange={(e) => setRightsReason(e.target.value)}
                minLength={10}
                required
              />
            </div>
            <button className="btn-primary w-full" disabled={busy || rightsReason.trim().length < 10}>
              {busy ? "Saving…" : rightsKind === "ACCESS" ? "Create and download" : "Confirm"}
            </button>
          </form>
        </AdminDialog>
      ) : null}

      {exportRid ? (
        <AdminDialog title="Export access pack" onClose={() => !busy && setExportRid(null)}>
          <form onSubmit={submitExport} className="space-y-4">
            <div>
              <label className="admin-label">Purpose</label>
              <select
                className="admin-input"
                value={rightsPurpose}
                onChange={(e) => setRightsPurpose(e.target.value as typeof rightsPurpose)}
              >
                <option value="user_request">User request</option>
                <option value="support_case">Support case</option>
                <option value="fraud_review">Fraud review</option>
                <option value="law_enforcement">Law enforcement</option>
              </select>
            </div>
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Preparing…" : "Download JSON + HTML"}
            </button>
          </form>
        </AdminDialog>
      ) : null}

      {eraseRid ? (
        <AdminDialog title="Complete erasure" onClose={() => !busy && setEraseRid(null)}>
          <form onSubmit={submitErase} className="space-y-4">
            <p className="text-sm text-[var(--ink-soft)]">
              Name, email, mobile, and date of birth are wiped. Wallet, awards, and login logs stay.
            </p>
            {user.under18 ? (
              <div>
                <label className="admin-label">Parent / guardian note</label>
                <textarea
                  className="admin-textarea min-h-20"
                  value={parentNote}
                  onChange={(e) => setParentNote(e.target.value)}
                  minLength={10}
                />
              </div>
            ) : null}
            <div>
              <label className="admin-label">Reason (required)</label>
              <textarea
                className="admin-textarea min-h-20"
                value={rightsReason}
                onChange={(e) => setRightsReason(e.target.value)}
                minLength={10}
                required
              />
            </div>
            <button className="btn-primary w-full" disabled={busy || rightsReason.trim().length < 10}>
              {busy ? "Wiping…" : "Anonymise profile"}
            </button>
          </form>
        </AdminDialog>
      ) : null}

      {parentalOpen ? (
        <AdminDialog title="Record parental consent" onClose={() => !busy && setParentalOpen(false)}>
          <form onSubmit={submitParental} className="space-y-4">
            <p className="text-sm text-[var(--ink-soft)]">
              v1 is a manual attestation. Do not paste Aadhaar, PAN, or an ID photo. DigiLocker is not wired.
            </p>
            <div>
              <label className="admin-label">Method</label>
              <select
                className="admin-input"
                value={parentalMethod}
                onChange={(e) => setParentalMethod(e.target.value as "MANUAL" | "VENDOR_PENDING")}
              >
                <option value="MANUAL">Manual attested note</option>
                <option value="VENDOR_PENDING">Vendor pending (placeholder)</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Opaque reference</label>
              <input
                className="admin-input"
                value={parentalRef}
                onChange={(e) => setParentalRef(e.target.value)}
                required
                minLength={4}
                placeholder="Internal case id or locker token — not an ID number"
              />
            </div>
            <div>
              <label className="admin-label">Note</label>
              <textarea
                className="admin-textarea min-h-20"
                value={parentalNote}
                onChange={(e) => setParentalNote(e.target.value)}
                minLength={10}
                required
              />
            </div>
            <button className="btn-primary w-full" disabled={busy || parentalNote.trim().length < 10}>
              {busy ? "Saving…" : "Save"}
            </button>
          </form>
        </AdminDialog>
      ) : null}

      {revokeOpen ? (
        <AdminDialog
          title={revokeDeviceId ? "Revoke this device" : "Revoke all sessions"}
          onClose={() => !busy && setRevokeOpen(false)}
        >
          <p className="mb-4 text-sm text-[var(--ink-soft)]">
            This signs the student out everywhere. Tokens are not device-bound, so one revoke
            invalidates every current session.
          </p>
          <form onSubmit={submitRevoke} className="space-y-4">
            <div>
              <label className="admin-label">Reason (required)</label>
              <textarea
                className="admin-textarea min-h-24"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                minLength={10}
                maxLength={500}
                required
                placeholder="Stolen phone, password leak, support request…"
              />
            </div>
            <button className="btn-primary w-full" disabled={busy || revokeReason.trim().length < 10}>
              {busy ? "Saving…" : "Revoke sessions"}
            </button>
          </form>
        </AdminDialog>
      ) : null}
    </AdminShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function rightsLabel(type: string) {
  if (type === "ACCESS") return "Access export";
  if (type === "CORRECT") return "Correction";
  if (type === "ERASE") return "Erasure";
  if (type === "CONSENT_WITHDRAW") return "Consent withdraw";
  if (type === "NOMINATE") return "Nominee";
  if (type === "GRIEVANCE") return "Privacy grievance";
  return type.replaceAll("_", " ");
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
