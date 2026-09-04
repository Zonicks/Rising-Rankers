"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminDialog, AdminShell, PageSection } from "@/components/admin-shell";
import { SkeletonRegion, SkeletonTable } from "@/components/skeleton";
import { adminTokenKey, api } from "@/lib/api";
import { entityHref, entityLabel, formatMeta, ist, recordLabel, roleLabel } from "./audit-display";

type Actor = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
};

type Subject = {
  id: string;
  emailMasked: string;
  fullName: string | null;
  role: string;
};

type Log = {
  id: string;
  action: string;
  title: string;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  meta: unknown;
  createdAt: string;
  actor: Actor | null;
  subject: Subject | null;
};

type ListResponse = {
  items: Log[];
  nextCursor: string | null;
  total: number;
  actions: { value: string; label: string }[];
  entityTypes: string[];
  actors: Actor[];
  canExport: boolean;
};

const emptyFilters = {
  q: "",
  action: "",
  entityType: "",
  entityId: "",
  actorId: "",
  from: "",
  to: "",
};

export default function AuditLogsPage() {
  const router = useRouter();
  const [draft, setDraft] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [items, setItems] = useState<Log[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<{ value: string; label: string }[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [canExport, setCanExport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Log | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPurpose, setExportPurpose] = useState<
    "support_case" | "law_enforcement" | "user_request" | "fraud_review"
  >("support_case");
  const [exportReason, setExportReason] = useState("");
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [exportBusy, setExportBusy] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (applied.q) params.set("q", applied.q);
    if (applied.action) params.set("action", applied.action);
    if (applied.entityType) params.set("entityType", applied.entityType);
    if (applied.entityId) params.set("entityId", applied.entityId);
    if (applied.actorId) params.set("actorId", applied.actorId);
    if (applied.from) params.set("from", applied.from);
    if (applied.to) params.set("to", applied.to);
    return params.toString();
  }, [applied]);

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
        const params = new URLSearchParams(queryString);
        if (cursor) params.set("cursor", cursor);
        const data = await api<ListResponse>(`/api/v1/admin/audit-logs?${params}`, { token });
        setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
        setNextCursor(data.nextCursor);
        setTotal(data.total);
        setActions(data.actions);
        setEntityTypes(data.entityTypes);
        setActors(data.actors);
        setCanExport(data.canExport);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load audit logs");
      } finally {
        setLoading(false);
      }
    },
    [queryString, router]
  );

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters(next = draft) {
    setApplied({
      ...next,
      q: next.q.trim(),
      entityId: next.entityId.trim(),
    });
  }

  function clearFilters() {
    setDraft(emptyFilters);
    setApplied(emptyFilters);
  }

  const selectedLink = selected ? entityHref(selected.entityType, selected.entityId) : null;
  const selectedMeta = selected ? formatMeta(selected.meta) : null;
  const activeFilterCount = Object.values(applied).filter(Boolean).length;

  return (
    <AdminShell
      title="Audit logs"
      subtitle="Every staff action with who, when, and the stored details. Click a row for the full record."
    >
      {error ? <p className="msg-err mb-4">{error}</p> : null}

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {canExport ? (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setExportOpen(true)}>
            Export
          </button>
        ) : null}
      </div>

      <form
        className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
      >
        <div className="xl:col-span-2">
          <label className="admin-label">Search</label>
          <input
            className="admin-input"
            placeholder="Student email, staff email, name, action, or IP"
            value={draft.q}
            onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
          />
        </div>
        <div>
          <label className="admin-label">Action</label>
          <select
            className="admin-input"
            value={draft.action}
            onChange={(e) => setDraft((prev) => ({ ...prev, action: e.target.value }))}
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="admin-label">Record type</label>
          <select
            className="admin-input"
            value={draft.entityType}
            onChange={(e) => setDraft((prev) => ({ ...prev, entityType: e.target.value }))}
          >
            <option value="">All types</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {entityLabel(type)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="admin-label">Actor</label>
          <select
            className="admin-input"
            value={draft.actorId}
            onChange={(e) => setDraft((prev) => ({ ...prev, actorId: e.target.value }))}
          >
            <option value="">Anyone</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.fullName || actor.email} · {roleLabel(actor.role)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="admin-label">Record id</label>
          <input
            className="admin-input"
            placeholder="User, test, or withdrawal id"
            value={draft.entityId}
            onChange={(e) => setDraft((prev) => ({ ...prev, entityId: e.target.value }))}
          />
        </div>
        <div>
          <label className="admin-label">From (IST)</label>
          <input
            type="date"
            className="admin-input"
            value={draft.from}
            onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
          />
        </div>
        <div>
          <label className="admin-label">To (IST)</label>
          <input
            type="date"
            className="admin-input"
            value={draft.to}
            onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
          />
        </div>
        <div className="flex items-end gap-2 xl:col-span-4">
          <button type="submit" className="btn-primary btn-sm">
            Apply filters
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </form>

      <PageSection title={activeFilterCount ? `Matching logs · ${total}` : `History · ${total}`}>
        {loading && items.length === 0 ? (
          <SkeletonRegion>
            <SkeletonTable cols={5} rows={8} />
          </SkeletonRegion>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No audit entries match these filters.</p>
        ) : (
          <div className="row-list">
            {items.map((log) => (
              <button
                key={log.id}
                type="button"
                className="-mx-2 w-full cursor-pointer appearance-none rounded-2xl border-0 bg-transparent px-2 py-4 text-left font-[inherit] text-[var(--ink)] transition-colors hover:bg-[var(--accent-soft)]"
                onClick={() => setSelected(log)}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{log.title || log.action}</p>
                  <p className="text-xs text-[var(--muted)]">{ist(log.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  {log.actor?.fullName || log.actor?.email || "System"}
                  {log.actor?.role ? ` · ${roleLabel(log.actor.role)}` : ""}
                  {log.entityType
                    ? ` · ${recordLabel({
                        entityType: log.entityType,
                        entityId: log.entityId,
                        subject: log.subject,
                      })}`
                    : ""}
                  {log.ip ? ` · ${log.ip}` : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--accent)]">Open full details</p>
              </button>
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

      {selected ? (
        <AdminDialog title={selected.title || selected.action} onClose={() => setSelected(null)} wide>
          <div className="space-y-4 text-sm">
            <p className="text-[var(--muted)]">{selected.action}</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">When (IST)</dt>
                <dd className="mt-1 font-medium">{ist(selected.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Actor</dt>
                <dd className="mt-1 font-medium">
                  {selected.actor?.fullName || selected.actor?.email || "System"}
                  {selected.actor?.role ? ` · ${roleLabel(selected.actor.role)}` : ""}
                </dd>
                {selected.actor?.email ? (
                  <dd className="mt-0.5 text-[var(--ink-soft)]">{selected.actor.email}</dd>
                ) : null}
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">IP</dt>
                <dd className="mt-1 font-medium">{selected.ip || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Record</dt>
                <dd className="mt-1 font-medium">{entityLabel(selected.entityType)}</dd>
                {selected.subject?.emailMasked ? (
                  <dd className="mt-0.5 text-[var(--ink-soft)]">
                    {selected.subject.fullName ? `${selected.subject.fullName} · ` : ""}
                    {selected.subject.emailMasked}
                  </dd>
                ) : null}
                {selected.entityId ? (
                  <dd className="mt-0.5 break-all text-xs text-[var(--muted)]">{selected.entityId}</dd>
                ) : null}
              </div>
            </dl>
            {selectedLink ? (
              <Link href={selectedLink} className="btn-secondary btn-sm inline-flex">
                Open related record
              </Link>
            ) : null}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Stored details</p>
              {selectedMeta ? (
                <pre className="mt-2 overflow-x-auto rounded-2xl bg-[var(--bg)] p-4 text-xs leading-5 text-[var(--ink-soft)]">
                  {selectedMeta}
                </pre>
              ) : (
                <p className="mt-2 text-[var(--ink-soft)]">No extra details were stored with this action.</p>
              )}
            </div>
          </div>
        </AdminDialog>
      ) : null}

      {exportOpen ? (
        <AdminDialog title="Export audit logs" onClose={() => !exportBusy && setExportOpen(false)}>
          <form
            className="space-y-4"
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              const token = localStorage.getItem(adminTokenKey);
              if (!token) return;
              setExportBusy(true);
              setError(null);
              try {
                const data = await api<{
                  filename: string;
                  csv?: string;
                  json?: string;
                  count: number;
                  capped: boolean;
                }>("/api/v1/admin/audit-logs/export", {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    purpose: exportPurpose,
                    reason: exportReason,
                    format: exportFormat,
                    q: applied.q || undefined,
                    action: applied.action || undefined,
                    entityType: applied.entityType || undefined,
                    entityId: applied.entityId || undefined,
                    actorId: applied.actorId || undefined,
                    from: applied.from || undefined,
                    to: applied.to || undefined,
                  }),
                });
                const content = exportFormat === "json" ? data.json ?? "[]" : data.csv ?? "";
                const blob = new Blob([content], {
                  type: exportFormat === "json" ? "application/json" : "text/csv",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = data.filename;
                a.click();
                URL.revokeObjectURL(url);
                setExportOpen(false);
                setExportReason("");
                if (data.capped) {
                  setError(`Export capped at ${data.count} rows. Narrow the date range or filters.`);
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "Export failed");
              } finally {
                setExportBusy(false);
              }
            }}
          >
            <p className="text-sm text-[var(--ink-soft)]">
              Uses the filters currently applied, including date range. Super-admin and finance only.
              Purpose is logged. Maximum 2,000 rows.
            </p>
            {activeFilterCount ? (
              <p className="text-xs text-[var(--muted)]">
                {applied.from || applied.to
                  ? `Dates ${applied.from || "…"} to ${applied.to || "…"}. `
                  : ""}
                {applied.action ? `Action filtered. ` : ""}
                {applied.actorId ? `Actor filtered. ` : ""}
                {applied.q ? `Search “${applied.q}”.` : ""}
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">No filters applied — latest 2,000 matching rows.</p>
            )}
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
            <div>
              <label className="admin-label">Format</label>
              <select
                className="admin-input"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as "csv" | "json")}
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
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
              {exportBusy ? "Preparing…" : `Download ${exportFormat.toUpperCase()}`}
            </button>
          </form>
        </AdminDialog>
      ) : null}
    </AdminShell>
  );
}
