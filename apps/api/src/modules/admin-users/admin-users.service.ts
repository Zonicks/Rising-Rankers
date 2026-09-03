import type { AccountStatus, UserRole } from "@learning/shared-types";
import type { AdminTicketNoteInput, AdminUserTicketInput } from "@learning/shared-validation";
import { env } from "../../config/env";
import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";
import { auditService } from "../audit/audit.service";
import { recordAuthEvent } from "../auth/auth-event.service";
import { hashResetToken, newResetToken } from "../auth/password-reset";
import {
  canSetStatus,
  maskEmail,
  maskIp,
  maskMobile,
  permissionsFor,
  yearsOld,
} from "./admin-users.policy";

const LIST_TAKE_MAX = 50;

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

function toListItem(user: {
  id: string;
  email: string;
  fullName: string | null;
  status: AccountStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  curriculum: { program: { name: string } } | null;
  _count: { tickets: number; fraudFlags: number };
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    emailMasked: maskEmail(user.email),
    status: user.status,
    programName: user.curriculum?.program.name ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    openTicketCount: user._count.tickets,
    flagCount: user._count.fraudFlags,
  };
}

export class AdminUsersService {
  async list(opts: { q?: string; status?: AccountStatus; cursor?: string; take?: number }) {
    const take = Math.min(Math.max(opts.take ?? 25, 1), LIST_TAKE_MAX);
    const q = opts.q?.trim();
    const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
    const rows = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        ...(opts.status ? { status: opts.status } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
        ...(q
          ? {
              OR: [
                { id: q },
                { email: { contains: q, mode: "insensitive" } },
                { fullName: { contains: q, mode: "insensitive" } },
                { profile: { mobile: { contains: q } } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      include: {
        curriculum: { include: { program: { select: { name: true } } } },
        _count: {
          select: {
            tickets: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
            fraudFlags: { where: { resolved: false } },
          },
        },
      },
    });
    const extra = rows.length > take;
    const page = extra ? rows.slice(0, take) : rows;
    const last = page[page.length - 1];
    return {
      items: page.map(toListItem),
      nextCursor: extra && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async get(id: string, actorRole: UserRole) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        wallet: true,
        curriculum: { include: { program: { select: { id: true, name: true, slug: true } } } },
        _count: {
          select: {
            tickets: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
            fraudFlags: { where: { resolved: false } },
            devices: true,
          },
        },
        accountActions: {
          orderBy: { createdAt: "desc" },
          take: 12,
          include: { actor: { select: { email: true, fullName: true, role: true } } },
        },
        devices: { orderBy: { lastSeenAt: "desc" }, take: 20 },
        authEvents: { orderBy: { occurredAt: "desc" }, take: 50 },
        tickets: {
          orderBy: { createdAt: "desc" },
          take: 30,
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              include: { author: { select: { fullName: true, email: true, role: true } } },
            },
          },
        },
        ledgerEntries: { orderBy: { createdAt: "desc" }, take: 8 },
        nominee: true,
        rightsRequests: {
          orderBy: { createdAt: "desc" },
          take: 40,
          include: { actor: { select: { fullName: true, email: true } } },
        },
      },
    });
    if (!user || user.role !== "STUDENT") throw new AppError("NOT_FOUND", "Student not found", 404);
    const age = yearsOld(user.profile?.dateOfBirth ?? null);
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentFailCount = user.authEvents.filter(
      (e) => !e.success && e.occurredAt.getTime() >= dayAgo
    ).length;
    return {
      id: user.id,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      emailMasked: maskEmail(user.email),
      status: user.status,
      disabledAt: user.disabledAt?.toISOString() ?? null,
      disabledReason: user.disabledReason,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      lastLoginIpMasked: maskIp(user.lastLoginIp),
      createdAt: user.createdAt.toISOString(),
      pointsBalance: user.pointsBalance,
      streakCount: user.streakCount,
      under18: age == null ? null : age < 18,
      profile: {
        mobileMasked: maskMobile(user.profile?.mobile),
        city: user.profile?.city ?? null,
        state: user.profile?.state ?? null,
        classOrExam: user.profile?.classOrExam ?? null,
        consentAccepted: user.profile?.consentAccepted ?? false,
        consentAt: user.profile?.consentAt?.toISOString() ?? null,
        parentGuardian: user.profile?.parentGuardian ?? null,
        parentalConsentStatus: user.profile?.parentalConsentStatus ?? "NONE",
        parentalConsentRef: user.profile?.parentalConsentRef ?? null,
        parentalConsentAt: user.profile?.parentalConsentAt?.toISOString() ?? null,
        profileComplete: user.profile?.profileComplete ?? false,
      },
      program: user.curriculum?.program ?? null,
      wallet: user.wallet
        ? {
            deposited: user.wallet.depositedBalance.toString(),
            award: user.wallet.awardBalance.toString(),
            promo: user.wallet.promoBalance.toString(),
          }
        : { deposited: "0", award: "0", promo: "0" },
      openTicketCount: user._count.tickets,
      flagCount: user._count.fraudFlags,
      deviceCount: user._count.devices,
      recentFailCount,
      devices: user.devices.map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        platform: d.platform,
        lastSeenAt: d.lastSeenAt.toISOString(),
        lastIpMasked: maskIp(d.lastIp),
        revokedAt: d.revokedAt?.toISOString() ?? null,
      })),
      authEvents: user.authEvents.map((e) => ({
        id: e.id,
        event: e.event,
        success: e.success,
        occurredAt: e.occurredAt.toISOString(),
        ipMasked: maskIp(e.ip),
        platform: e.platform,
        deviceId: e.deviceId,
        country: e.country,
        city: e.city,
      })),
      tickets: user.tickets.map((t) => {
        const firstAgentAt = t.messages[0]?.createdAt ?? null;
        const privacy = t.category === "Privacy";
        const firstDue = new Date(t.createdAt.getTime() + 24 * 60 * 60 * 1000);
        const closeDue = privacy
          ? new Date(t.createdAt.getTime() + 90 * 24 * 60 * 60 * 1000)
          : firstDue;
        const open = t.status === "OPEN" || t.status === "IN_PROGRESS";
        return {
          id: t.id,
          category: t.category,
          subject: t.subject,
          message: t.message,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
          dueAt: closeDue.toISOString(),
          overdue: privacy
            ? open && closeDue.getTime() < Date.now()
            : open && !firstAgentAt && firstDue.getTime() < Date.now(),
          firstReplyOverdue: open && !firstAgentAt && firstDue.getTime() < Date.now(),
          privacySla: privacy,
          messages: t.messages.map((m) => ({
            id: m.id,
            body: m.body,
            visibility: m.visibility,
            createdAt: m.createdAt.toISOString(),
            author: m.author.fullName || m.author.email,
          })),
        };
      }),
      nominee: user.nominee
        ? {
            name: user.nominee.name,
            email: user.nominee.email,
            mobile: user.nominee.mobile,
            relation: user.nominee.relation,
          }
        : null,
      rights: user.rightsRequests.map((r) => {
        const open = r.status === "OPEN" || r.status === "IN_PROGRESS" || r.status === "HOLD";
        return {
          id: r.id,
          type: r.type,
          status: r.status,
          purpose: r.purpose,
          reason: r.reason,
          dueAt: r.dueAt?.toISOString() ?? null,
          holdUntil: r.holdUntil?.toISOString() ?? null,
          closedAt: r.closedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          overdue: Boolean(open && r.dueAt && r.dueAt.getTime() < Date.now()),
          readyToErase:
            r.type === "ERASE" &&
            r.status === "HOLD" &&
            Boolean(r.holdUntil && r.holdUntil.getTime() <= Date.now()),
          actor: r.actor ? r.actor.fullName || r.actor.email : null,
        };
      }),
      ledger: user.ledgerEntries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount.toString(),
        bucket: e.balanceBucket,
        createdAt: e.createdAt.toISOString(),
        reference: e.reference,
      })),
      actions: user.accountActions.map((a) => ({
        id: a.id,
        fromStatus: a.fromStatus,
        toStatus: a.toStatus,
        action: a.action,
        reason: a.reason,
        notifyStudent: a.notifyStudent,
        createdAt: a.createdAt.toISOString(),
        actor: a.actor.fullName || a.actor.email,
      })),
      permissions: {
        ...permissionsFor(actorRole),
        canRestore:
          user.status !== "ACTIVE" &&
          (actorRole === "SUPER_ADMIN" ||
            actorRole === "SUPPORT_ADMIN" ||
            (actorRole === "FINANCE_ADMIN" && user.status === "WITHDRAWAL_RESTRICTED")),
      },
    };
  }

  async reveal(id: string, actor: { id: string; role: UserRole }, ip?: string) {
    if (!permissionsFor(actor.role).canReveal) {
      throw new AppError("FORBIDDEN", "You cannot reveal personal data", 403);
    }
    const user = await prisma.user.findUnique({
      where: { id },
      include: { profile: true, authEvents: { orderBy: { occurredAt: "desc" }, take: 50 } },
    });
    if (!user || user.role !== "STUDENT") throw new AppError("NOT_FOUND", "Student not found", 404);
    await auditService.log({
      actorUserId: actor.id,
      action: "USER_REVEAL",
      entityType: "User",
      entityId: user.id,
      ip,
    });
    const authEventIps: Record<string, string | null> = {};
    for (const e of user.authEvents) authEventIps[e.id] = e.ip;
    return {
      email: user.email,
      mobile: user.profile?.mobile ?? null,
      dateOfBirth: user.profile?.dateOfBirth?.toISOString() ?? null,
      lastLoginIp: user.lastLoginIp,
      authEventIps,
    };
  }

  async setStatus(
    id: string,
    input: { status: AccountStatus; reason: string; notify?: boolean },
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    if (id === actor.id) {
      throw new AppError("FORBIDDEN", "You cannot change your own account status", 403);
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "STUDENT") throw new AppError("NOT_FOUND", "Student not found", 404);
    const to = input.status;
    if (!canSetStatus(actor.role, user.status, to)) {
      throw new AppError("FORBIDDEN", "You do not have permission for this status change", 403);
    }
    if (user.status === to) {
      return { unchanged: true, status: user.status };
    }

    const disabled = to === "SUSPENDED" || to === "BLOCKED";
    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: to,
        disabledAt: disabled ? new Date() : null,
        disabledReason: disabled ? input.reason : to === "WITHDRAWAL_RESTRICTED" ? input.reason : null,
        ...(disabled ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
    if (disabled) {
      await prisma.deviceSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await recordAuthEvent({
        userId: user.id,
        emailAttempted: user.email,
        event: "SESSION_REVOKE",
        success: true,
        meta: { ip },
      });
    }
    const action =
      to === "ACTIVE"
        ? "USER_RESTORE"
        : to === "SUSPENDED"
          ? "USER_SUSPEND"
          : to === "BLOCKED"
            ? "USER_BLOCK"
            : "USER_RESTRICT_WITHDRAWALS";
    await prisma.accountAction.create({
      data: {
        userId: user.id,
        actorUserId: actor.id,
        fromStatus: user.status,
        toStatus: to,
        action,
        reason: input.reason,
        notifyStudent: Boolean(input.notify),
        ip,
      },
    });
    await auditService.log({
      actorUserId: actor.id,
      action,
      entityType: "User",
      entityId: user.id,
      ip,
      meta: { from: user.status, to, reason: input.reason, notify: Boolean(input.notify) },
    });
    return { unchanged: false, status: updated.status };
  }

  async revokeSessions(
    id: string,
    input: { deviceId?: string; reason: string },
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    if (!permissionsFor(actor.role).canRevokeSessions) {
      throw new AppError("FORBIDDEN", "You cannot revoke sessions", 403);
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "STUDENT") throw new AppError("NOT_FOUND", "Student not found", 404);
    if (input.deviceId) {
      const device = await prisma.deviceSession.findUnique({
        where: { userId_deviceId: { userId: user.id, deviceId: input.deviceId } },
      });
      if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
      await prisma.deviceSession.update({
        where: { id: device.id },
        data: { revokedAt: new Date() },
      });
    } else {
      await prisma.deviceSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });
    await recordAuthEvent({
      userId: user.id,
      emailAttempted: user.email,
      event: "SESSION_REVOKE",
      success: true,
      meta: { ip, deviceId: input.deviceId },
    });
    await auditService.log({
      actorUserId: actor.id,
      action: "USER_SESSION_REVOKE",
      entityType: "User",
      entityId: user.id,
      ip,
      meta: { deviceId: input.deviceId ?? null, reason: input.reason },
    });
    return { revoked: true, scope: input.deviceId ? "device" : "all" };
  }

  async createTicket(
    id: string,
    input: AdminUserTicketInput,
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    if (!permissionsFor(actor.role).canSupport) {
      throw new AppError("FORBIDDEN", "You cannot create tickets", 403);
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "STUDENT") throw new AppError("NOT_FOUND", "Student not found", 404);
    const visibility = input.visibility ?? "INTERNAL";
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        category: input.category,
        subject: input.subject,
        message: input.message,
        messages: {
          create: {
            authorUserId: actor.id,
            body: input.message,
            visibility,
          },
        },
      },
    });
    await auditService.log({
      actorUserId: actor.id,
      action: "SUPPORT_TICKET_CREATE",
      entityType: "SupportTicket",
      entityId: ticket.id,
      ip,
      meta: { userId: user.id, category: input.category, visibility },
    });
    return { id: ticket.id, status: ticket.status };
  }

  async addTicketNote(
    userId: string,
    ticketId: string,
    input: AdminTicketNoteInput,
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    if (!permissionsFor(actor.role).canSupport) {
      throw new AppError("FORBIDDEN", "You cannot add notes", 403);
    }
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.userId !== userId) throw new AppError("NOT_FOUND", "Ticket not found", 404);
    const visibility = input.visibility ?? "INTERNAL";
    const note = await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorUserId: actor.id,
        body: input.body,
        visibility,
      },
    });
    if (ticket.status === "OPEN") {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "IN_PROGRESS" },
      });
    }
    await auditService.log({
      actorUserId: actor.id,
      action: "SUPPORT_TICKET_NOTE",
      entityType: "SupportTicket",
      entityId: ticket.id,
      ip,
      meta: { userId, visibility },
    });
    return { id: note.id };
  }

  async issuePasswordReset(
    id: string,
    input: { reason: string },
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    if (!permissionsFor(actor.role).canResetPassword) {
      throw new AppError("FORBIDDEN", "You cannot send a password reset", 403);
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "STUDENT") throw new AppError("NOT_FOUND", "Student not found", 404);
    const token = newResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashResetToken(token),
        passwordResetExpiresAt: expiresAt,
      },
    });
    await recordAuthEvent({
      userId: user.id,
      emailAttempted: user.email,
      event: "RESET_REQUEST",
      success: true,
      meta: { ip },
    });
    await auditService.log({
      actorUserId: actor.id,
      action: "USER_PASSWORD_RESET",
      entityType: "User",
      entityId: user.id,
      ip,
      meta: { reason: input.reason },
    });
    const origin = env.WEB_APP_URL.replace(/\/$/, "");
    return {
      resetUrl: `${origin}/auth/reset?token=${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async exportDirectory(
    input: { purpose: string; reason: string; q?: string; status?: AccountStatus },
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    if (actor.role !== "SUPER_ADMIN") {
      throw new AppError("FORBIDDEN", "Only a super-admin can export the directory", 403);
    }
    const q = input.q?.trim();
    const rows = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        ...(input.status ? { status: input.status } : {}),
        ...(q
          ? {
              OR: [
                { id: q },
                { email: { contains: q, mode: "insensitive" } },
                { fullName: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { curriculum: { include: { program: { select: { name: true } } } } },
    });
    const items = rows.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      emailMasked: maskEmail(u.email),
      status: u.status,
      programName: u.curriculum?.program.name ?? null,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    }));
    await auditService.log({
      actorUserId: actor.id,
      action: "USER_BULK_EXPORT",
      entityType: "User",
      entityId: "directory",
      ip,
      meta: { purpose: input.purpose, reason: input.reason, count: items.length, q: q ?? null },
    });
    const header = "id,fullName,emailMasked,status,programName,lastLoginAt,createdAt";
    const csv = [
      header,
      ...items.map((r) =>
        [r.id, r.fullName ?? "", r.emailMasked, r.status, r.programName ?? "", r.lastLoginAt ?? "", r.createdAt]
          .map((c) => `"${String(c).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n");
    return {
      filename: `rising-rankers-users-${new Date().toISOString().slice(0, 10)}.csv`,
      count: items.length,
      capped: rows.length === 200,
      csv,
    };
  }

  async recordParentalConsent(
    id: string,
    input: { method: "MANUAL" | "VENDOR_PENDING"; reference: string; note: string },
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    if (!permissionsFor(actor.role).canRights && actor.role !== "SUPER_ADMIN") {
      throw new AppError("FORBIDDEN", "You cannot record parental consent", 403);
    }
    const user = await prisma.user.findUnique({ where: { id }, include: { profile: true } });
    if (!user || user.role !== "STUDENT") throw new AppError("NOT_FOUND", "Student not found", 404);
    if (input.reference.replace(/\D/g, "").length === 12) {
      throw new AppError("FORBIDDEN", "Do not store Aadhaar or other government ID numbers", 400);
    }
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        parentalConsentStatus: input.method,
        parentalConsentRef: input.reference,
        parentalConsentAt: new Date(),
        parentalConsentNote: input.note,
      },
      update: {
        parentalConsentStatus: input.method,
        parentalConsentRef: input.reference,
        parentalConsentAt: new Date(),
        parentalConsentNote: input.note,
      },
    });
    await auditService.log({
      actorUserId: actor.id,
      action: "USER_PARENTAL_CONSENT",
      entityType: "User",
      entityId: user.id,
      ip,
      meta: { method: input.method, note: input.note },
    });
    return { status: input.method };
  }

  async logIncident(
    input: { kind: string; notes: string; certInWithin6h: boolean; usersWithin72h: boolean },
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    if (actor.role !== "SUPER_ADMIN") {
      throw new AppError("FORBIDDEN", "Only a super-admin can log an incident review", 403);
    }
    await auditService.log({
      actorUserId: actor.id,
      action: "INCIDENT_REVIEW",
      entityType: "Incident",
      entityId: input.kind,
      ip,
      meta: input,
    });
    return { logged: true as const };
  }
}

export const adminUsersService = new AdminUsersService();
