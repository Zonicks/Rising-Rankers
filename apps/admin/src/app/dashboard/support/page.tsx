"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell, PageSection } from "@/components/admin-shell";
import { SkeletonRegion, SkeletonTable } from "@/components/skeleton";
import { adminTokenKey, api } from "@/lib/api";

type Ticket = {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string;
  user: { id: string; email: string; fullName: string | null };
};

const STATUSES: Ticket["status"][] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export default function AdminSupportPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Ticket[]>([]);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(token: string) {
    setRows(await api<Ticket[]>("/api/v1/admin/support/tickets", { token }));
    setReady(true);
  }

  useEffect(() => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return router.replace("/signin");
    load(token).catch(() => router.replace("/signin"));
  }, [router]);

  async function setStatus(id: string, status: Ticket["status"]) {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setError(null);
    try {
      await api(`/api/v1/admin/support/tickets/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      setMsg(`Updated ${id.slice(0, 8)}… → ${status.replaceAll("_", " ")}`);
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <AdminShell title="Support" subtitle="Student tickets. Update status as you work them.">
      {msg ? <p className="msg-ok mb-6">{msg}</p> : null}
      {error ? <p className="msg-err mb-6">{error}</p> : null}

      <PageSection title="Tickets">
        {!ready ? (
          <SkeletonRegion>
            <SkeletonTable cols={4} rows={8} />
          </SkeletonRegion>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No tickets yet.</p>
        ) : (
          <div className="row-list">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.subject}</p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">
                      {r.user.fullName ?? "—"} · {r.user.email} · {r.category} ·{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </p>
                    {r.user.id ? (
                      <Link
                        href={`/dashboard/users/${r.user.id}`}
                        className="mt-2 inline-block text-sm text-[var(--accent)] underline-offset-2 hover:underline"
                      >
                        Open account
                      </Link>
                    ) : null}
                  </div>
                  <select
                    className="admin-input w-auto min-w-40"
                    value={r.status}
                    onChange={(e) => setStatus(r.id, e.target.value as Ticket["status"])}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-[var(--ink-soft)] whitespace-pre-wrap">{r.message}</p>
              </div>
            ))}
          </div>
        )}
      </PageSection>
    </AdminShell>
  );
}
