import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@learning/shared-types";
import { env } from "../../config/env";
import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../errors/app-error";

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
  sv?: number;
  purpose?: "full" | "mfa" | "enroll";
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, purpose: payload.purpose ?? "full" }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signChallengeToken(payload: JwtPayload, purpose: "mfa" | "enroll") {
  return jwt.sign({ ...payload, purpose }, env.JWT_SECRET, { expiresIn: "10m" } as jwt.SignOptions);
}

export async function authJwt(req: FastifyRequest, _reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "Missing or invalid authorization header", 401);
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const row = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { sessionVersion: true },
    });
    if (!row) throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
    if ((decoded.sv ?? 0) < row.sessionVersion) {
      throw new AppError("SESSION_REVOKED", "This session was signed out. Sign in again.", 401);
    }
    if (decoded.purpose && decoded.purpose !== "full") {
      throw new AppError("MFA_REQUIRED", "Finish the authenticator step first", 401);
    }
    req.user = decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
  }
}

export async function authChallenge(req: FastifyRequest, _reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "Missing or invalid authorization header", 401);
  }
  try {
    const decoded = jwt.verify(header.slice(7), env.JWT_SECRET) as JwtPayload;
    if (decoded.purpose !== "mfa" && decoded.purpose !== "enroll") {
      throw new AppError("UNAUTHORIZED", "This step needs a challenge token", 401);
    }
    req.user = decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("UNAUTHORIZED", "Challenge token is invalid or expired", 401);
  }
}

export async function authFullOrEnroll(req: FastifyRequest, _reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "Missing or invalid authorization header", 401);
  }
  try {
    const decoded = jwt.verify(header.slice(7), env.JWT_SECRET) as JwtPayload;
    if (decoded.purpose === "mfa") {
      throw new AppError("MFA_REQUIRED", "Finish the authenticator step first", 401);
    }
    req.user = decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.user) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError("FORBIDDEN", "You do not have permission for this action", 403);
    }
  };
}
