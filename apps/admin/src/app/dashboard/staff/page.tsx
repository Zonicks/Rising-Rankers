"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog, AdminShell, PageSection } from "@/components/admin-shell";
import { SkeletonRegion, SkeletonTable } from "@/components/skeleton";
import { adminTokenKey, api } from "@/lib/api";
import { ist, statusChip, statusLabel } from "../users/user-display";

type StaffRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const ROLES = [
  "SUPER_ADMIN",
  "SUPPORT_ADMIN",
  "FINANCE_ADMIN",
  "TEST_ADMIN",
  "CONTENT_ADMIN",
  "READ_ONLY",
] as const;

export default function AdminStaffPage() {
  const router = useRouter();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<StaffRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "SUPPORT_ADMIN" as (typeof ROLES)[number],
  });
  const [reason, setReason] = useState("");
  const [nextRole, setNextRole] = useState<(typeof ROLES)[number]>("SUPPORT_ADMIN");
  const [nextStatus, setNextStatus] = useState<"ACTIVE" | "SUSPENDED">("ACTIVE");

  async function load() {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return router.replace("/signin");
    try {
      setRows(await api<StaffRow[]>("/api/v1/admin/staff", { token }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load staff");
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/admin/staff", { method: "POST", token, body: JSON.stringify(form) });
      setMsg("Staff account created. They must use their own login — no shared passwords.");
      setCreateOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/staff/${edit.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ role: nextRole, status: nextStatus, reason }),
      });
      setMsg("Staff account updated.");
      setEdit(null);
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Staff" subtitle="Unique staff logins. Super-admin only.">
      {msg ? <p className="msg-ok mb-4">{msg}</p> : null}
      {error ? <p className="msg-err mb-4">{error}</p> : null}
      <PageSection
        title="Accounts"
        action={
          <button type="button" className="btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
            New staff
          </button>
        }
      >
        {!ready ? (
          <SkeletonRegion>
            <SkeletonTable cols={4} rows={6} />
          </SkeletonRegion>
        ) : (
        <div className="row-list">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{r.fullName || r.email}</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  <span className={`chip mr-2 ${statusChip(r.status)}`}>{statusLabel(r.status)}</span>
                  {r.email} · {r.role.replaceAll("_", " ")}
                  {r.totpEnabled ? " · MFA on" : " · MFA off"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Joined {ist(r.createdAt)}
                  {r.lastLoginAt ? ` · Last login ${ist(r.lastLoginAt)}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setEdit(r);
                  setNextRole(r.role as (typeof ROLES)[number]);
                  setNextStatus(r.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE");
                  setReason("");
                }}
              >
                Edit
              </button>
            </div>
          ))}
        </div>
        )}
      </PageSection>

      {createOpen ? (
        <AdminDialog title="New staff account" onClose={() => !busy && setCreateOpen(false)}>
          <form onSubmit={submitCreate} className="space-y-3">
            <p className="text-sm text-[var(--ink-soft)]">Each person gets their own email. Do not share Admin123!.</p>
            <div>
              <label className="admin-label">Full name</label>
              <input className="admin-input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            </div>
            <div>
              <label className="admin-label">Email</label>
              <input type="email" className="admin-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="admin-label">Password</label>
              <input type="password" className="admin-input" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div>
              <label className="admin-label">Role</label>
              <select className="admin-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as (typeof ROLES)[number] })}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Create"}</button>
          </form>
        </AdminDialog>
      ) : null}

      {edit ? (
        <AdminDialog title={`Edit ${edit.email}`} onClose={() => !busy && setEdit(null)}>
          <form onSubmit={submitEdit} className="space-y-3">
            <div>
              <label className="admin-label">Role</label>
              <select className="admin-input" value={nextRole} onChange={(e) => setNextRole(e.target.value as (typeof ROLES)[number])}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-label">Status</label>
              <select className="admin-input" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as "ACTIVE" | "SUSPENDED")}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Reason</label>
              <textarea className="admin-textarea min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} required />
            </div>
            <button className="btn-primary w-full" disabled={busy || reason.trim().length < 10}>{busy ? "Saving…" : "Save"}</button>
          </form>
        </AdminDialog>
      ) : null}
    </AdminShell>
  );
}
