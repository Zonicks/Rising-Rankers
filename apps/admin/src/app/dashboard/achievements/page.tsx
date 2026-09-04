"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog, AdminShell, PageSection } from "@/components/admin-shell";
import { SkeletonRegion, SkeletonTable } from "@/components/skeleton";
import { adminTokenKey, api } from "@/lib/api";

type Program = {
  id: string;
  name: string;
  subjects: { id: string; name: string }[];
};

type Achievement = {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  tier: "GOLD" | "SILVER" | "BRONZE";
  criterion: string;
  threshold: number;
  pointsReward: number;
  programId: string | null;
  subjectId: string | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  program: { id: string; name: string } | null;
  subject: { id: string; name: string } | null;
  _count: { unlocks: number };
};

const CRITERIA = [
  { value: "STREAK_DAYS", label: "Streak days" },
  { value: "MCQ_ANSWERED", label: "MCQs answered" },
  { value: "FLASH_REVIEWED", label: "Flash cards reviewed" },
  { value: "TESTS_SUBMITTED", label: "Tests submitted" },
  { value: "SUBJECT_MASTERY", label: "Subject mastery %" },
  { value: "MODULES_COMPLETE", label: "Modules complete" },
  { value: "NEWS_READ", label: "News articles read" },
  { value: "POINTS_TOTAL", label: "Points total" },
] as const;

const emptyForm = {
  name: "",
  description: "",
  iconKey: "emoji_events",
  tier: "BRONZE" as "GOLD" | "SILVER" | "BRONZE",
  criterion: "STREAK_DAYS",
  threshold: 7,
  pointsReward: 25,
  programId: "",
  subjectId: "",
  status: "ACTIVE" as "DRAFT" | "ACTIVE" | "INACTIVE",
};

export default function AchievementsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Achievement[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const subjects = useMemo(() => {
    if (form.programId) {
      return programs.find((p) => p.id === form.programId)?.subjects ?? [];
    }
    return programs.flatMap((p) => p.subjects);
  }, [form.programId, programs]);

  const load = useCallback(async () => {
    const token = localStorage.getItem(adminTokenKey);
    if (!token) {
      router.replace("/signin");
      return;
    }
    const [list, programList] = await Promise.all([
      api<Achievement[]>("/api/v1/admin/achievements", { token }),
      api<Program[]>("/api/v1/admin/programs", { token }),
    ]);
    setRows(list);
    setPrograms(programList);
    setReady(true);
  }, [router]);

  useEffect(() => {
    load().catch(() => router.replace("/signin"));
  }, [load, router]);

  function startNew() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setMsg(null);
    setFormOpen(true);
  }

  function startEdit(row: Achievement) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      description: row.description,
      iconKey: row.iconKey,
      tier: row.tier,
      criterion: row.criterion,
      threshold: row.threshold,
      pointsReward: row.pointsReward,
      programId: row.programId ?? "",
      subjectId: row.subjectId ?? "",
      status: row.status,
    });
    setError(null);
    setMsg(null);
    setFormOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem(adminTokenKey);
    if (!token) return;
    setError(null);
    const payload = {
      name: form.name,
      description: form.description,
      iconKey: form.iconKey,
      tier: form.tier,
      criterion: form.criterion,
      threshold: Number(form.threshold),
      pointsReward: Number(form.pointsReward),
      programId: form.programId || null,
      subjectId: form.subjectId || null,
      status: form.status,
    };
    try {
      if (editingId) {
        await api(`/api/v1/admin/achievements/${editingId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
        setMsg(`Updated “${form.name}”`);
      } else {
        await api("/api/v1/admin/achievements", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        setMsg(`Created “${form.name}”`);
      }
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <AdminShell
      title="Achievements"
      subtitle="Badges unlock once when a student hits the criterion. Editing does not revoke existing unlocks."
    >
      {msg ? <p className="msg-ok mb-4">{msg}</p> : null}
      {error && !formOpen ? <p className="msg-err mb-4">{error}</p> : null}

      <PageSection
        title="Badges"
        action={
          <button type="button" className="btn-primary btn-sm" onClick={startNew}>
            New badge
          </button>
        }
      >
        {!ready ? (
          <SkeletonRegion>
            <SkeletonTable cols={4} rows={8} />
          </SkeletonRegion>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No achievements yet. Use <strong>New badge</strong> to create one.
          </p>
        ) : (
          <div className="row-list">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{row.name}</p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    <span className="chip chip-accent mr-2">{row.tier}</span>
                    {row.criterion.replaceAll("_", " ")} ≥ {row.threshold} · {row.pointsReward} pts ·{" "}
                    {row._count.unlocks} unlocked · {row.status}
                    {row.subject ? ` · ${row.subject.name}` : ""}
                  </p>
                </div>
                <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(row)}>
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      {formOpen ? (
        <AdminDialog title={editingId ? "Edit badge" : "New badge"} onClose={() => setFormOpen(false)} wide>
          {error ? <p className="msg-err mb-3">{error}</p> : null}
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="admin-label">Name</label>
              <input
                className="admin-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="admin-label">Description</label>
              <input
                className="admin-input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="admin-label">Tier</label>
                <select
                  className="admin-input"
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value as typeof form.tier })}
                >
                  <option value="GOLD">GOLD</option>
                  <option value="SILVER">SILVER</option>
                  <option value="BRONZE">BRONZE</option>
                </select>
              </div>
              <div>
                <label className="admin-label">Icon key</label>
                <input
                  className="admin-input"
                  list="icon-keys"
                  value={form.iconKey}
                  onChange={(e) => setForm({ ...form, iconKey: e.target.value })}
                />
                <datalist id="icon-keys">
                  <option value="emoji_events" />
                  <option value="local_fire_department" />
                  <option value="style" />
                  <option value="quiz" />
                  <option value="gavel" />
                </datalist>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="admin-label">Criterion</label>
                <select
                  className="admin-input"
                  value={form.criterion}
                  onChange={(e) => setForm({ ...form, criterion: e.target.value })}
                >
                  {CRITERIA.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="admin-label">Threshold</label>
                <input
                  type="number"
                  className="admin-input"
                  min={1}
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="admin-label">Points reward</label>
                <input
                  type="number"
                  className="admin-input"
                  min={0}
                  value={form.pointsReward}
                  onChange={(e) => setForm({ ...form, pointsReward: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="admin-label">Status</label>
                <select
                  className="admin-input"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="admin-label">Program (optional)</label>
                <select
                  className="admin-input"
                  value={form.programId}
                  onChange={(e) => setForm({ ...form, programId: e.target.value, subjectId: "" })}
                >
                  <option value="">Any</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="admin-label">Subject (for mastery)</label>
                <select
                  className="admin-input"
                  value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                >
                  <option value="">None</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn-primary">{editingId ? "Save badge" : "Create badge"}</button>
          </form>
        </AdminDialog>
      ) : null}
    </AdminShell>
  );
}
