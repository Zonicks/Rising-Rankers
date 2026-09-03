"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, PageSection, StatCard } from "@/components/admin-shell";
import { adminTokenKey, api } from "@/lib/api";

type TestRow = {
  id: string;
  title: string;
  status: string;
  joined: number;
  collected: string;
  refunded: string;
  platformFee: string;
  awardsPaid: string;
  awardsPending: string;
  subsidy: string;
  realized: string;
  committed: string;
};

type Finance = {
  contest: {
    entryFees: string;
    refunds: string;
    awardsPaid: string;
    awardsPending: string;
    platformFee: string;
    subsidy: string;
    realized: string;
    committed: string;
  };
  other: { unlocks: string; deposits: string };
  combined: { realized: string; committed: string };
  wallets: { deposited: string; award: string; promo: string };
  withdrawals: { pending: string; approved: string; rejected: string };
  tests: TestRow[];
};

function rupee(n: string | number) {
  const v = typeof n === "number" ? n : Number(n);
  const sign = v < 0 ? "−" : "";
  return `${sign}₹${Math.abs(v).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function tone(n: string) {
  const v = Number(n);
  if (v > 0.004) return "text-[var(--success)]";
  if (v < -0.004) return "text-[var(--danger)]";
  return "text-[var(--ink)]";
}

function label(n: string) {
  const v = Number(n);
  if (v > 0.004) return "Profit";
  if (v < -0.004) return "Loss";
  return "Break-even";
}

export default function AdminFinancePage() {
  const router = useRouter();
  const [data, setData] = useState<Finance | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return router.replace("/signin");
    api<Finance>("/api/v1/admin/finance", { token })
      .then(setData)
      .catch(() => router.replace("/signin"));
  }, [router]);

  return (
    <AdminShell
      title="Platform P&L"
      subtitle="Contest fees versus awards, plus unlock sales. Deposits are student balances, not profit."
    >
      <section className="panel overflow-hidden p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Realized contest result
        </p>
        <p className={`metric mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl ${tone(data?.contest.realized ?? "0")}`}>
          {data ? rupee(data.contest.realized) : "—"}
        </p>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          {data ? label(data.contest.realized) : "Loading"} · entry fees collected minus awards already credited.
          Pending awards would move this to{" "}
          <strong className={tone(data?.contest.committed ?? "0")}>
            {data ? rupee(data.contest.committed) : "—"}
          </strong>
          .
        </p>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entry fees in" value={data ? rupee(data.contest.entryFees) : undefined} hint="Joined, not refunded" />
        <StatCard label="Awards paid" value={data ? rupee(data.contest.awardsPaid) : undefined} hint="Credited to Award wallets" />
        <StatCard
          label="Awards pending"
          value={data ? rupee(data.contest.awardsPending) : undefined}
          hint="Declared, not yet approved"
        />
        <StatCard
          label="Estimated subsidy"
          value={data ? rupee(data.contest.subsidy) : undefined}
          hint="Awards above collected fees"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Platform fee slice"
          value={data ? rupee(data.contest.platformFee) : undefined}
          hint="Fee % of collected entry fees"
        />
        <StatCard label="Unlock sales" value={data ? rupee(data.other.unlocks) : undefined} hint="Flash, MCQ, and book unlocks" />
        <StatCard
          label="All-in realized"
          value={data ? <span className={tone(data.combined.realized)}>{rupee(data.combined.realized)}</span> : undefined}
          hint="Contest result + unlocks"
        />
        <StatCard label="Test refunds" value={data ? rupee(data.contest.refunds) : undefined} hint="Cancelled tests returned" />
      </div>

      <PageSection title="Balances that are not profit">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Student deposits" value={data ? rupee(data.wallets.deposited) : undefined} hint="Still in wallets" />
          <StatCard label="Award wallets" value={data ? rupee(data.wallets.award) : undefined} hint="Won, not yet withdrawn" />
          <StatCard label="Promo wallets" value={data ? rupee(data.wallets.promo) : undefined} hint="House credit outstanding" />
          <StatCard
            label="Withdrawals pending"
            value={data ? rupee(data.withdrawals.pending) : undefined}
            hint={`Approved / paid ${data ? rupee(data.withdrawals.approved) : "—"}`}
          />
        </div>
        <p className="mt-4 text-sm text-[var(--ink-soft)]">
          Sandbox deposits are not revenue. Awards paid already count as a contest cost; a later withdrawal is the
          same rupees leaving the Award wallet, not a second loss.
        </p>
      </PageSection>

      <PageSection title="By live test">
        {!data || data.tests.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No live tests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="pb-3 pr-4 font-semibold">Test</th>
                  <th className="pb-3 pr-4 font-semibold">Joined</th>
                  <th className="pb-3 pr-4 font-semibold">Fees in</th>
                  <th className="pb-3 pr-4 font-semibold">Awards paid</th>
                  <th className="pb-3 pr-4 font-semibold">Pending</th>
                  <th className="pb-3 pr-4 font-semibold">Subsidy</th>
                  <th className="pb-3 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {data.tests.map((t) => (
                  <tr key={t.id} className="border-t border-[var(--line)]">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[var(--ink)]">{t.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                        {t.status}
                        {Number(t.refunded) > 0 ? ` · refunded ${rupee(t.refunded)}` : ""}
                        {Number(t.platformFee) > 0 ? ` · fee slice ${rupee(t.platformFee)}` : ""}
                      </p>
                    </td>
                    <td className="py-3 pr-4 metric">{t.joined}</td>
                    <td className="py-3 pr-4 metric">{rupee(t.collected)}</td>
                    <td className="py-3 pr-4 metric">{rupee(t.awardsPaid)}</td>
                    <td className="py-3 pr-4 metric">{rupee(t.awardsPending)}</td>
                    <td className="py-3 pr-4 metric">{rupee(t.subsidy)}</td>
                    <td className={`py-3 metric font-semibold ${tone(t.realized)}`}>
                      {rupee(t.realized)}
                      <span className="mt-0.5 block text-xs font-medium text-[var(--ink-soft)]">
                        {label(t.realized)}
                        {Number(t.awardsPending) > 0 ? ` · after approve ${rupee(t.committed)}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </AdminShell>
  );
}
