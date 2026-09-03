import type { FastifyReply, FastifyRequest } from "fastify";
import { withdrawalService } from "./withdrawal.service";
import { auditService } from "../audit/audit.service";

export class WithdrawalController {
  async request(
    req: FastifyRequest<{ Body: { amount: number; method: string; destination: string } }>,
    reply: FastifyReply
  ) {
    const data = await withdrawalService.request(
      req.user!.sub,
      req.body.amount,
      req.body.method,
      req.body.destination
    );
    return reply.status(201).send({ data });
  }

  async mine(req: FastifyRequest, reply: FastifyReply) {
    const data = await withdrawalService.myList(req.user!.sub);
    return reply.send({ data });
  }

  async adminList(_req: FastifyRequest, reply: FastifyReply) {
    const data = await withdrawalService.adminList();
    return reply.send({ data });
  }

  async review(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { action: "APPROVE" | "REJECT"; rejectReason?: string };
    }>,
    reply: FastifyReply
  ) {
    const data = await withdrawalService.review(
      req.params.id,
      req.body.action,
      req.body.rejectReason
    );
    await auditService.log({
      actorUserId: req.user!.sub,
      action: `WITHDRAWAL_${req.body.action}`,
      entityType: "Withdrawal",
      entityId: req.params.id,
      ip: req.ip,
      meta: data,
    });
    return reply.send({ data });
  }
}

export const withdrawalController = new WithdrawalController();
