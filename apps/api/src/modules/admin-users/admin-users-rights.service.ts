import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { UserRole } from "@learning/shared-types";
import type {
  AdminRightsCreateInput,
  AdminRightsEraseInput,
  AdminRightsExportInput,
  AdminUserCorrectInput,
} from "@learning/shared-validation";
import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";
import { auditService } from "../audit/audit.service";
import { userRepository } from "../users/user.repository";
import { permissionsFor, yearsOld } from "./admin-users.policy";

const DAY = 24 * 60 * 60 * 1000;
const ERASE_HOLD_MS = 48 * 60 * 60 * 1000;
const GRIEVANCE_MS = 90 * DAY;

function toRightsRow(row: {
  id: string;
  type: string;
  status: string;
  purpose: string | null;
  reason: string;
  payload: unknown;
  dueAt: Date | null;
  holdUntil: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  actor: { fullName: string | null; email: string } | null;
}) {
  const open = row.status === "OPEN" || row.status === "IN_PROGRESS" || row.status === "HOLD";
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    purpose: row.purpose,
    reason: row.reason,
    payload: row.payload,
    dueAt: row.dueAt?.toISOString() ?? null,
    holdUntil: row.holdUntil?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    overdue: Boolean(open && row.dueAt && row.dueAt.getTime() < Date.now()),
    readyToErase: row.type === "ERASE" && row.status === "HOLD" && Boolean(row.holdUntil && row.holdUntil.getTime() <= Date.now()),
    actor: row.actor ? row.actor.fullName || row.actor.email : null,
  };
}

async function studentOrThrow(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { profile: true, wallet: true, nominee: true },
  });
  if (!user || user.role !== "STUDENT") throw new AppError("NOT_FOUND", "Student not found", 404);
  return user;
}

