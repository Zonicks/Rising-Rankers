import type { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";
import { maskEmail } from "../admin-users/admin-users.policy";

const LIST_TAKE_MAX = 100;
const EXPORT_MAX = 2000;

const ACTION_TITLES: Record<string, string> = {
  USER_REVEAL: "Revealed personal data",
  USER_SUSPEND: "Suspended account",
  USER_BLOCK: "Blocked account",
  USER_RESTORE: "Restored account",
  USER_RESTRICT_WITHDRAWALS: "Restricted withdrawals",
  USER_SESSION_REVOKE: "Revoked sessions",
  USER_PASSWORD_RESET: "Issued password reset",
  USER_BULK_EXPORT: "Exported user directory",
  USER_PARENTAL_CONSENT: "Recorded parental consent",
  USER_CORRECT: "Corrected profile",
  USER_ERASE_HOLD: "Started erasure hold",
  USER_CONSENT_WITHDRAW: "Withdrew consent",
  USER_NOMINATE: "Set nominee",
  USER_GRIEVANCE: "Logged privacy grievance",
  USER_ACCESS_REQUEST: "Started access request",
  USER_EXPORT: "Exported access pack",
  USER_ERASE: "Completed erasure",
  SUPPORT_TICKET_CREATE: "Opened support ticket",
  SUPPORT_TICKET_NOTE: "Added support note",
  STAFF_CREATE: "Created staff account",
  STAFF_UPDATE: "Updated staff account",
  INCIDENT_REVIEW: "Logged incident review",
  ADMIN_WALLET_CREDIT: "Credited wallet",
  RESULTS_DECLARED: "Declared live-test results",
  AWARDS_APPROVED: "Approved awards",
  WITHDRAWAL_APPROVE: "Approved withdrawal",
  WITHDRAWAL_REJECT: "Rejected withdrawal",
  AUDIT_EXPORT: "Exported audit logs",
};

export type AuditFilters = {
  q?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  from?: string;
  to?: string;
};

function actionTitle(action: string) {
  if (ACTION_TITLES[action]) return ACTION_TITLES[action];
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseDay(value?: string) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError("VALIDATION_ERROR", "Use dates as YYYY-MM-DD", 400);
  }
  const parsed = new Date(`${value}T00:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Invalid date", 400);
  }
  return value;
}

function startOfIstDay(date: string) {
  return new Date(`${date}T00:00:00+05:30`);
}

function endOfIstDay(date: string) {
  return new Date(`${date}T23:59:59.999+05:30`);
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const raw = Buffer.from(cursor, "base64url").toString("utf8");
  const [iso, id] = raw.split("|");
  if (!iso || !id) throw new AppError("VALIDATION_ERROR", "Invalid cursor", 400);
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime())) throw new AppError("VALIDATION_ERROR", "Invalid cursor", 400);
  return { createdAt, id };
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

type Subject = {
  id: string;
  emailMasked: string;
  fullName: string | null;
  role: string;
};

function toSubject(user: { id: string; email: string; fullName: string | null; role: string }): Subject {
  return {
    id: user.id,
    emailMasked: maskEmail(user.email),
    fullName: user.fullName,
    role: user.role,
  };
}

function toDto(
  row: {
    id: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    ip: string | null;
    meta: Prisma.JsonValue;
    createdAt: Date;
    actor: { id: string; email: string; fullName: string | null; role: string } | null;
  },
  subjects: Map<string, Subject>
) {
  const subject =
    row.entityType === "User" && row.entityId ? subjects.get(row.entityId) ?? null : null;
  return {
    id: row.id,
    action: row.action,
    title: actionTitle(row.action),
    entityType: row.entityType,
    entityId: row.entityId,
    ip: row.ip,
    meta: row.meta,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor,
    subject,
  };
}

function emailLookupWhere(q: string): Prisma.UserWhereInput {
  const trimmed = q.trim();
  if (trimmed.includes("*") && trimmed.includes("@")) {
    const [local, domain] = trimmed.split("@");
    const prefix = (local ?? "").replaceAll("*", "");
    return {
      AND: [
        ...(prefix ? [{ email: { startsWith: prefix, mode: "insensitive" as const } }] : []),
        { email: { endsWith: `@${domain}`, mode: "insensitive" as const } },
      ],
    };
  }
  return {
    OR: [
      { email: { contains: trimmed, mode: "insensitive" } },
      { fullName: { contains: trimmed, mode: "insensitive" } },
    ],
  };
}

async function findMatchingUserIds(q: string) {
  const users = await prisma.user.findMany({
    where: emailLookupWhere(q),
    select: { id: true },
    take: 80,
  });
  return users.map((u) => u.id);
}

async function loadSubjects(rows: { entityType: string | null; entityId: string | null }[]) {
  const ids = [
    ...new Set(
      rows
        .filter((row) => row.entityType === "User" && row.entityId && row.entityId.length > 8)
        .map((row) => row.entityId as string)
    ),
  ];
  if (!ids.length) return new Map<string, Subject>();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, fullName: true, role: true },
  });
  return new Map(users.map((u) => [u.id, toSubject(u)]));
}

async function filterWhere(input: AuditFilters): Promise<Prisma.AuditLogWhereInput> {
  const q = input.q?.trim();
  const from = parseDay(input.from);
  const to = parseDay(input.to);
  if (from && to && from > to) {
    throw new AppError("VALIDATION_ERROR", "From date must be on or before to date", 400);
  }
  const createdAt: Prisma.DateTimeFilter = {};
  if (from) createdAt.gte = startOfIstDay(from);
  if (to) createdAt.lte = endOfIstDay(to);
  const matchedUserIds = q ? await findMatchingUserIds(q) : [];
  return {
    ...(input.action ? { action: input.action } : {}),
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.actorId ? { actorUserId: input.actorId } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { entityType: { contains: q, mode: "insensitive" } },
            { entityId: { contains: q, mode: "insensitive" } },
            { ip: { contains: q, mode: "insensitive" } },
            { actor: { is: { email: { contains: q, mode: "insensitive" } } } },
            { actor: { is: { fullName: { contains: q, mode: "insensitive" } } } },
            ...(matchedUserIds.length
              ? [
                  { actorUserId: { in: matchedUserIds } },
                  { entityType: "User", entityId: { in: matchedUserIds } },
                ]
              : []),
          ],
        }
      : {}),
  };
}

const actorSelect = { id: true, email: true, fullName: true, role: true } as const;

export class AuditService {
  async log(input: {
    actorUserId?: string | null;
    action: string;
    entityType?: string;
    entityId?: string;
    ip?: string;
    meta?: unknown;
  }) {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ip: input.ip,
        meta: input.meta as object | undefined,
      },
    });
  }

  async list(input: AuditFilters & { cursor?: string; take?: number } = {}) {
    const take = Math.min(Math.max(input.take ?? 40, 1), LIST_TAKE_MAX);
    const where = await filterWhere(input);
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const [rows, total, actionGroups, typeGroups, actorGroups] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          AND: [
            where,
            cursor
              ? {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                }
              : {},
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: take + 1,
        include: { actor: { select: actorSelect } },
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({
        by: ["action"],
        _count: { action: true },
        orderBy: { _count: { action: "desc" } },
      }),
      prisma.auditLog.groupBy({
        by: ["entityType"],
        where: { entityType: { not: null } },
        _count: { entityType: true },
        orderBy: { _count: { entityType: "desc" } },
      }),
      prisma.auditLog.groupBy({
        by: ["actorUserId"],
        where: { actorUserId: { not: null } },
        _count: { actorUserId: true },
        orderBy: { _count: { actorUserId: "desc" } },
      }),
    ]);
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const actorIds = actorGroups.map((g) => g.actorUserId).filter((id): id is string => Boolean(id));
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: actorSelect,
        })
      : [];
    const last = page[page.length - 1];
    const subjects = await loadSubjects(page);
    return {
      items: page.map((row) => toDto(row, subjects)),
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
      total,
      actions: actionGroups.map((g) => ({ value: g.action, label: actionTitle(g.action) })),
      entityTypes: typeGroups.map((g) => g.entityType).filter((v): v is string => Boolean(v)),
      actors,
    };
  }

  async export(
    input: AuditFilters & { purpose: string; reason: string; format: "csv" | "json" },
    actor: { id: string },
    ip?: string
  ) {
    const where = await filterWhere(input);
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: EXPORT_MAX + 1,
      include: { actor: { select: actorSelect } },
    });
    const capped = rows.length > EXPORT_MAX;
    const slice = capped ? rows.slice(0, EXPORT_MAX) : rows;
    const subjects = await loadSubjects(slice);
    const items = slice.map((row) => toDto(row, subjects));
    await this.log({
      actorUserId: actor.id,
      action: "AUDIT_EXPORT",
      entityType: "AuditLog",
      entityId: "export",
      ip,
      meta: {
        purpose: input.purpose,
        reason: input.reason,
        format: input.format,
        count: items.length,
        capped,
        q: input.q ?? null,
        action: input.action ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        actorId: input.actorId ?? null,
        from: input.from ?? null,
        to: input.to ?? null,
      },
    });
    const from = input.from ?? "all";
    const to = input.to ?? new Date().toISOString().slice(0, 10);
    const base = `rising-rankers-audit-${from}-to-${to}`;
    if (input.format === "json") {
      return {
        filename: `${base}.json`,
        json: JSON.stringify(items, null, 2),
        count: items.length,
        capped,
      };
    }
    const header = [
      "id",
      "createdAt",
      "action",
      "title",
      "actorId",
      "actorEmail",
      "actorName",
      "actorRole",
      "entityType",
      "entityId",
      "subjectEmailMasked",
      "subjectName",
      "ip",
      "meta",
    ];
    const csv = [
      header.join(","),
      ...items.map((row) =>
        [
          row.id,
          row.createdAt,
          row.action,
          row.title,
          row.actor?.id ?? "",
          row.actor?.email ?? "",
          row.actor?.fullName ?? "",
          row.actor?.role ?? "",
          row.entityType ?? "",
          row.entityId ?? "",
          row.subject?.emailMasked ?? "",
          row.subject?.fullName ?? "",
          row.ip ?? "",
          row.meta == null ? "" : JSON.stringify(row.meta),
        ]
          .map(csvCell)
          .join(",")
      ),
    ].join("\n");
    return { filename: `${base}.csv`, csv, count: items.length, capped };
  }
}

export const auditService = new AuditService();
