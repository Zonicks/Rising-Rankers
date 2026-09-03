import type { FastifyInstance } from "fastify";
import {
  depositSchema,
  paymentWebhookSchema,
  sandboxConfirmSchema,
} from "@learning/shared-validation";
import { authJwt } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { rateLimit } from "../../shared/middleware/rate-limit";
import { paymentController } from "./payment.controller";

export async function paymentRoutes(app: FastifyInstance) {
  app.post(
    "/api/v1/wallet/deposit",
    {
      preHandler: [
        authJwt,
        rateLimit({
          windowMs: 60_000,
          max: 15,
          keyPrefix: "deposit",
          keyFn: (req) => req.user?.sub ?? req.ip,
        }),
        validateBody(depositSchema),
      ],
    },
    (req, reply) => paymentController.deposit(req as never, reply)
  );
  app.post(
    "/api/v1/payments/sandbox/confirm",
    { preHandler: [authJwt, validateBody(sandboxConfirmSchema)] },
    (req, reply) => paymentController.sandboxConfirm(req as never, reply)
  );
  app.post(
    "/api/v1/payments/webhook",
    {
      preHandler: [
        rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "webhook" }),
        validateBody(paymentWebhookSchema),
      ],
    },
    (req, reply) => paymentController.webhook(req as never, reply)
  );
}
