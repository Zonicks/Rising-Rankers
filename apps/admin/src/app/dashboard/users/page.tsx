"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminDialog, AdminShell, PageSection } from "@/components/admin-shell";
import { SkeletonRegion, SkeletonTable } from "@/components/skeleton";
import { adminTokenKey, api } from "@/lib/api";
import { ist, statusChip, statusLabel } from "./user-display";

type UserRow = {
  id: string;
  fullName: string | null;
  emailMasked: string;
  status: string;
  programName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  openTicketCount: number;
  flagCount: number;
};

type ListResponse = { items: UserRow[]; nextCursor: string | null };

const STATUSES = [
  "",
  "ACTIVE",
  "SUSPENDED",
  "BLOCKED",
  "WITHDRAWAL_RESTRICTED",
  "UNDER_REVIEW",
  "KYC_PENDING",
] as const;

export default function AdminUsersPage() {
  const router = useRouter();
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<UserRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPurpose, setExportPurpose] = useState<"support_case" | "law_enforcement" | "user_request" | "fraud_review">(
    "support_case"
  );
  const [exportReason, setExportReason] = useState("");
  const [exportBusy, setExportBusy] = useState(false);

  const load = useCallback(
    async (cursor?: string) => {
      const token = localStorage.getItem(adminTokenKey);
      if (!token) {
        router.replace("/signin");
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (status) params.set("status", status);
        if (cursor) params.set("cursor", cursor);
        const data = await api<ListResponse>(`/api/v1/admin/users?${params}`, { token });
        setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load users");
      } finally {
        setLoading(false);
      }
    },
    [q, status, router]
  );

  useEffect(() => {
    const t = setTimeout(() => setQ(qDraft.trim()), 300);
    return () => clearTimeout(t);
  }, [qDraft]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell
      title="Users"
      subtitle="Find a student, open their account, then suspend, block, or restore."
    >
      {error ? <p className="msg-err mb-4">{error}</p> : null}

      <div className="mb-4 flex justify-end">
        <button type="button" className="btn-secondary btn-sm" onClick={() => setExportOpen(true)}>
          Export directory
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <div>
          <label className="admin-label">Search</label>
          <input
            className="admin-input"
            placeholder="Email, name, mobile, or user id"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
          />
        </div>
        <div>
          <label className="admin-label">Status</label>
          <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <PageSection title="Students">
        {loading && items.length === 0 ? (
          <SkeletonRegion>
            <SkeletonTable cols={5} rows={8} />
          </SkeletonRegion>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No students match. Try email or mobile.</p>
        ) : (
          <div className="row-list">
            {items.map((row) => (
              <div key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{row.fullName || "—"}</p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    <span className={`chip mr-2 ${statusChip(row.status)}`}>{statusLabel(row.status)}</span>
                    {row.emailMasked}
                    {row.programName ? ` · ${row.programName}` : ""}
                    {row.openTicketCount ? ` · ${row.openTicketCount} open ticket${row.openTicketCount === 1 ? "" : "s"}` : ""}
                    {row.flagCount ? ` · ${row.flagCount} flag${row.flagCount === 1 ? "" : "s"}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Joined {ist(row.createdAt)}
                    {row.lastLoginAt ? ` · Last login ${ist(row.lastLoginAt)}` : " · Last login —"}
                  </p>
                </div>
                <Link href={`/dashboard/users/${row.id}`} className="btn-secondary btn-sm">
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
        {nextCursor ? (
          <button
            type="button"
            className="btn-secondary mt-4"
            disabled={loading}
            onClick={() => void load(nextCursor)}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </PageSection>

      {exportOpen ? (
        <AdminDialog title="Export directory" onClose={() => !exportBusy && setExportOpen(false)}>
          <form
            className="space-y-4"
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              const token = localStorage.getItem(adminTokenKey);
              if (!token) return;
              setExportBusy(true);
              setError(null);
              try {
                const data = await api<{ filename: string; csv: string; count: number; capped: boolean }>(
                  "/api/v1/admin/users/export",
                  {
                    method: "POST",
                    token,
                    body: JSON.stringify({
                      purpose: exportPurpose,
                      reason: exportReason,
                      q: q || undefined,
                      status: status || undefined,
                    }),
                  }
                );
                const blob = new Blob([data.csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = data.filename;
                a.click();
                URL.revokeObjectURL(url);
                setExportOpen(false);
                setExportReason("");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Export failed");
              } finally {
                setExportBusy(false);
              }
            }}
          >
            <p className="text-sm text-[var(--ink-soft)]">
              Super-admin only. Masked emails, max 200 rows, current search/status, purpose logged.
            </p>
            <div>
              <label className="admin-label">Purpose</label>
              <select
                className="admin-input"
                value={exportPurpose}
                onChange={(e) => setExportPurpose(e.target.value as typeof exportPurpose)}
              >
                <option value="support_case">Support case</option>
                <option value="user_request">User request</option>
                <option value="fraud_review">Fraud review</option>
                <option value="law_enforcement">Law enforcement</option>
              </select>
            </div>
            <textarea
              className="admin-textarea min-h-20"
              value={exportReason}
              onChange={(e) => setExportReason(e.target.value)}
              minLength={10}
              required
              placeholder="Why this export is needed"
            />
            <button className="btn-primary w-full" disabled={exportBusy || exportReason.trim().length < 10}>
              {exportBusy ? "Preparing…" : "Download CSV"}
            </button>
          </form>
        </AdminDialog>
      ) : null}
    </AdminShell>
  );
}
