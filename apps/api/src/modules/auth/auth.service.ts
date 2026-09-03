import bcrypt from "bcryptjs";
import type {
  SignupInput,
  SigninInput,
  UpdateProfileInput,
  ChangePasswordInput,
  PasswordResetConsumeInput,
} from "@learning/shared-validation";
import type { AuthResponse, AuthUserDto } from "@learning/shared-types";
import { AppError } from "../../shared/errors/app-error";
import type { RequestMeta } from "../../shared/http/request-meta";
import { signChallengeToken, signToken } from "../../shared/middleware/auth";
import { env } from "../../config/env";
import { settingsService } from "../settings/settings.service";
import { decryptSecret, encryptSecret, otpauthUrl, randomTotpSecret, verifyTotp } from "./totp";
import { prisma } from "../../infrastructure/database/prisma";
import { userRepository } from "../users/user.repository";
import { rewardsService } from "../rewards/rewards.service";
import { deviceService } from "../devices/device.service";
import { recordAuthEvent } from "./auth-event.service";
import { hashResetToken } from "./password-reset";

function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string | null;
  role: AuthUserDto["role"];
  status: AuthUserDto["status"];
}): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
  };
}

function tokenFor(user: { id: string; role: AuthUserDto["role"]; email: string; sessionVersion?: number }) {
  return signToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    sv: user.sessionVersion ?? 0,
  });
}

