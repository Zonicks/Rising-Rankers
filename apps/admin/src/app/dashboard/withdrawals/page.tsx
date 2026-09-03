"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, PageSection } from "@/components/admin-shell";
import { adminTokenKey, api } from "@/lib/api";

type Row = {
  id: string;
  amount: string;
  status: string;
  destination: string;
  user: { email: string; fullName: string | null };
};

export default function AdminWithdrawalsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load(token: string) {
    setRows(await api<Row[]>("/api/v1/admin/withdrawals", { token }));
  }

  useEffect(() => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return router.replace("/signin");
    load(token).catch(() => router.replace("/signin"));
  }, [router]);

  async function review(id: string, action: "APPROVE" | "REJECT") {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    await api(`/api/v1/admin/withdrawals/${id}/review`, {
      method: "POST",
      token,
      body: JSON.stringify({
        action,
        rejectReason: action === "REJECT" ? "Rejected by finance" : undefined,
      }),
    });
    setMsg(`${action} · ${id.slice(0, 8)}…`);
    await load(token);
  }

  return (
    <AdminShell
      title="Withdrawals"
      subtitle="Review award payouts before money leaves the platform."
    >
      {msg ? <p className="msg-ok mb-6">{msg}</p> : null}

      <PageSection title="Requests">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No withdrawal requests.</p>
        ) : (
          <div className="row-list">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold metric">
                    ₹{r.amount}{" "}
                    <span
                      className={`chip ml-2 ${
                        r.status === "PENDING"
                          ? "chip-accent"
                          : r.status === "APPROVED"
                            ? "chip-success"
                            : "chip-danger"
                      }`}
                    >
                      {r.status}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {r.user.fullName ?? r.user.email} · {r.destination}
                  </p>
                </div>
                {r.status === "PENDING" ? (
                  <div className="flex gap-2">
                    <button onClick={() => review(r.id, "APPROVE")} className="btn-primary btn-sm">
                      Approve
                    </button>
                    <button onClick={() => review(r.id, "REJECT")} className="btn-danger btn-sm">
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </PageSection>
    </AdminShell>
  );
}
