import type { FastifyInstance } from "fastify";
import { articleCreateSchema, articleUpdateSchema, uploadImageSchema } from "@learning/shared-validation";
import { authJwt, requireRole } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { articlesService } from "./articles.service";

export async function articlesRoutes(app: FastifyInstance) {
  const writeRoles = ["SUPER_ADMIN", "CONTENT_ADMIN"] as const;
  const readRoles = [...writeRoles, "READ_ONLY"] as const;

  app.get("/uploads/:file", async (req, reply) => {
    const { file } = req.params as { file: string };
    const { stream, mime } = await articlesService.streamFile(file);
    return reply.header("Cache-Control", "public, max-age=86400").type(mime).send(stream);
  });

  app.get(
    "/api/v1/admin/articles",
    { preHandler: [authJwt, requireRole(...readRoles)] },
    async (_req, reply) => {
      const data = await articlesService.list();
      return reply.send({ data });
    }
  );
  app.post(
    "/api/v1/admin/articles",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(articleCreateSchema)] },
    async (req, reply) => {
      const data = await articlesService.create(req.body as never);
      return reply.status(201).send({ data });
    }
  );
  app.patch(
    "/api/v1/admin/articles/:id",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(articleUpdateSchema)] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const data = await articlesService.update(id, req.body as never);
      return reply.send({ data });
    }
  );
  app.post(
    "/api/v1/admin/uploads",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(uploadImageSchema)] },
    async (req, reply) => {
      const data = await articlesService.saveUpload(req.body as never);
      return reply.status(201).send({ data });
    }
  );

  app.get("/api/v1/articles", { preHandler: [authJwt] }, async (req, reply) => {
    const raw = (req.query as { range?: string } | undefined)?.range ?? "today";
    const range = raw === "week" || raw === "archive" || raw === "today" ? raw : "today";
    const data = await articlesService.listForStudent(req.user!.sub, range);
    return reply.send({ data });
  });
  app.get("/api/v1/articles/:id", { preHandler: [authJwt] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = await articlesService.getForStudent(req.user!.sub, id);
    return reply.send({ data });
  });
  app.post("/api/v1/articles/:id/read", { preHandler: [authJwt] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = await articlesService.markRead(req.user!.sub, id);
    return reply.send({ data });
  });
}
