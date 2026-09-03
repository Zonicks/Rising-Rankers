import type { FastifyInstance } from "fastify";
import { authJwt, requireRole } from "../../shared/middleware/auth";
import { financeController } from "./finance.controller";

export async function financeRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/admin/finance",
    {
      preHandler: [authJwt, requireRole("SUPER_ADMIN", "FINANCE_ADMIN", "READ_ONLY")],
    },
    (req, reply) => financeController.summary(req, reply)
  );
}
