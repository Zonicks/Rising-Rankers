"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, PageSection, StatCard } from "@/components/admin-shell";
import { SkeletonRegion, SkeletonStatGrid } from "@/components/skeleton";
import { adminTokenKey, api } from "@/lib/api";

const shortcuts = [
  { href: "/dashboard/syllabus", title: "Edit the syllabus tree", body: "Programs, subjects, topics, and chapters." },
  { href: "/dashboard/content", title: "Add questions", body: "MCQs and flash cards under a chapter." },
  { href: "/dashboard/news", title: "Publish current affairs", body: "Title, body, and a cover image." },
  { href: "/dashboard/achievements", title: "Configure badges", body: "Criterion, threshold, and points." },
  { href: "/dashboard/tests", title: "Schedule a live test", body: "Pick MCQs, fee, and start time." },
  { href: "/dashboard/finance", title: "Platform P&L", body: "Entry fees, awards, leftover pool, and unlock sales." },
  { href: "/dashboard/withdrawals", title: "Review payouts", body: "Approve or reject Award withdrawals." },
  { href: "/dashboard/users", title: "Manage students", body: "Find an account, suspend, block, or restore." },
];

export default function DashboardPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<{
    users: number;
    flashCards: number;
    mcqs: number;
    chapters?: number;
  } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return router.replace("/signin");
    api<{ users: number; flashCards: number; mcqs: number; chapters: number }>(
      "/api/v1/admin/reports/overview",
      { token }
    )
      .then(setCounts)
      .catch(() => router.replace("/signin"));
  }, [router]);

  return (
    <AdminShell
      title="Overview"
      subtitle="A quiet snapshot of platform volume — content, students, and what to do next."
    >
      {counts ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Chapters" value={counts.chapters} hint="Question banks" />
          <StatCard label="Students" value={counts.users} hint="Signed-up accounts" />
          <StatCard label="Flash cards" value={counts.flashCards} hint="Practice prompts" />
          <StatCard label="MCQs" value={counts.mcqs} hint="Ready for tests" />
        </div>
      ) : (
        <SkeletonRegion>
          <SkeletonStatGrid />
        </SkeletonRegion>
      )}

      <PageSection title="Suggested path">
        <div className="grid gap-3 sm:grid-cols-2">
          {shortcuts.map((item, i) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 transition-colors hover:border-transparent hover:bg-[var(--accent-soft)]"
            >
              <p className="text-xs font-semibold text-[var(--muted)]">0{i + 1}</p>
              <p className="mt-2 font-semibold group-hover:text-[var(--accent)]">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{item.body}</p>
            </Link>
          ))}
        </div>
      </PageSection>
    </AdminShell>
  );
}
