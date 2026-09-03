import type { FastifyInstance } from "fastify";
import { authJwt } from "../../shared/middleware/auth";
import { catalogController } from "./catalog.controller";

export async function catalogRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/search",
    { preHandler: [authJwt] },
    (req, reply) => catalogController.search(req as never, reply)
  );
  app.get(
    "/api/v1/catalog/authors/:id/books",
    { preHandler: [authJwt] },
    (req, reply) => catalogController.authorBooks(req as never, reply)
  );
  app.get(
    "/api/v1/catalog/books/:id",
    { preHandler: [authJwt] },
    (req, reply) => catalogController.bookDetail(req as never, reply)
  );
  app.post(
    "/api/v1/catalog/books/:id/unlock",
    { preHandler: [authJwt] },
    (req, reply) => catalogController.unlock(req as never, reply)
  );
}
