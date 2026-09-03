import type { FastifyInstance } from "fastify";
import {
  signupSchema,
  signinSchema,
  updateProfileSchema,
  changePasswordSchema,
  passwordResetConsumeSchema,
  totpCodeSchema,
} from "@learning/shared-validation";
import { authChallenge, authFullOrEnroll, authJwt } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { rateLimit } from "../../shared/middleware/rate-limit";
import { authController } from "./auth.controller";

export async function authRoutes(app: FastifyInstance) {
  const authLimit = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "auth" });

  app.post(
    "/api/v1/auth/signup",
    { preHandler: [authLimit, validateBody(signupSchema)] },
    (req, reply) => authController.signup(req as never, reply)
  );
  app.post(
    "/api/v1/auth/signin",
    { preHandler: [authLimit, validateBody(signinSchema)] },
    (req, reply) => authController.signin(req as never, reply)
  );

  app.post(
    "/api/v1/auth/password/reset",
    { preHandler: [authLimit, validateBody(passwordResetConsumeSchema)] },
    (req, reply) => authController.consumePasswordReset(req as never, reply)
  );

  app.post("/api/v1/auth/otp/request", async (_req, reply) =>
    reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "OTP login comes after MVP JWT auth" },
    })
  );
  app.post("/api/v1/auth/otp/verify", async (_req, reply) =>
    reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "OTP login comes after MVP JWT auth" },
    })
  );

  const mfaLimit = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "mfa" });
  app.post(
    "/api/v1/auth/mfa/setup",
    { preHandler: [authFullOrEnroll] },
    (req, reply) => authController.startMfa(req, reply)
  );
  app.post(
    "/api/v1/auth/mfa/enable",
    { preHandler: [mfaLimit, authFullOrEnroll, validateBody(totpCodeSchema)] },
    (req, reply) => authController.enableMfa(req as never, reply)
  );
  app.post(
    "/api/v1/auth/mfa/disable",
    { preHandler: [authJwt, validateBody(totpCodeSchema)] },
    (req, reply) => authController.disableMfa(req as never, reply)
  );
  app.post(
    "/api/v1/auth/mfa/verify",
    { preHandler: [mfaLimit, authChallenge, validateBody(totpCodeSchema)] },
    (req, reply) => authController.verifyMfa(req as never, reply)
  );
  app.get("/api/v1/admin/me/security", { preHandler: [authJwt] }, (req, reply) =>
    authController.securityStatus(req, reply)
  );

  app.get("/api/v1/me", { preHandler: [authJwt] }, (req, reply) => authController.me(req, reply));
  app.patch(
    "/api/v1/me/profile",
    { preHandler: [authJwt, validateBody(updateProfileSchema)] },
    (req, reply) => authController.updateProfile(req as never, reply)
  );
  app.patch(
    "/api/v1/me/password",
    { preHandler: [authJwt, authLimit, validateBody(changePasswordSchema)] },
    (req, reply) => authController.changePassword(req as never, reply)
  );
}
