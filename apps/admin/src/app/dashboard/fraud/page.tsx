"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, PageSection } from "@/components/admin-shell";
import { SkeletonRegion, SkeletonTable } from "@/components/skeleton";
import { adminTokenKey, api } from "@/lib/api";

type Flag = {
  id: string;
  type: string;
  severity: string;
  testId: string | null;
  createdAt: string;
  resolved: boolean;
  user: { email: string; fullName: string | null };
};

export default function FraudFlagsPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return router.replace("/signin");
    api<Flag[]>("/api/v1/admin/fraud-flags", { token })
      .then((rows) => {
        setFlags(rows);
        setReady(true);
      })
      .catch(() => router.replace("/signin"));
  }, [router]);

  return (
    <AdminShell
      title="Fraud flags"
      subtitle="Speed anomalies, app switches, and device mismatches."
    >
      <PageSection title="Recent">
        {!ready ? (
          <SkeletonRegion>
            <SkeletonTable cols={4} rows={8} compact />
          </SkeletonRegion>
        ) : flags.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No flags yet.</p>
        ) : (
          <div className="row-list">
            {flags.map((f) => (
              <div key={f.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {f.type}{" "}
                    <span
                      className={`chip ml-1 ${
                        f.severity === "HIGH" ? "chip-danger" : "chip-accent"
                      }`}
                    >
                      {f.severity}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(f.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  {f.user.fullName ?? "—"} · {f.user.email}
                  {f.testId ? ` · test ${f.testId.slice(0, 8)}…` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </PageSection>
    </AdminShell>
  );
}
