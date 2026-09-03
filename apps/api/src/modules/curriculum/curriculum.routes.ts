import type { FastifyInstance } from "fastify";
import { curriculumSetupSchema } from "@learning/shared-validation";
import { authJwt } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { curriculumService } from "./curriculum.service";

export async function curriculumRoutes(app: FastifyInstance) {
  app.post(
    "/api/v1/me/curriculum",
    { preHandler: [authJwt, validateBody(curriculumSetupSchema)] },
    async (req, reply) => {
      const body = req.body as {
        firstName: string;
        lastName: string;
        programId: string;
        targetYear: number | null;
      };
      const data = await curriculumService.build(req.user!.sub, body);
      return reply.send({ data });
    }
  );
}
