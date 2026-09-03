import type { FastifyInstance } from "fastify";
import { adminCreditSchema } from "@learning/shared-validation";
import { authJwt, requireRole } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { walletController } from "./wallet.controller";

export async function walletRoutes(app: FastifyInstance) {
  app.get("/api/v1/wallet", { preHandler: [authJwt] }, (req, reply) =>
    walletController.balances(req, reply)
  );
  app.get("/api/v1/wallet/ledger", { preHandler: [authJwt] }, (req, reply) =>
    walletController.ledger(req, reply)
  );
  app.post(
    "/api/v1/admin/wallet/credit",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "FINANCE_ADMIN"),
        validateBody(adminCreditSchema),
      ],
    },
    (req, reply) => walletController.adminCredit(req as never, reply)
  );
}
