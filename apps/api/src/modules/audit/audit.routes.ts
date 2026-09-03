import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { adminAuditExportSchema, adminAuditQuerySchema } from "@learning/shared-validation";
import { AppError } from "../../shared/errors/app-error";
import { authJwt, requireRole } from "../../shared/middleware/auth";
import { rateLimit } from "../../shared/middleware/rate-limit";
import { validateBody } from "../../shared/middleware/validate";
import { auditService } from "./audit.service";

const VIEW_ROLES = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "SUPPORT_ADMIN",
  "TEST_ADMIN",
  "READ_ONLY",
] as const;

export async function auditRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/admin/audit-logs",
    { preHandler: [authJwt, requireRole(...VIEW_ROLES)] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = adminAuditQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", "Invalid audit filters", 400, parsed.error.flatten());
      }
      const data = await auditService.list(parsed.data);
      return reply.send({
        data: {
          ...data,
          canExport: req.user?.role === "SUPER_ADMIN" || req.user?.role === "FINANCE_ADMIN",
        },
      });
    }
  );

  app.post(
    "/api/v1/admin/audit-logs/export",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "FINANCE_ADMIN"),
        rateLimit({
          windowMs: 60 * 60 * 1000,
          max: 20,
          keyPrefix: "audit-export",
          keyFn: (req) => req.user?.sub ?? req.ip,
        }),
        validateBody(adminAuditExportSchema),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as {
        purpose: string;
        reason: string;
        format: "csv" | "json";
        q?: string;
        action?: string;
        entityType?: string;
        entityId?: string;
        actorId?: string;
        from?: string;
        to?: string;
      };
      const data = await auditService.export(body, { id: req.user!.sub }, req.ip);
      return reply.send({ data });
    }
  );
}
