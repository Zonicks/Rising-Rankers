import type { FastifyInstance } from "fastify";
import { achievementCreateSchema, achievementUpdateSchema } from "@learning/shared-validation";
import { authJwt, requireRole } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { achievementsService } from "./achievements.service";

export async function achievementsRoutes(app: FastifyInstance) {
  const writeRoles = ["SUPER_ADMIN", "CONTENT_ADMIN"] as const;
  const readRoles = [...writeRoles, "READ_ONLY"] as const;

  app.get(
    "/api/v1/admin/achievements",
    { preHandler: [authJwt, requireRole(...readRoles)] },
    async (_req, reply) => {
      const data = await achievementsService.list();
      return reply.send({ data });
    }
  );
  app.post(
    "/api/v1/admin/achievements",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(achievementCreateSchema)] },
    async (req, reply) => {
      const data = await achievementsService.create(req.body as never);
      return reply.status(201).send({ data });
    }
  );
  app.patch(
    "/api/v1/admin/achievements/:id",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(achievementUpdateSchema)] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const data = await achievementsService.update(id, req.body as never);
      return reply.send({ data });
    }
  );
}
