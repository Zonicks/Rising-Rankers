import type { FastifyInstance } from "fastify";
import { withdrawalReviewSchema, withdrawalSchema } from "@learning/shared-validation";
import { authJwt, requireRole } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { withdrawalController } from "./withdrawal.controller";

export async function withdrawalRoutes(app: FastifyInstance) {
  app.post(
    "/api/v1/withdrawals",
    { preHandler: [authJwt, validateBody(withdrawalSchema)] },
    (req, reply) => withdrawalController.request(req as never, reply)
  );
  app.get("/api/v1/withdrawals/me", { preHandler: [authJwt] }, (req, reply) =>
    withdrawalController.mine(req, reply)
  );
  app.get(
    "/api/v1/admin/withdrawals",
    { preHandler: [authJwt, requireRole("SUPER_ADMIN", "FINANCE_ADMIN", "READ_ONLY")] },
    (req, reply) => withdrawalController.adminList(req, reply)
  );
  app.post(
    "/api/v1/admin/withdrawals/:id/review",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "FINANCE_ADMIN"),
        validateBody(withdrawalReviewSchema),
      ],
    },
    (req, reply) => withdrawalController.review(req as never, reply)
  );
}
