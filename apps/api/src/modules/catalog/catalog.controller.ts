import type { FastifyReply, FastifyRequest } from "fastify";
import { catalogService } from "./catalog.service";
import { AppError } from "../../shared/errors/app-error";

export class CatalogController {
  async search(req: FastifyRequest<{ Querystring: { q?: string; limit?: string } }>, reply: FastifyReply) {
    const q = req.query.q ?? "";
    const data = await catalogService.search(req.user!.sub, q, req.query.limit);
    return reply.send({ data });
  }

  async authorBooks(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    if (!req.params.id) throw new AppError("VALIDATION_ERROR", "Author id is required", 400);
    const data = await catalogService.authorBooks(req.user!.sub, req.params.id);
    return reply.send({ data });
  }

  async bookDetail(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    if (!req.params.id) throw new AppError("VALIDATION_ERROR", "Book id is required", 400);
    const data = await catalogService.bookDetail(req.user!.sub, req.params.id);
    return reply.send({ data });
  }

  async unlock(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    if (!req.params.id) throw new AppError("VALIDATION_ERROR", "Book id is required", 400);
    const data = await catalogService.unlock(req.user!.sub, req.params.id);
    return reply.send({ data });
  }
}

export const catalogController = new CatalogController();
