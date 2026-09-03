import type { FastifyReply, FastifyRequest } from "fastify";
import { programsService } from "./programs.service";
import { contentService } from "../content/content.service";

type Status = "DRAFT" | "ACTIVE" | "INACTIVE";

export class ProgramsController {
  async listActive(_req: FastifyRequest, reply: FastifyReply) {
    const data = await programsService.listActive();
    return reply.send({ data });
  }

  async list(_req: FastifyRequest, reply: FastifyReply) {
    const data = await programsService.list();
    return reply.send({ data });
  }

  async tree(_req: FastifyRequest, reply: FastifyReply) {
    const data = await programsService.tree();
    return reply.send({ data });
  }

  async createProgram(
    req: FastifyRequest<{
      Body: {
        name: string;
        slug?: string;
        description?: string;
        examBoard?: string;
        sortOrder?: number;
        status?: Status;
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.createProgram(req.body);
    return reply.status(201).send({ data });
  }

  async updateProgram(
    req: FastifyRequest<{
      Params: { id: string };
      Body: {
        name?: string;
        slug?: string;
        description?: string;
        examBoard?: string;
        sortOrder?: number;
        status?: Status;
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.updateProgram(req.params.id, req.body);
    return reply.send({ data });
  }

  async createSubject(
    req: FastifyRequest<{
      Body: {
        programId: string;
        name: string;
        blurb?: string;
        iconKey?: string;
        sortOrder?: number;
        status?: Status;
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.createSubject(req.body);
    return reply.status(201).send({ data });
  }

  async updateSubject(
    req: FastifyRequest<{
      Params: { id: string };
      Body: {
        name?: string;
        blurb?: string;
        iconKey?: string;
        sortOrder?: number;
        status?: Status;
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.updateSubject(req.params.id, req.body);
    return reply.send({ data });
  }

  async createTopic(
    req: FastifyRequest<{
      Body: { subjectId: string; name: string; sortOrder?: number; status?: Status };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.createTopic(req.body);
    return reply.status(201).send({ data });
  }

  async updateTopic(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { name?: string; sortOrder?: number; status?: Status };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.updateTopic(req.params.id, req.body);
    return reply.send({ data });
  }

  async createChapter(
    req: FastifyRequest<{
      Body: {
        title: string;
        subject?: string;
        topicId?: string;
        bookId?: string;
        description?: string;
        sortOrder?: number;
        status?: Status;
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await contentService.createChapter(req.body);
    return reply.status(201).send({ data });
  }

  async createCategory(
    req: FastifyRequest<{
      Body: { chapterId: string; name: string; sortOrder?: number; status?: Status };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.createCategory(req.body);
    return reply.status(201).send({ data });
  }

  async updateCategory(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { name?: string; sortOrder?: number; status?: Status };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.updateCategory(req.params.id, req.body);
    return reply.send({ data });
  }

  async createSubcategory(
    req: FastifyRequest<{
      Body: { categoryId: string; name: string; sortOrder?: number; status?: Status };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.createSubcategory(req.body);
    return reply.status(201).send({ data });
  }

  async updateSubcategory(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { name?: string; sortOrder?: number; status?: Status };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.updateSubcategory(req.params.id, req.body);
    return reply.send({ data });
  }

  async listAuthors(_req: FastifyRequest, reply: FastifyReply) {
    const data = await programsService.listAuthors();
    return reply.send({ data });
  }

  async createAuthor(
    req: FastifyRequest<{
      Body: { name: string; slug?: string; bio?: string; sortOrder?: number; status?: Status };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.createAuthor(req.body);
    return reply.status(201).send({ data });
  }

  async updateAuthor(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { name?: string; slug?: string; bio?: string; sortOrder?: number; status?: Status };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.updateAuthor(req.params.id, req.body);
    return reply.send({ data });
  }

  async createBookOnSubject(
    req: FastifyRequest<{
      Params: { id: string };
      Body: {
        authorId?: string;
        authorName?: string;
        title: string;
        slug?: string;
        subtitle?: string | null;
        coverUrl?: string | null;
        price?: number;
        includedInProgram?: boolean;
        sortOrder?: number;
        status?: Status;
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.createBook({ ...req.body, subjectId: req.params.id });
    return reply.status(201).send({ data });
  }

  async updateBook(
    req: FastifyRequest<{
      Params: { id: string };
      Body: {
        authorId?: string;
        authorName?: string;
        title?: string;
        slug?: string;
        subtitle?: string | null;
        coverUrl?: string | null;
        price?: number;
        includedInProgram?: boolean;
        sortOrder?: number;
        status?: Status;
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await programsService.updateBook(req.params.id, req.body);
    return reply.send({ data });
  }
}

export const programsController = new ProgramsController();
