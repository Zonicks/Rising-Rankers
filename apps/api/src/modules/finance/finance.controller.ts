import type { FastifyReply, FastifyRequest } from "fastify";
import { financeService } from "./finance.service";

export class FinanceController {
  async summary(_req: FastifyRequest, reply: FastifyReply) {
    return reply.send({ data: await financeService.summary() });
  }
}

export const financeController = new FinanceController();
