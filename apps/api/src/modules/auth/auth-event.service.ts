import { prisma } from "../../infrastructure/database/prisma";
import type { RequestMeta } from "../../shared/http/request-meta";
import { settingsService } from "../settings/settings.service";

export type AuthEventName =
  | "SIGNIN_OK"
  | "SIGNIN_FAIL"
  | "SIGNUP_OK"
  | "ACCOUNT_DISABLED"
  | "PASSWORD_CHANGE"
  | "SESSION_REVOKE"
  | "RESET_REQUEST"
  | "MFA_CHALLENGE"
  | "MFA_OK"
  | "MFA_FAIL";

export async function recordAuthEvent(input: {
  userId?: string | null;
  emailAttempted?: string | null;
  event: AuthEventName;
  success: boolean;
  meta?: RequestMeta;
}) {
  try {
    const settings = await settingsService.get();
    await prisma.authEvent.create({
      data: {
        userId: input.userId ?? undefined,
        emailAttempted: input.emailAttempted?.toLowerCase() ?? undefined,
        event: input.event,
        success: input.success,
        ip: input.meta?.ip,
        userAgent: input.meta?.userAgent,
        deviceId: input.meta?.deviceId,
        platform: input.meta?.platform,
        country: settings.geoOnLogin ? input.meta?.country : undefined,
        city: settings.geoOnLogin ? input.meta?.city : undefined,
      },
    });
  } catch {
    // Logging must never block sign-in.
  }
}
