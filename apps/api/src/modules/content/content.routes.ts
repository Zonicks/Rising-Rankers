import type { FastifyInstance } from "fastify";
import {
  bookBulkSchema,
  chapterCreateSchema,
  chapterUpdateSchema,
  flashCardBulkSchema,
  flashCardCreateSchema,
  flashReviewSchema,
  mcqAnswerSchema,
  mcqBulkSchema,
  mcqCreateSchema,
  settingsUpdateSchema,
} from "@learning/shared-validation";
import { authJwt, requireRole } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { contentController } from "./content.controller";
import { z } from "zod";

const flashCreateOrBulk = z.union([
  flashCardBulkSchema,
  flashCardCreateSchema.transform((item) => ({ items: [item] })),
]);

const mcqCreateOrBulk = z.union([
  mcqBulkSchema,
  mcqCreateSchema.transform((item) => ({ items: [item] })),
]);

export async function contentRoutes(app: FastifyInstance) {
  app.get("/api/v1/public/grievance", (req, reply) =>
    contentController.publicGrievance(req, reply)
  );
  // Student
  app.get("/api/v1/flashcards/next", { preHandler: [authJwt] }, (req, reply) =>
    contentController.nextFlash(req, reply)
  );
  app.post("/api/v1/flashcards/unlock", { preHandler: [authJwt] }, (req, reply) =>
    contentController.unlockFlash(req, reply)
  );
  app.post(
    "/api/v1/flashcards/:id/review",
    { preHandler: [authJwt, validateBody(flashReviewSchema)] },
    (req, reply) => contentController.reviewFlash(req as never, reply)
  );
  app.get("/api/v1/mcqs/next", { preHandler: [authJwt] }, (req, reply) =>
    contentController.nextMcq(req, reply)
  );
  app.post(
    "/api/v1/mcqs/:id/answer",
    { preHandler: [authJwt, validateBody(mcqAnswerSchema)] },
    (req, reply) => contentController.answerMcq(req as never, reply)
  );
  app.post("/api/v1/mcqs/unlock", { preHandler: [authJwt] }, (req, reply) =>
    contentController.unlockMcq(req, reply)
  );

  // Admin content
  const contentRoles = ["SUPER_ADMIN", "CONTENT_ADMIN"] as const;
  const readRoles = [...contentRoles, "READ_ONLY"] as const;

  app.get(
    "/api/v1/admin/chapters",
    { preHandler: [authJwt, requireRole(...readRoles)] },
    (req, reply) => contentController.adminListChapters(req, reply)
  );
  app.get(
    "/api/v1/admin/chapters/:id",
    { preHandler: [authJwt, requireRole(...readRoles)] },
    (req, reply) => contentController.adminGetChapter(req as never, reply)
  );
  app.post(
    "/api/v1/admin/chapters",
    { preHandler: [authJwt, requireRole(...contentRoles), validateBody(chapterCreateSchema)] },
    (req, reply) => contentController.adminCreateChapter(req as never, reply)
  );
  app.patch(
    "/api/v1/admin/chapters/:id",
    { preHandler: [authJwt, requireRole(...contentRoles), validateBody(chapterUpdateSchema)] },
    (req, reply) => contentController.adminUpdateChapter(req as never, reply)
  );

  const pickerRoles = ["SUPER_ADMIN", "CONTENT_ADMIN", "TEST_ADMIN", "READ_ONLY"] as const;

  app.get(
    "/api/v1/admin/flashcards",
    { preHandler: [authJwt, requireRole(...readRoles)] },
    (req, reply) => contentController.adminListFlash(req as never, reply)
  );
  app.post(
    "/api/v1/admin/flashcards",
    { preHandler: [authJwt, requireRole(...contentRoles), validateBody(flashCreateOrBulk)] },
    (req, reply) => contentController.adminCreateFlash(req as never, reply)
  );
  app.get(
    "/api/v1/admin/mcq-picker/options",
    { preHandler: [authJwt, requireRole(...pickerRoles)] },
    (req, reply) => contentController.adminMcqPickerOptions(req as never, reply)
  );
  app.get(
    "/api/v1/admin/mcqs/ids",
    { preHandler: [authJwt, requireRole(...pickerRoles)] },
    (req, reply) => contentController.adminListMcqIds(req as never, reply)
  );
  app.get(
    "/api/v1/admin/mcqs",
    { preHandler: [authJwt, requireRole(...pickerRoles)] },
    (req, reply) => contentController.adminListMcq(req as never, reply)
  );
  app.post(
    "/api/v1/admin/mcqs",
    { preHandler: [authJwt, requireRole(...contentRoles), validateBody(mcqCreateOrBulk)] },
    (req, reply) => contentController.adminCreateMcq(req as never, reply)
  );
  app.post(
    "/api/v1/admin/books/import",
    { preHandler: [authJwt, requireRole(...contentRoles), validateBody(bookBulkSchema)] },
    (req, reply) => contentController.adminCreateBooks(req as never, reply)
  );
  app.post(
    "/api/v1/admin/imports",
    { preHandler: [authJwt, requireRole(...contentRoles)] },
    (req, reply) => contentController.adminImport(req as never, reply)
  );

  // Settings + overview
  app.get(
    "/api/v1/admin/settings",
    { preHandler: [authJwt, requireRole("SUPER_ADMIN", "CONTENT_ADMIN", "READ_ONLY")] },
    (req, reply) => contentController.getSettings(req, reply)
  );
  app.patch(
    "/api/v1/admin/settings",
    {
      preHandler: [authJwt, requireRole("SUPER_ADMIN"), validateBody(settingsUpdateSchema)],
    },
    (req, reply) => contentController.updateSettings(req as never, reply)
  );
  app.get(
    "/api/v1/admin/reports/overview",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "CONTENT_ADMIN", "FINANCE_ADMIN", "READ_ONLY"),
      ],
    },
    (req, reply) => contentController.overview(req, reply)
  );
  app.get(
    "/api/v1/admin/submissions/mcq",
    {
      preHandler: [
        authJwt,
        requireRole("SUPER_ADMIN", "CONTENT_ADMIN", "TEST_ADMIN", "READ_ONLY"),
      ],
    },
    (req, reply) => contentController.adminListMcqSubmissions(req, reply)
  );
}
