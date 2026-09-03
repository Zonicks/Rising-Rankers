import { ist } from "../users/user-display";

export function roleLabel(role?: string | null) {
  if (!role) return "System";
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function entityLabel(type?: string | null) {
  if (!type) return "—";
  if (type === "LiveTest") return "Live test";
  if (type === "AuditLog") return "Audit log";
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function formatMeta(meta: unknown) {
  if (meta == null) return null;
  if (typeof meta === "string") return meta;
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

export function entityHref(entityType?: string | null, entityId?: string | null) {
  if (!entityId) return null;
  if (entityType === "User") return `/dashboard/users/${entityId}`;
  if (entityType === "LiveTest") return `/dashboard/tests`;
  if (entityType === "Withdrawal") return `/dashboard/withdrawals`;
  return null;
}

export function recordLabel(opts: {
  entityType?: string | null;
  entityId?: string | null;
  subject?: { emailMasked?: string | null; fullName?: string | null } | null;
}) {
  const type = entityLabel(opts.entityType);
  if (opts.subject?.emailMasked) {
    return opts.subject.fullName
      ? `${type} · ${opts.subject.fullName} · ${opts.subject.emailMasked}`
      : `${type} · ${opts.subject.emailMasked}`;
  }
  if (opts.entityId && opts.entityId.length > 12) return `${type} · ${opts.entityId.slice(0, 8)}…`;
  if (opts.entityId) return `${type} · ${opts.entityId}`;
  return type;
}

export { ist };
