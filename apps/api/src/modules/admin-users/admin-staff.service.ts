import bcrypt from "bcryptjs";
import type { UserRole } from "@learning/shared-types";
import type { AdminStaffCreateInput, AdminStaffUpdateInput } from "@learning/shared-validation";
import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";
import { auditService } from "../audit/audit.service";

const STAFF_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "CONTENT_ADMIN",
  "TEST_ADMIN",
  "FINANCE_ADMIN",
  "SUPPORT_ADMIN",
  "READ_ONLY",
];

export class AdminStaffService {
  async list() {
    const rows = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        totpEnabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(input: AdminStaffCreateInput, actor: { id: string }, ip?: string) {
    const email = input.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError("EMAIL_TAKEN", "An account with this email already exists", 409);
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: input.fullName,
        role: input.role,
        status: "ACTIVE",
      },
    });
    await auditService.log({
      actorUserId: actor.id,
      action: "STAFF_CREATE",
      entityType: "User",
      entityId: user.id,
      ip,
      meta: { email, role: input.role },
    });
    return { id: user.id, email: user.email, role: user.role };
  }

  async update(
    id: string,
    input: AdminStaffUpdateInput,
    actor: { id: string },
    ip?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role === "STUDENT") throw new AppError("NOT_FOUND", "Staff account not found", 404);
    if (id === actor.id && input.role && input.role !== user.role) {
      throw new AppError("FORBIDDEN", "You cannot change your own role", 403);
    }
    if (id === actor.id && input.status === "SUSPENDED") {
      throw new AppError("FORBIDDEN", "You cannot suspend yourself", 403);
    }
    if (user.role === "SUPER_ADMIN" && input.role && input.role !== "SUPER_ADMIN") {
      const supers = await prisma.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
      if (supers <= 1) throw new AppError("LAST_SUPER", "Keep at least one active super-admin", 400);
    }
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.status === "SUSPENDED" ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
    await auditService.log({
      actorUserId: actor.id,
      action: "STAFF_UPDATE",
      entityType: "User",
      entityId: user.id,
      ip,
      meta: { reason: input.reason, role: input.role ?? null, status: input.status ?? null },
    });
    return { id: updated.id, role: updated.role, status: updated.status };
  }
}

export const adminStaffService = new AdminStaffService();
