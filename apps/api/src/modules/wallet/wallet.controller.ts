import type { FastifyReply, FastifyRequest } from "fastify";
import type { AdminCreditInput } from "./wallet.types";
import { walletService } from "./wallet.service";
import { auditService } from "../audit/audit.service";

export class WalletController {
  async balances(req: FastifyRequest, reply: FastifyReply) {
    const data = await walletService.getBalances(req.user!.sub);
    return reply.send({ data });
  }

  async ledger(req: FastifyRequest, reply: FastifyReply) {
    const data = await walletService.getLedger(req.user!.sub);
    return reply.send({ data });
  }

  async adminCredit(req: FastifyRequest<{ Body: AdminCreditInput }>, reply: FastifyReply) {
    const body = req.body;
    const data = await walletService.credit({
      userId: body.userId,
      amount: body.amount,
      bucket: body.bucket,
      type: "ADMIN_ADJUSTMENT",
      note: body.note,
      idempotencyKey: `admin-credit:${body.userId}:${body.amount}:${Date.now()}`,
    });
    await auditService.log({
      actorUserId: req.user!.sub,
      action: "ADMIN_WALLET_CREDIT",
      entityType: "User",
      entityId: body.userId,
      ip: req.ip,
      meta: { amount: body.amount, bucket: body.bucket, note: body.note },
    });
    return reply.send({ data });
  }
}

export const walletController = new WalletController();
