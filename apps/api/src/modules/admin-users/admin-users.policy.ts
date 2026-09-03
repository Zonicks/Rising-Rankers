import type { AccountStatus, UserRole } from "@learning/shared-types";

export const ADMIN_USER_VIEW_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "SUPPORT_ADMIN",
  "FINANCE_ADMIN",
  "TEST_ADMIN",
  "READ_ONLY",
];

export type AdminUserPermissions = {
  canReveal: boolean;
  canSuspend: boolean;
  canBlock: boolean;
  canRestrictWithdrawals: boolean;
  canRestore: boolean;
  canRevokeSessions: boolean;
  canSupport: boolean;
  canResetPassword: boolean;
  canCredit: boolean;
  canCorrect: boolean;
  canExport: boolean;
  canExportWallet: boolean;
  canErase: boolean;
  canRights: boolean;
};

export function permissionsFor(role: UserRole): AdminUserPermissions {
  const isSuper = role === "SUPER_ADMIN";
  const isSupport = role === "SUPPORT_ADMIN";
  const isFinance = role === "FINANCE_ADMIN";
  return {
    canReveal: isSuper || isSupport || isFinance,
    canSuspend: isSuper || isSupport,
    canBlock: isSuper,
    canRestrictWithdrawals: isSuper || isFinance,
    canRestore: isSuper || isSupport || isFinance,
    canRevokeSessions: isSuper || isSupport,
    canSupport: isSuper || isSupport,
    canResetPassword: isSuper || isSupport,
    canCredit: isSuper || isFinance,
    canCorrect: isSuper || isSupport,
    canExport: isSuper || isSupport,
    canExportWallet: isSuper || isSupport || isFinance,
    canErase: isSuper,
    canRights: isSuper || isSupport,
  };
}

export function canSetStatus(
  role: UserRole,
  from: AccountStatus,
  to: AccountStatus
): boolean {
  if (from === to) return true;
  const perms = permissionsFor(role);
  if (to === "BLOCKED") return perms.canBlock;
  if (to === "SUSPENDED") return perms.canSuspend;
  if (to === "WITHDRAWAL_RESTRICTED") return perms.canRestrictWithdrawals;
  if (to === "ACTIVE") {
    if (role === "FINANCE_ADMIN") return from === "WITHDRAWAL_RESTRICTED";
    return perms.canRestore;
  }
  return false;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local[0]}***@${domain}`;
}

export function maskMobile(mobile: string | null | undefined): string | null {
  if (!mobile) return null;
  const digits = mobile.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
}

export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    const parts = ip.split(":").filter((p) => p.length > 0);
    return parts.length ? `${parts.slice(0, 3).join(":")}:***` : "***";
  }
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  return "***";
}

export function yearsOld(dob: Date | null | undefined, now = new Date()): number | null {
  if (!dob) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const month = now.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}