export class AdminUsersRightsService {
  async list(userId: string) {
    await studentOrThrow(userId);
    const rows = await prisma.dataRightsRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { actor: { select: { fullName: true, email: true } } },
    });
    return rows.map(toRightsRow);
  }

  async correct(
    id: string,
    input: AdminUserCorrectInput,
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    if (!permissionsFor(actor.role).canCorrect) {
      throw new AppError("FORBIDDEN", "You cannot correct this profile", 403);
    }
    const user = await studentOrThrow(id);
    const fullName =
      input.fullName ??
      ([input.firstName ?? user.firstName, input.lastName ?? user.lastName].filter(Boolean).join(" ") ||
        undefined);
    await userRepository.updateProfile(user.id, {
      fullName,
      firstName: input.firstName,
      lastName: input.lastName,
      mobile: input.mobile,
      city: input.city,
      state: input.state,
      classOrExam: input.classOrExam,
      parentGuardian: input.parentGuardian,
      dateOfBirth: input.dateOfBirth === undefined ? undefined : input.dateOfBirth ? new Date(input.dateOfBirth) : null,
    });
    const request = await prisma.dataRightsRequest.create({
      data: {
        userId: user.id,
        type: "CORRECT",
        status: "DONE",
        reason: input.reason,
        actorUserId: actor.id,
        closedAt: new Date(),
        payload: {
          firstName: input.firstName,
          lastName: input.lastName,
          fullName,
          mobile: input.mobile,
          city: input.city,
          state: input.state,
          classOrExam: input.classOrExam,
          parentGuardian: input.parentGuardian,
          dateOfBirth: input.dateOfBirth,
        },
      },
    });
    await auditService.log({
      actorUserId: actor.id,
      action: "USER_CORRECT",
      entityType: "User",
      entityId: user.id,
      ip,
      meta: { requestId: request.id, reason: input.reason },
    });
    return { id: request.id, status: request.status };
  }

  async create(
    id: string,
    input: AdminRightsCreateInput,
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    const perms = permissionsFor(actor.role);
    if (input.type === "ERASE" && !perms.canErase) {
      throw new AppError("FORBIDDEN", "Only a super-admin can start erasure", 403);
    }
    if (input.type !== "ERASE" && !perms.canRights && !(input.type === "ACCESS" && perms.canExportWallet)) {
      throw new AppError("FORBIDDEN", "You cannot start this request", 403);
    }
    const user = await studentOrThrow(id);
    const age = yearsOld(user.profile?.dateOfBirth ?? null);
    const under18 = age != null && age < 18;

    if (input.type === "ERASE") {
      if (under18 && !input.parentNote) {
        throw new AppError("PARENT_NOTE_REQUIRED", "Under-18 erasure needs a parent or guardian note", 400);
      }
      const holdUntil = new Date(Date.now() + ERASE_HOLD_MS);
      const request = await prisma.dataRightsRequest.create({
        data: {
          userId: user.id,
          type: "ERASE",
          status: "HOLD",
          reason: input.reason,
          actorUserId: actor.id,
          holdUntil,
          dueAt: holdUntil,
          payload: { parentNote: input.parentNote ?? null, notify: Boolean(input.notify) },
        },
      });
      if (user.status === "ACTIVE" || user.status === "KYC_PENDING") {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: "UNDER_REVIEW", disabledReason: "Erasure hold — 48 hour notice" },
        });
      }
      await auditService.log({
        actorUserId: actor.id,
        action: "USER_ERASE_HOLD",
        entityType: "DataRightsRequest",
        entityId: request.id,
        ip,
        meta: { userId: user.id, holdUntil: holdUntil.toISOString(), reason: input.reason },
      });
      return { id: request.id, status: request.status, holdUntil: holdUntil.toISOString() };
    }

    if (input.type === "CONSENT_WITHDRAW") {
      await userRepository.updateProfile(user.id, { consentAccepted: false });
      const request = await prisma.dataRightsRequest.create({
        data: {
          userId: user.id,
          type: "CONSENT_WITHDRAW",
          status: "DONE",
          reason: input.reason,
          actorUserId: actor.id,
          closedAt: new Date(),
        },
      });
      await auditService.log({
        actorUserId: actor.id,
        action: "USER_CONSENT_WITHDRAW",
        entityType: "User",
        entityId: user.id,
        ip,
        meta: { requestId: request.id, reason: input.reason },
      });
      return { id: request.id, status: request.status };
    }

    if (input.type === "NOMINATE") {
      if (!input.nominee?.name) throw new AppError("VALIDATION_ERROR", "Nominee name is required", 400);
      await prisma.userNominee.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          name: input.nominee.name,
          email: input.nominee.email || null,
          mobile: input.nominee.mobile || null,
          relation: input.nominee.relation || null,
        },
        update: {
          name: input.nominee.name,
          email: input.nominee.email || null,
          mobile: input.nominee.mobile || null,
          relation: input.nominee.relation || null,
        },
      });
      const request = await prisma.dataRightsRequest.create({
        data: {
          userId: user.id,
          type: "NOMINATE",
          status: "DONE",
          reason: input.reason,
          actorUserId: actor.id,
          closedAt: new Date(),
          payload: input.nominee,
        },
      });
      await auditService.log({
        actorUserId: actor.id,
        action: "USER_NOMINATE",
        entityType: "User",
        entityId: user.id,
        ip,
        meta: { requestId: request.id },
      });
      return { id: request.id, status: request.status };
    }

    if (input.type === "GRIEVANCE") {
      const dueAt = new Date(Date.now() + GRIEVANCE_MS);
      const ticket = await prisma.supportTicket.create({
        data: {
          userId: user.id,
          category: "Privacy",
          subject: "Privacy grievance",
          message: input.reason,
          messages: {
            create: { authorUserId: actor.id, body: input.reason, visibility: "INTERNAL" },
          },
        },
      });
      const request = await prisma.dataRightsRequest.create({
        data: {
          userId: user.id,
          type: "GRIEVANCE",
          status: "OPEN",
          reason: input.reason,
          actorUserId: actor.id,
          dueAt,
          payload: { ticketId: ticket.id },
        },
      });
      await auditService.log({
        actorUserId: actor.id,
        action: "USER_GRIEVANCE",
        entityType: "DataRightsRequest",
        entityId: request.id,
        ip,
        meta: { userId: user.id, ticketId: ticket.id },
      });
      return { id: request.id, status: request.status, dueAt: dueAt.toISOString(), ticketId: ticket.id };
    }

    const request = await prisma.dataRightsRequest.create({
      data: {
        userId: user.id,
        type: "ACCESS",
        status: "IN_PROGRESS",
        purpose: input.purpose ?? "user_request",
        reason: input.reason,
        actorUserId: actor.id,
        dueAt: new Date(Date.now() + 30 * DAY),
      },
    });
    await auditService.log({
      actorUserId: actor.id,
      action: "USER_ACCESS_REQUEST",
      entityType: "DataRightsRequest",
      entityId: request.id,
      ip,
      meta: { userId: user.id, purpose: request.purpose },
    });
    return { id: request.id, status: request.status };
  }

  async exportPack(
    userId: string,
    requestId: string,
    input: AdminRightsExportInput,
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    const perms = permissionsFor(actor.role);
    if (!perms.canExportWallet) throw new AppError("FORBIDDEN", "You cannot export this pack", 403);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        wallet: true,
        nominee: true,
        devices: { orderBy: { lastSeenAt: "desc" }, take: 20 },
        tickets: { orderBy: { createdAt: "desc" }, take: 30 },
        ledgerEntries: { orderBy: { createdAt: "desc" }, take: 20 },
        withdrawals: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!user || user.role !== "STUDENT") throw new AppError("NOT_FOUND", "Student not found", 404);
    const request = await prisma.dataRightsRequest.findUnique({ where: { id: requestId } });
    if (!request || request.userId !== userId) throw new AppError("NOT_FOUND", "Request not found", 404);

    const wallet = {
      deposited: user.wallet?.depositedBalance.toString() ?? "0",
      award: user.wallet?.awardBalance.toString() ?? "0",
      promo: user.wallet?.promoBalance.toString() ?? "0",
      recentLedger: user.ledgerEntries.map((e) => ({
        type: e.type,
        amount: e.amount.toString(),
        bucket: e.balanceBucket,
        createdAt: e.createdAt.toISOString(),
        reference: e.reference,
      })),
      withdrawals: user.withdrawals.map((w) => ({
        id: w.id,
        amount: w.amount.toString(),
        status: w.status,
        createdAt: w.createdAt.toISOString(),
      })),
    };

    const full = perms.canExport;
    const pack = full
      ? {
          generatedAt: new Date().toISOString(),
          purpose: input.purpose,
          userId: user.id,
          profile: {
            email: user.email,
            fullName: user.fullName,
            firstName: user.firstName,
            lastName: user.lastName,
            mobile: user.profile?.mobile ?? null,
            dateOfBirth: user.profile?.dateOfBirth?.toISOString() ?? null,
            city: user.profile?.city ?? null,
            state: user.profile?.state ?? null,
            classOrExam: user.profile?.classOrExam ?? null,
            parentGuardian: user.profile?.parentGuardian ?? null,
            consentAccepted: user.profile?.consentAccepted ?? false,
            consentAt: user.profile?.consentAt?.toISOString() ?? null,
            createdAt: user.createdAt.toISOString(),
          },
          nominee: user.nominee
            ? {
                name: user.nominee.name,
                email: user.nominee.email,
                mobile: user.nominee.mobile,
                relation: user.nominee.relation,
              }
            : null,
          devices: user.devices.map((d) => ({
            deviceId: d.deviceId,
            platform: d.platform,
            lastSeenAt: d.lastSeenAt.toISOString(),
            lastIp: d.lastIp,
            revokedAt: d.revokedAt?.toISOString() ?? null,
          })),
          tickets: user.tickets.map((t) => ({
            category: t.category,
            subject: t.subject,
            status: t.status,
            createdAt: t.createdAt.toISOString(),
          })),
          wallet,
        }
      : {
          generatedAt: new Date().toISOString(),
          purpose: input.purpose,
          userId: user.id,
          slice: "wallet",
          wallet,
        };

    const html = full
      ? `<!doctype html><html><body><h1>Rising Rankers access pack</h1><p>${pack.generatedAt}</p><pre>${escapeHtml(JSON.stringify(pack, null, 2))}</pre></body></html>`
      : `<!doctype html><html><body><h1>Wallet slice</h1><pre>${escapeHtml(JSON.stringify(pack, null, 2))}</pre></body></html>`;

    await prisma.dataRightsRequest.update({
      where: { id: request.id },
      data: {
        status: request.type === "ACCESS" ? "DONE" : request.status,
        purpose: input.purpose,
        closedAt: request.type === "ACCESS" ? new Date() : request.closedAt,
        payload: { exportedAt: new Date().toISOString(), slice: full ? "full" : "wallet" },
      },
    });
    await auditService.log({
      actorUserId: actor.id,
      action: "USER_EXPORT",
      entityType: "User",
      entityId: user.id,
      ip,
      meta: { requestId: request.id, purpose: input.purpose, slice: full ? "full" : "wallet" },
    });
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `rising-rankers-access-${user.id}-${stamp}.json`,
      htmlFilename: `rising-rankers-access-${user.id}-${stamp}.html`,
      pack,
      html,
    };
  }

  async erase(
    userId: string,
    requestId: string,
    input: AdminRightsEraseInput,
    actor: { id: string; role: UserRole },
    ip?: string
  ) {
    if (!permissionsFor(actor.role).canErase) {
      throw new AppError("FORBIDDEN", "Only a super-admin can complete erasure", 403);
    }
    const user = await studentOrThrow(userId);
    const request = await prisma.dataRightsRequest.findUnique({ where: { id: requestId } });
    if (!request || request.userId !== userId || request.type !== "ERASE") {
      throw new AppError("NOT_FOUND", "Erasure request not found", 404);
    }
    if (request.status === "DONE") return { alreadyErased: true as const };
    if (!request.holdUntil || request.holdUntil.getTime() > Date.now()) {
      throw new AppError("ERASE_HOLD", "Wait 48 hours after notice before wiping the profile", 400);
    }
    const age = yearsOld(user.profile?.dateOfBirth ?? null);
    const parentNote =
      input.parentNote ||
      (request.payload && typeof request.payload === "object" && "parentNote" in request.payload
        ? String((request.payload as { parentNote?: string }).parentNote ?? "")
        : "");
    if (age != null && age < 18 && parentNote.trim().length < 10) {
      throw new AppError("PARENT_NOTE_REQUIRED", "Under-18 erasure needs a parent or guardian note", 400);
    }

    const tombstoneEmail = `erased+${user.id}@erased.local`;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: tombstoneEmail,
          fullName: "Erased user",
          firstName: null,
          lastName: null,
          passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10),
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          lastLoginIp: null,
          status: "BLOCKED",
          disabledAt: new Date(),
          disabledReason: "DPDP erasure",
          sessionVersion: { increment: 1 },
        },
      });
      await tx.userProfile.updateMany({
        where: { userId: user.id },
        data: {
          mobile: null,
          city: null,
          state: null,
          dateOfBirth: null,
          parentGuardian: null,
          classOrExam: null,
          consentAccepted: false,
          profileComplete: false,
        },
      });
      await tx.userNominee.deleteMany({ where: { userId: user.id } });
      await tx.deviceSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.dataRightsRequest.update({
        where: { id: request.id },
        data: {
          status: "DONE",
          closedAt: new Date(),
          reason: input.reason,
          payload: { erasedAt: new Date().toISOString(), parentNote: parentNote || null },
        },
      });
    });
    await auditService.log({
      actorUserId: actor.id,
      action: "USER_ERASE",
      entityType: "User",
      entityId: user.id,
      ip,
      meta: { requestId: request.id, reason: input.reason },
    });
    return { erased: true as const };
  }
}

function escapeHtml(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export const adminUsersRightsService = new AdminUsersRightsService();