async function markLogin(userId: string, meta?: RequestMeta) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date(), lastLoginIp: meta?.ip },
  });
  if (meta?.deviceId) {
    await deviceService.upsert(userId, meta.deviceId, meta.platform, {
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}

export class AuthService {
  async signup(input: SignupInput, meta?: RequestMeta): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError("EMAIL_TAKEN", "An account with this email already exists", 409);
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await userRepository.createStudent({
      email,
      passwordHash,
      fullName: input.fullName,
    });
    await markLogin(user.id, meta);
    await recordAuthEvent({
      userId: user.id,
      emailAttempted: email,
      event: "SIGNUP_OK",
      success: true,
      meta,
    });
    return { token: tokenFor({ ...user, sessionVersion: 0 }), user: toAuthUser(user) };
  }

  async signin(input: SigninInput, meta?: RequestMeta) {
    const email = input.email.toLowerCase();
    const user = await userRepository.findByEmail(email);
    if (!user) {
      await recordAuthEvent({
        emailAttempted: email,
        event: "SIGNIN_FAIL",
        success: false,
        meta,
      });
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      await recordAuthEvent({
        userId: user.id,
        emailAttempted: email,
        event: "SIGNIN_FAIL",
        success: false,
        meta,
      });
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    if (user.status === "BLOCKED" || user.status === "SUSPENDED") {
      await recordAuthEvent({
        userId: user.id,
        emailAttempted: email,
        event: "ACCOUNT_DISABLED",
        success: false,
        meta,
      });
      throw new AppError("ACCOUNT_DISABLED", "This account is not allowed to sign in", 403);
    }
    if (user.role !== "STUDENT") {
      const settings = await settingsService.get();
      const challenge = {
        sub: user.id,
        role: user.role,
        email: user.email,
        sv: user.sessionVersion ?? 0,
      };
      if (user.totpEnabled) {
        await recordAuthEvent({
          userId: user.id,
          emailAttempted: email,
          event: "MFA_CHALLENGE",
          success: true,
          meta,
        });
        return {
          mfaRequired: true as const,
          mfaToken: signChallengeToken(challenge, "mfa"),
          user: toAuthUser(user),
        };
      }
      if (settings.requireAdminMfa) {
        return {
          mfaEnrollRequired: true as const,
          enrollToken: signChallengeToken(challenge, "enroll"),
          user: toAuthUser(user),
        };
      }
    }
    await markLogin(user.id, meta);
    await recordAuthEvent({
      userId: user.id,
      emailAttempted: email,
      event: "SIGNIN_OK",
      success: true,
      meta,
    });
    return {
      token: tokenFor({ ...user, sessionVersion: user.sessionVersion ?? 0 }),
      user: toAuthUser(user),
    };
  }

  async me(userId: string) {
    const streakCount = await rewardsService.refreshStreak(userId);
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
    return {
      user: {
        ...toAuthUser(user),
        firstName: user.firstName,
        lastName: user.lastName,
      },
      profile: user.profile,
      wallet: user.wallet
        ? {
            deposited: user.wallet.depositedBalance.toString(),
            award: user.wallet.awardBalance.toString(),
            promo: user.wallet.promoBalance.toString(),
          }
        : null,
      curriculum: user.curriculum
        ? {
            programId: user.curriculum.programId,
            programName: user.curriculum.program.name,
            programSlug: user.curriculum.program.slug,
            targetYear: user.curriculum.targetYear,
            moduleCount: user.curriculum._count.modules,
            builtAt: user.curriculum.builtAt.toISOString(),
            rebuiltAt: user.curriculum.rebuiltAt?.toISOString() ?? null,
          }
        : null,
      pointsBalance: user.pointsBalance,
      streakCount,
      mfaEnabled: user.totpEnabled,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const { dateOfBirth, ...rest } = input;
    const user = await userRepository.updateProfile(userId, {
      ...rest,
      dateOfBirth:
        dateOfBirth === undefined
          ? undefined
          : dateOfBirth
            ? new Date(`${dateOfBirth}T00:00:00.000Z`)
            : null,
    });
    if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
    return {
      user: toAuthUser(user),
      profile: user.profile,
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput, meta?: RequestMeta) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppError("WRONG_PASSWORD", "Current password is incorrect", 400);
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    await userRepository.updatePasswordHash(userId, passwordHash);
    await recordAuthEvent({
      userId,
      emailAttempted: user.email,
      event: "PASSWORD_CHANGE",
      success: true,
      meta,
    });
    return { ok: true as const };
  }

  async consumePasswordReset(input: PasswordResetConsumeInput, meta?: RequestMeta) {
    const hash = hashResetToken(input.token);
    const user = await prisma.user.findUnique({
      where: { passwordResetTokenHash: hash },
    });
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new AppError("RESET_INVALID", "This reset link is invalid or has expired", 400);
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        sessionVersion: { increment: 1 },
      },
    });
    await prisma.deviceSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAuthEvent({
      userId: user.id,
      emailAttempted: user.email,
      event: "PASSWORD_CHANGE",
      success: true,
      meta,
    });
    return { ok: true as const };
  }

  async startMfa(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role === "STUDENT") throw new AppError("FORBIDDEN", "Authenticator is for staff only", 403);
    const secret = randomTotpSecret();
    await prisma.user.update({
      where: { id: userId },
      data: { totpPendingEnc: encryptSecret(secret, env.JWT_SECRET) },
    });
    return { secret, otpauthUrl: otpauthUrl(user.email, secret) };
  }

  async enableMfa(userId: string, code: string, meta?: RequestMeta, issueSession = false) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role === "STUDENT") throw new AppError("FORBIDDEN", "Authenticator is for staff only", 403);
    if (!user.totpPendingEnc) throw new AppError("MFA_NOT_STARTED", "Start authenticator setup first", 400);
    const secret = decryptSecret(user.totpPendingEnc, env.JWT_SECRET);
    if (!verifyTotp(secret, code)) {
      await recordAuthEvent({ userId, emailAttempted: user.email, event: "MFA_FAIL", success: false, meta });
      throw new AppError("MFA_INVALID", "That authenticator code is not valid", 400);
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: true,
        totpSecretEnc: encryptSecret(secret, env.JWT_SECRET),
        totpPendingEnc: null,
      },
    });
    await recordAuthEvent({ userId, emailAttempted: user.email, event: "MFA_OK", success: true, meta });
    if (!issueSession) return { enabled: true as const };
    await markLogin(user.id, meta);
    await recordAuthEvent({ userId, emailAttempted: user.email, event: "SIGNIN_OK", success: true, meta });
    return {
      enabled: true as const,
      token: tokenFor({ ...user, sessionVersion: user.sessionVersion ?? 0 }),
      user: toAuthUser(user),
    };
  }

  async disableMfa(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpEnabled || !user.totpSecretEnc) {
      throw new AppError("MFA_NOT_ENABLED", "Authenticator is not on", 400);
    }
    const secret = decryptSecret(user.totpSecretEnc, env.JWT_SECRET);
    if (!verifyTotp(secret, code)) throw new AppError("MFA_INVALID", "That authenticator code is not valid", 400);
    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecretEnc: null, totpPendingEnc: null },
    });
    return { enabled: false as const };
  }

  async verifyMfa(userId: string, code: string, meta?: RequestMeta) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role === "STUDENT" || !user.totpEnabled || !user.totpSecretEnc) {
      throw new AppError("MFA_NOT_ENABLED", "Authenticator is not on", 400);
    }
    const secret = decryptSecret(user.totpSecretEnc, env.JWT_SECRET);
    if (!verifyTotp(secret, code)) {
      await recordAuthEvent({ userId, emailAttempted: user.email, event: "MFA_FAIL", success: false, meta });
      throw new AppError("MFA_INVALID", "That authenticator code is not valid", 400);
    }
    await markLogin(user.id, meta);
    await recordAuthEvent({ userId, emailAttempted: user.email, event: "MFA_OK", success: true, meta });
    await recordAuthEvent({ userId, emailAttempted: user.email, event: "SIGNIN_OK", success: true, meta });
    return {
      token: tokenFor({ ...user, sessionVersion: user.sessionVersion ?? 0 }),
      user: toAuthUser(user),
    };
  }

  async securityStatus(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
    const settings = await settingsService.get();
    return {
      mfaEnabled: user.totpEnabled,
      requireAdminMfa: settings.requireAdminMfa,
      geoOnLogin: settings.geoOnLogin,
    };
  }
}

export const authService = new AuthService();
