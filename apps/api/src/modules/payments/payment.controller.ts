import type { FastifyReply, FastifyRequest } from "fastify";
import { paymentService } from "./payment.service";

export class PaymentController {
  async deposit(req: FastifyRequest<{ Body: { amount: number } }>, reply: FastifyReply) {
    const data = await paymentService.createDeposit(req.user!.sub, req.body.amount);
    return reply.status(201).send({ data });
  }

  async sandboxConfirm(
    req: FastifyRequest<{ Body: { paymentId: string; status: "SUCCESSFUL" | "FAILED" } }>,
    reply: FastifyReply
  ) {
    const data = await paymentService.confirmSandbox(req.body.paymentId, req.body.status);
    return reply.send({ data });
  }

  async webhook(
    req: FastifyRequest<{
      Body: { providerRef: string; status: "SUCCESSFUL" | "FAILED"; signature?: string };
    }>,
    reply: FastifyReply
  ) {
    const data = await paymentService.applyWebhook(req.body);
    return reply.send({ data });
  }
}

export const paymentController = new PaymentController();
