import type { FastifyInstance } from "fastify";
import { healthController } from "./health.controller";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", (req, reply) => healthController.get(req, reply));
  app.get("/api/v1/health", (req, reply) => healthController.get(req, reply));
}
