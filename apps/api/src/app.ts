import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./config/env";
import { AppError } from "./shared/errors/app-error";
import { healthRoutes } from "./modules/health/health.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { walletRoutes } from "./modules/wallet/wallet.routes";
import { contentRoutes } from "./modules/content/content.routes";
import { paymentRoutes } from "./modules/payments/payment.routes";
import { liveTestRoutes } from "./modules/tests/live-test.routes";
import { withdrawalRoutes } from "./modules/withdrawals/withdrawal.routes";
import { supportRoutes } from "./modules/support/support.routes";
import { programsRoutes } from "./modules/programs/programs.routes";
import { achievementsRoutes } from "./modules/achievements/achievements.routes";
import { articlesRoutes } from "./modules/articles/articles.routes";
import { curriculumRoutes } from "./modules/curriculum/curriculum.routes";
import { progressRoutes } from "./modules/progress/progress.routes";
import { rewardsRoutes } from "./modules/rewards/rewards.routes";
import { catalogRoutes } from "./modules/catalog/catalog.routes";
import { financeRoutes } from "./modules/finance/finance.routes";
import { adminUsersRoutes } from "./modules/admin-users/admin-users.routes";
import { auditRoutes } from "./modules/audit/audit.routes";

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowed = env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  if (allowed.includes(origin) || allowed.includes("*")) return true;
  if (env.NODE_ENV === "production") return false;
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 8 * 1024 * 1024,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: (origin, cb) => cb(null, isAllowedCorsOrigin(origin)),
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  });

  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 12 },
  });

  // Accept empty / missing JSON bodies (join, declare, approve)
  app.removeContentTypeParser("application/json");
  const parseJson = (body: string | Buffer, done: (err: Error | null, body?: unknown) => void) => {
    try {
      const text = typeof body === "string" ? body : body.toString("utf8");
      done(null, text.trim() === "" ? {} : JSON.parse(text));
    } catch (err) {
      done(err as Error, undefined);
    }
  };
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) =>
    parseJson(body as string, done)
  );
  app.addContentTypeParser("*", { parseAs: "string" }, (req, body, done) => {
    if (String(req.headers["content-type"] ?? "").toLowerCase().includes("multipart/form-data")) {
      done(null, undefined);
      return;
    }
    parseJson(body as string, done);
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(walletRoutes);
  await app.register(contentRoutes);
  await app.register(paymentRoutes);
  await app.register(liveTestRoutes);
  await app.register(withdrawalRoutes);
  await app.register(supportRoutes);
  await app.register(programsRoutes);
  await app.register(achievementsRoutes);
  await app.register(articlesRoutes);
  await app.register(curriculumRoutes);
  await app.register(progressRoutes);
  await app.register(rewardsRoutes);
  await app.register(catalogRoutes);
  await app.register(financeRoutes);
  await app.register(adminUsersRoutes);
  await app.register(auditRoutes);

  app.setErrorHandler((error, _req, reply) => {
    const maybe = error as { name?: string; message?: string };
    const appErr =
      error instanceof AppError
        ? error
        : maybe?.name === "AppError"
          ? (error as AppError)
          : null;
    if (appErr) {
      return reply.status(appErr.statusCode).send({
        error: {
          code: appErr.code,
          message: appErr.message,
          details: appErr.details,
        },
      });
    }
    app.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong",
      },
    });
  });

  return app;
}
