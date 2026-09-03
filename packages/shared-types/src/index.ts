export type UserRole =
  | "STUDENT"
  | "SUPER_ADMIN"
  | "CONTENT_ADMIN"
  | "TEST_ADMIN"
  | "FINANCE_ADMIN"
  | "SUPPORT_ADMIN"
  | "READ_ONLY";

export type AccountStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "BLOCKED"
  | "UNDER_REVIEW"
  | "KYC_PENDING"
  | "WITHDRAWAL_RESTRICTED";

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  status: AccountStatus;
}

export interface AuthResponse {
  token: string;
  user: AuthUserDto;
}

export interface WalletBalancesDto {
  deposited: string;
  award: string;
  promo: string;
}

export const ADMIN_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "CONTENT_ADMIN",
  "TEST_ADMIN",
  "FINANCE_ADMIN",
  "SUPPORT_ADMIN",
  "READ_ONLY",
];
