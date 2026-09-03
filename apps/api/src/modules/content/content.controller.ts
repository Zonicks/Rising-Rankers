import type { FastifyReply, FastifyRequest } from "fastify";
import "@fastify/multipart";
import { contentService } from "./content.service";
import { settingsService } from "../settings/settings.service";
import { AppError } from "../../shared/errors/app-error";

export class ContentController {
  async nextFlash(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as { excludeId?: string; chapterId?: string; subjectId?: string };
    const data = await contentService.nextFlashCard(req.user!.sub, query);
    return reply.send({ data });
  }

  async unlockFlash(req: FastifyRequest, reply: FastifyReply) {
    const data = await contentService.unlockFlash(req.user!.sub);
    return reply.send({ data });
  }

  async nextMcq(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as { excludeId?: string; chapterId?: string; subjectId?: string };
    const data = await contentService.nextMcq(req.user!.sub, query);
    return reply.send({ data });
  }

  async reviewFlash(
    req: FastifyRequest<{ Params: { id: string }; Body: { rating: "EASY" | "HARD" } }>,
    reply: FastifyReply
  ) {
    const data = await contentService.reviewFlashCard(req.user!.sub, req.params.id, req.body.rating);
    return reply.send({ data });
  }

  async answerMcq(
    req: FastifyRequest<{ Params: { id: string }; Body: { selectedOption: string } }>,
    reply: FastifyReply
  ) {
    const data = await contentService.answerMcq(req.user!.sub, req.params.id, req.body.selectedOption);
    return reply.send({ data });
  }

  async unlockMcq(req: FastifyRequest, reply: FastifyReply) {
    const data = await contentService.unlockMcq(req.user!.sub);
    return reply.send({ data });
  }

  async adminListChapters(_req: FastifyRequest, reply: FastifyReply) {
    const data = await contentService.listChapters();
    return reply.send({ data });
  }

  async adminGetChapter(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const data = await contentService.getChapter(req.params.id);
    return reply.send({ data });
  }

