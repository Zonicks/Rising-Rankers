import type { FastifyInstance } from "fastify";
import { authJwt } from "../../shared/middleware/auth";
import { progressService } from "./progress.service";

export async function progressRoutes(app: FastifyInstance) {
  app.get("/api/v1/me/progress", { preHandler: [authJwt] }, async (req, reply) => {
    const data = await progressService.progress(req.user!.sub);
    return reply.send({ data });
  });
  app.get("/api/v1/me/tracker", { preHandler: [authJwt] }, async (req, reply) => {
    const data = await progressService.tracker(req.user!.sub);
    return reply.send({ data });
  });
}
