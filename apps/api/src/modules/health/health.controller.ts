import type { FastifyReply, FastifyRequest } from "fastify";
import type { HealthResponse } from "@learning/shared-types";

export class HealthController {
  get(_req: FastifyRequest, reply: FastifyReply) {
    const body: HealthResponse = {
      status: "ok",
      service: "learning-api",
      timestamp: new Date().toISOString(),
    };
    return reply.status(200).send(body);
  }
}

export const healthController = new HealthController();
