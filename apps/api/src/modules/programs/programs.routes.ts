import type { FastifyInstance } from "fastify";
import {
  authorCreateSchema,
  authorUpdateSchema,
  bookUpdateSchema,
  bookWriteSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  chapterCreateSchema,
  programCreateSchema,
  programSubjectCreateSchema,
  programSubjectUpdateSchema,
  programUpdateSchema,
  subcategoryCreateSchema,
  subcategoryUpdateSchema,
  topicCreateSchema,
  topicUpdateSchema,
} from "@learning/shared-validation";
import { authJwt, requireRole } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { programsController } from "./programs.controller";

export async function programsRoutes(app: FastifyInstance) {
  const writeRoles = ["SUPER_ADMIN", "CONTENT_ADMIN"] as const;
  const readRoles = [...writeRoles, "READ_ONLY"] as const;

  app.get("/api/v1/programs", { preHandler: [authJwt] }, (req, reply) =>
    programsController.listActive(req, reply)
  );

  app.get(
    "/api/v1/admin/programs",
    { preHandler: [authJwt, requireRole(...readRoles)] },
    (req, reply) => programsController.list(req, reply)
  );
  app.get(
    "/api/v1/admin/programs/tree",
    { preHandler: [authJwt, requireRole(...readRoles)] },
    (req, reply) => programsController.tree(req, reply)
  );
  app.post(
    "/api/v1/admin/programs",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(programCreateSchema)] },
    (req, reply) => programsController.createProgram(req as never, reply)
  );
  app.patch(
    "/api/v1/admin/programs/:id",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(programUpdateSchema)] },
    (req, reply) => programsController.updateProgram(req as never, reply)
  );

  app.post(
    "/api/v1/admin/program-subjects",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(programSubjectCreateSchema)] },
    (req, reply) => programsController.createSubject(req as never, reply)
  );
  app.patch(
    "/api/v1/admin/program-subjects/:id",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(programSubjectUpdateSchema)] },
    (req, reply) => programsController.updateSubject(req as never, reply)
  );

  app.post(
    "/api/v1/admin/topics",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(topicCreateSchema)] },
    (req, reply) => programsController.createTopic(req as never, reply)
  );
  app.patch(
    "/api/v1/admin/topics/:id",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(topicUpdateSchema)] },
    (req, reply) => programsController.updateTopic(req as never, reply)
  );

  app.post(
    "/api/v1/admin/syllabus/chapters",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(chapterCreateSchema)] },
    (req, reply) => programsController.createChapter(req as never, reply)
  );

  app.post(
    "/api/v1/admin/categories",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(categoryCreateSchema)] },
    (req, reply) => programsController.createCategory(req as never, reply)
  );
  app.patch(
    "/api/v1/admin/categories/:id",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(categoryUpdateSchema)] },
    (req, reply) => programsController.updateCategory(req as never, reply)
  );

  app.post(
    "/api/v1/admin/subcategories",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(subcategoryCreateSchema)] },
    (req, reply) => programsController.createSubcategory(req as never, reply)
  );
  app.patch(
    "/api/v1/admin/subcategories/:id",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(subcategoryUpdateSchema)] },
    (req, reply) => programsController.updateSubcategory(req as never, reply)
  );

  app.get(
    "/api/v1/admin/authors",
    { preHandler: [authJwt, requireRole(...readRoles)] },
    (req, reply) => programsController.listAuthors(req, reply)
  );
  app.post(
    "/api/v1/admin/authors",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(authorCreateSchema)] },
    (req, reply) => programsController.createAuthor(req as never, reply)
  );
  app.patch(
    "/api/v1/admin/authors/:id",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(authorUpdateSchema)] },
    (req, reply) => programsController.updateAuthor(req as never, reply)
  );

  app.post(
    "/api/v1/admin/subjects/:id/books",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(bookWriteSchema)] },
    (req, reply) => programsController.createBookOnSubject(req as never, reply)
  );
  app.patch(
    "/api/v1/admin/books/:id",
    { preHandler: [authJwt, requireRole(...writeRoles), validateBody(bookUpdateSchema)] },
    (req, reply) => programsController.updateBook(req as never, reply)
  );
}