  async adminCreateChapter(
    req: FastifyRequest<{
      Body: {
        title: string;
        subject?: string;
        topicId?: string;
        bookId?: string;
        description?: string;
        sortOrder?: number;
        status?: "DRAFT" | "ACTIVE" | "INACTIVE";
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await contentService.createChapter(req.body);
    return reply.status(201).send({ data });
  }

  async adminUpdateChapter(
    req: FastifyRequest<{
      Params: { id: string };
      Body: {
        title?: string;
        subject?: string;
        topicId?: string | null;
        bookId?: string | null;
        description?: string | null;
        sortOrder?: number;
        status?: "DRAFT" | "ACTIVE" | "INACTIVE";
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await contentService.updateChapter(req.params.id, req.body);
    return reply.send({ data });
  }

  async adminCreateFlash(
    req: FastifyRequest<{ Body: { items?: unknown[]; defaultChapterId?: string; createMissingPath?: boolean } & Record<string, unknown> }>,
    reply: FastifyReply
  ) {
    const body = req.body as {
      items?: Array<never>;
      defaultChapterId?: string;
      createMissingPath?: boolean;
    } & Record<string, unknown>;
    const items = body.items ?? [body];
    const data = await contentService.createFlashCards(items as never, {
      defaultChapterId: body.defaultChapterId,
      createMissingPath: body.createMissingPath,
    });
    return reply.status(201).send({ data });
  }

  async adminListFlash(
    req: FastifyRequest<{ Querystring: { chapterId?: string } }>,
    reply: FastifyReply
  ) {
    const data = await contentService.listFlashCards({
      chapterId: req.query.chapterId,
    });
    return reply.send({ data });
  }

  async adminCreateMcq(
    req: FastifyRequest<{ Body: { items?: unknown[]; defaultChapterId?: string; createMissingPath?: boolean } & Record<string, unknown> }>,
    reply: FastifyReply
  ) {
    const body = req.body as {
      items?: Array<never>;
      defaultChapterId?: string;
      createMissingPath?: boolean;
    } & Record<string, unknown>;
    const items = body.items ?? [body];
    const data = await contentService.createMcqs(items as never, {
      defaultChapterId: body.defaultChapterId,
      createMissingPath: body.createMissingPath,
    });
    return reply.status(201).send({ data });
  }

  async adminCreateBooks(
    req: FastifyRequest<{
      Body: {
        items: Array<{
          program: string;
          subject: string;
          book: string;
          author?: string;
          subtitle?: string;
          price?: number;
          includedInProgram?: boolean;
          chapter?: string;
          row?: number;
        }>;
        createMissingPath?: boolean;
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await contentService.createBooks(req.body.items, {
      createMissingPath: req.body.createMissingPath,
      collectErrors: true,
    });
    return reply.status(201).send({ data });
  }

  async adminImport(req: FastifyRequest<{ Querystring: { kind?: string } }>, reply: FastifyReply) {
    const file = await req.file();
    if (!file) throw new AppError("VALIDATION_ERROR", "file is required", 400);
    const buffer = await file.toBuffer();
    const field = (name: string) => {
      const raw = file.fields?.[name];
      const node = Array.isArray(raw) ? raw[0] : raw;
      if (node && typeof node === "object" && "value" in node) return String(node.value);
      return undefined;
    };
    const kindRaw = (field("kind") ?? req.query.kind ?? "mcq").toLowerCase();
    if (kindRaw !== "mcq" && kindRaw !== "flash" && kindRaw !== "book") {
      throw new AppError("VALIDATION_ERROR", "kind must be mcq, flash, or book", 400);
    }
    const createMissing = field("createMissingPath");
    const data = await contentService.importSpreadsheet({
      buffer,
      filename: file.filename || "upload.csv",
      kind: kindRaw,
      defaultChapterId: field("defaultChapterId") || undefined,
      createMissingPath: createMissing == null ? true : createMissing !== "false" && createMissing !== "0",
    });
    return reply.send({ data });
  }

  async adminListMcq(
    req: FastifyRequest<{
      Querystring: {
        programId?: string;
        subjectId?: string;
        bookId?: string;
        chapterId?: string;
        categoryId?: string;
        subcategoryId?: string;
        q?: string;
        difficulty?: string;
        status?: string;
        cursor?: string;
        take?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    const q = req.query;
    const data = await contentService.listMcqs({
      programId: q.programId,
      subjectId: q.subjectId,
      bookId: q.bookId,
      chapterId: q.chapterId,
      categoryId: q.categoryId,
      subcategoryId: q.subcategoryId,
      q: q.q,
      difficulty: q.difficulty,
      status: q.status,
      cursor: q.cursor,
      take: q.take ? Number(q.take) : undefined,
    });
    return reply.send({ data });
  }

  async adminListMcqIds(
    req: FastifyRequest<{
      Querystring: {
        programId?: string;
        subjectId?: string;
        bookId?: string;
        chapterId?: string;
        categoryId?: string;
        subcategoryId?: string;
        q?: string;
        difficulty?: string;
        status?: string;
        take?: string;
        random?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    const q = req.query;
    const data = await contentService.listMcqIds({
      programId: q.programId,
      subjectId: q.subjectId,
      bookId: q.bookId,
      chapterId: q.chapterId,
      categoryId: q.categoryId,
      subcategoryId: q.subcategoryId,
      q: q.q,
      difficulty: q.difficulty,
      status: q.status,
      take: q.take ? Number(q.take) : undefined,
      random: q.random === "1" || q.random === "true",
    });
    return reply.send({ data });
  }

  async adminMcqPickerOptions(
    req: FastifyRequest<{
      Querystring: {
        programId?: string;
        subjectId?: string;
        bookId?: string;
        chapterId?: string;
        categoryId?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    const data = await contentService.mcqPickerOptions(req.query);
    return reply.send({ data });
  }

  async getSettings(_req: FastifyRequest, reply: FastifyReply) {
    const data = await settingsService.get();
    return reply.send({ data });
  }

  async updateSettings(req: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) {
    const data = await settingsService.update(req.body as never);
    return reply.send({ data });
  }

  async publicGrievance(_req: FastifyRequest, reply: FastifyReply) {
    const settings = await settingsService.get();
    return reply.send({
      data: {
        name: settings.grievanceOfficerName || null,
        email: settings.grievanceOfficerEmail || null,
        phone: settings.grievanceOfficerPhone || null,
      },
    });
  }

  async overview(_req: FastifyRequest, reply: FastifyReply) {
    const data = await contentService.overviewCounts();
    return reply.send({ data });
  }

  async adminListMcqSubmissions(_req: FastifyRequest, reply: FastifyReply) {
    const data = await contentService.listMcqSubmissions();
    return reply.send({ data });
  }
}

export const contentController = new ContentController();
