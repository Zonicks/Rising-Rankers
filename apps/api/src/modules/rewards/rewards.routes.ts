import type { FastifyInstance } from "fastify";
import { authJwt } from "../../shared/middleware/auth";
import { rewardsService } from "./rewards.service";

export async function rewardsRoutes(app: FastifyInstance) {
  app.get("/api/v1/leaderboard", { preHandler: [authJwt] }, async (req, reply) => {
    const data = await rewardsService.leaderboard(req.user!.sub);
    return reply.send({ data });
  });
  app.get("/api/v1/me/achievements", { preHandler: [authJwt] }, async (req, reply) => {
    const data = await rewardsService.myAchievements(req.user!.sub);
    return reply.send({ data });
  });
  app.get("/api/v1/me/streak", { preHandler: [authJwt] }, async (req, reply) => {
    const data = await rewardsService.streakSheet(req.user!.sub);
    return reply.send({ data });
  });
}
