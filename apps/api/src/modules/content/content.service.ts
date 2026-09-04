import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";
import { settingsService } from "../settings/settings.service";
import { rewardsService } from "../rewards/rewards.service";
import { walletService } from "../wallet/wallet.service";
import type { Prisma } from "@prisma/client";
import {
  ImportPathResolver,
  isPathResolveError,
  type PathDraft,
} from "./import-path";
import {
  chunk,
  mapBookImportRows,
  mapFlashImportRows,
  mapMcqImportRows,
  parseSpreadsheetBuffer,
  type BookImportDraft,
  type RowError,
} from "./import-parse";

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfIstDay(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value;
  return new Date(`${pick("year")}-${pick("month")}-${pick("day")}T00:00:00+05:30`);
}

type ContentStatus = "DRAFT" | "ACTIVE" | "INACTIVE";

type WriteOpts = {
  defaultChapterId?: string;
  createMissingPath?: boolean;
  collectErrors?: boolean;
};

type PathItem = PathDraft & {
  row?: number;
  subject?: string;
  topic?: string;
  difficulty?: string;
  status?: ContentStatus;
};

function dupScopeKey(row: {
  chapterId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  text: string;
}) {
  const scope = row.subcategoryId || row.categoryId || row.chapterId || "";
  return `${scope}::${row.text.trim().toLowerCase()}`;
}

type McqListOpts = {
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
  take?: number;
};

function clampTake(value: number | undefined, fallback: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

function encodeMcqCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

function decodeMcqCursor(raw?: string) {
  if (!raw) return null;
  try {
    const [iso, id] = Buffer.from(raw, "base64url").toString("utf8").split("|");
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export class ContentService {
  private async subjectFromTopic(topicId: string) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { subject: true },
    });
    if (!topic) throw new AppError("NOT_FOUND", "Topic not found", 404);
    return topic;
  }

  async createChapter(input: {
    title: string;
    subject?: string;
    topicId?: string;
    bookId?: string;
    description?: string;
    sortOrder?: number;
    status?: ContentStatus;
  }) {
    let subject = input.subject;
    if (input.topicId) {
      const topic = await this.subjectFromTopic(input.topicId);
      subject = subject ?? topic.subject.name;
    }
    if (input.bookId) {
      const book = await prisma.book.findUnique({
        where: { id: input.bookId },
        include: { subject: { select: { name: true } } },
      });
      if (!book) throw new AppError("NOT_FOUND", "Book not found", 404);
      subject = subject ?? book.subject.name;
    }
    if (!subject) throw new AppError("VALIDATION_ERROR", "subject, topicId, or bookId is required", 400);
    return prisma.chapter.create({
      data: {
        title: input.title,
        subject,
        topicId: input.topicId,
        bookId: input.bookId,
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
        status: input.status ?? "ACTIVE",
      },
    });
  }

  async updateChapter(
    id: string,
    input: {
      title?: string;
      subject?: string;
      topicId?: string | null;
      bookId?: string | null;
      description?: string | null;
      sortOrder?: number;
      status?: ContentStatus;
    }
  ) {
    const existing = await prisma.chapter.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Chapter not found", 404);
    let subject = input.subject;
    if (input.topicId) {
      const topic = await this.subjectFromTopic(input.topicId);
      subject = subject ?? topic.subject.name;
    }
    if (input.bookId) {
      const book = await prisma.book.findUnique({
        where: { id: input.bookId },
        include: { subject: { select: { name: true } } },
      });
      if (!book) throw new AppError("NOT_FOUND", "Book not found", 404);
      subject = subject ?? book.subject.name;
    }
    return prisma.chapter.update({
      where: { id },
      data: { ...input, subject: subject ?? undefined },
    });
  }

  async listChapters() {
    const chapters = await prisma.chapter.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { mcqs: true, flashCards: true } },
      },
    });
    return chapters.map((c) => ({
      id: c.id,
      title: c.title,
      subject: c.subject,
      description: c.description,
      sortOrder: c.sortOrder,
      status: c.status,
      createdAt: c.createdAt,
      mcqCount: c._count.mcqs,
      flashCardCount: c._count.flashCards,
    }));
  }

  async getChapter(id: string) {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        _count: { select: { mcqs: true, flashCards: true } },
      },
    });
    if (!chapter) throw new AppError("NOT_FOUND", "Chapter not found", 404);
    return {
      id: chapter.id,
      title: chapter.title,
      subject: chapter.subject,
      description: chapter.description,
      sortOrder: chapter.sortOrder,
      status: chapter.status,
      createdAt: chapter.createdAt,
      mcqCount: chapter._count.mcqs,
      flashCardCount: chapter._count.flashCards,
    };
  }

  private async assertChapter(chapterId: string) {
    const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new AppError("CHAPTER_NOT_FOUND", "Chapter not found", 404);
    return chapter;
  }

  async createFlashCards(
    items: Array<
      PathItem & {
        front: string;
        back: string;
      }
    >,
    opts: WriteOpts = {}
  ) {
    const resolver = new ImportPathResolver(opts.createMissingPath !== false);
    const errors: RowError[] = [];
    const prepared: Array<{
      front: string;
      back: string;
      chapterId: string;
      categoryId?: string;
      subcategoryId?: string;
      subject?: string;
      topic?: string;
      difficulty?: string;
      status: ContentStatus;
    }> = [];

    for (const [index, item] of items.entries()) {
      const row = item.row ?? index + 1;
      try {
        const path = await resolver.resolve(item, opts.defaultChapterId);
        prepared.push({
          front: item.front,
          back: item.back,
          chapterId: path.chapterId,
          categoryId: path.categoryId,
          subcategoryId: path.subcategoryId,
          subject: item.subject ?? path.subjectName,
          topic: item.topic,
          difficulty: item.difficulty,
          status: item.status ?? "ACTIVE",
        });
      } catch (error) {
        if (isPathResolveError(error) || error instanceof AppError) {
          errors.push({ row, message: (error as Error).message });
          continue;
        }
        throw error;
      }
    }

    const unique: typeof prepared = [];
    let skipped = 0;
    for (const slice of chunk(prepared, 40)) {
      const existing = await prisma.flashCard.findMany({
        where: {
          OR: slice.map((i) => ({
            front: { equals: i.front, mode: "insensitive" as const },
            ...(i.subcategoryId
              ? { subcategoryId: i.subcategoryId }
              : i.categoryId
                ? { categoryId: i.categoryId }
                : { chapterId: i.chapterId }),
          })),
        },
        select: { front: true, chapterId: true, categoryId: true, subcategoryId: true },
      });
      const seen = new Set(
        existing.map((r) =>
          dupScopeKey({ ...r, text: r.front })
        )
      );
      for (const i of slice) {
        const k = dupScopeKey({ ...i, text: i.front });
        if (seen.has(k)) {
          skipped += 1;
          continue;
        }
        seen.add(k);
        unique.push(i);
      }
    }

    const data =
      unique.length === 0
        ? { count: 0 }
        : await prisma.flashCard.createMany({ data: unique });

    if (!opts.collectErrors && items.length === 1 && data.count === 0 && skipped === 0 && errors[0]) {
      throw new AppError("VALIDATION_ERROR", errors[0].message, 400);
    }
    return { created: data.count, skipped, errors };
  }

  async listFlashCards(opts?: { chapterId?: string; take?: number }) {
    return prisma.flashCard.findMany({
      where: opts?.chapterId ? { chapterId: opts.chapterId } : undefined,
      orderBy: { createdAt: "desc" },
      take: opts?.take ?? 200,
      include: {
        chapter: { select: { id: true, title: true, subject: true } },
      },
    });
  }

  async createMcqs(
    items: Array<
      PathItem & {
        question: string;
        optionA: string;
        optionB: string;
        optionC: string;
        optionD: string;
        correctOption: string;
        explanation?: string;
      }
    >,
    opts: WriteOpts = {}
  ) {
    const resolver = new ImportPathResolver(opts.createMissingPath !== false);
    const errors: RowError[] = [];
    const prepared: Array<{
      question: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: string;
      chapterId: string;
      categoryId?: string;
      subcategoryId?: string;
      explanation?: string;
      subject?: string;
      topic?: string;
      difficulty?: string;
      status: ContentStatus;
    }> = [];

    for (const [index, item] of items.entries()) {
      const row = item.row ?? index + 1;
      try {
        const path = await resolver.resolve(item, opts.defaultChapterId);
        prepared.push({
          question: item.question,
          optionA: item.optionA,
          optionB: item.optionB,
          optionC: item.optionC,
          optionD: item.optionD,
          correctOption: item.correctOption,
          chapterId: path.chapterId,
          categoryId: path.categoryId,
          subcategoryId: path.subcategoryId,
          explanation: item.explanation,
          subject: item.subject ?? path.subjectName,
          topic: item.topic,
          difficulty: item.difficulty,
          status: item.status ?? "ACTIVE",
        });
      } catch (error) {
        if (isPathResolveError(error) || error instanceof AppError) {
          errors.push({ row, message: (error as Error).message });
          continue;
        }
        throw error;
      }
    }

    const unique: typeof prepared = [];
    let skipped = 0;
    for (const slice of chunk(prepared, 40)) {
      const existing = await prisma.mcq.findMany({
        where: {
          OR: slice.map((i) => ({
            question: { equals: i.question, mode: "insensitive" as const },
            ...(i.subcategoryId
              ? { subcategoryId: i.subcategoryId }
              : i.categoryId
                ? { categoryId: i.categoryId }
                : { chapterId: i.chapterId }),
          })),
        },
        select: { question: true, chapterId: true, categoryId: true, subcategoryId: true },
      });
      const seen = new Set(existing.map((r) => dupScopeKey({ ...r, text: r.question })));
      for (const i of slice) {
        const k = dupScopeKey({ ...i, text: i.question });
        if (seen.has(k)) {
          skipped += 1;
          continue;
        }
        seen.add(k);
        unique.push(i);
      }
    }

    const data =
      unique.length === 0
        ? { count: 0 }
        : await prisma.mcq.createMany({ data: unique });

    if (!opts.collectErrors && items.length === 1 && data.count === 0 && skipped === 0 && errors[0]) {
      throw new AppError("VALIDATION_ERROR", errors[0].message, 400);
    }
    return { created: data.count, skipped, errors };
  }

  async createBooks(
    items: BookImportDraft[],
    opts: Pick<WriteOpts, "createMissingPath" | "collectErrors"> = {}
  ) {
    const resolver = new ImportPathResolver(opts.createMissingPath !== false);
    const errors: RowError[] = [];
    const questions: Array<
      BookImportDraft & {
        question: string;
        optionA: string;
        optionB: string;
        optionC: string;
        optionD: string;
        correctOption: "A" | "B" | "C" | "D";
      }
    > = [];
    let created = 0;
    let skipped = 0;
    let categoriesCreated = 0;
    let subcategoriesCreated = 0;
    for (const item of items) {
      try {
        const book = await resolver.importBook(item);
        if (book.created) created += 1;
        else skipped += 1;
        categoriesCreated += book.categoriesCreated;
        subcategoriesCreated += book.subcategoriesCreated;
        if (item.question && item.optionA && item.optionB && item.optionC && item.optionD && item.correctOption) {
          questions.push({
            ...item,
            question: item.question,
            optionA: item.optionA,
            optionB: item.optionB,
            optionC: item.optionC,
            optionD: item.optionD,
            correctOption: item.correctOption,
          });
        }
      } catch (error) {
        const message = isPathResolveError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not import book";
        if (!opts.collectErrors) throw new AppError("VALIDATION_ERROR", message, 400);
        errors.push({ row: item.row ?? 0, message });
      }
    }
    let questionsCreated = 0;
    let questionsSkipped = 0;
    if (questions.length) {
      for (const batch of chunk(questions, 500)) {
        const result = await this.createMcqs(batch, {
          createMissingPath: opts.createMissingPath,
          collectErrors: true,
        });
        questionsCreated += result.created;
        questionsSkipped += result.skipped;
        errors.push(...result.errors);
      }
    }
    return {
      created,
      skipped,
      categoriesCreated,
      subcategoriesCreated,
      questionsCreated,
      questionsSkipped,
      errors,
    };
  }

  async importSpreadsheet(input: {
    buffer: Buffer;
    filename: string;
    kind: "mcq" | "flash" | "book";
    defaultChapterId?: string;
    createMissingPath?: boolean;
  }) {
    let rows: Awaited<ReturnType<typeof parseSpreadsheetBuffer>>;
    try {
      rows = await parseSpreadsheetBuffer(input.buffer, input.filename);
    } catch (error) {
      throw new AppError(
        "VALIDATION_ERROR",
        error instanceof Error ? error.message : "Could not parse file",
        400
      );
    }
    if (rows.length === 0) {
      throw new AppError("VALIDATION_ERROR", "No data rows found in that file", 400);
    }
    if (rows.length > 20_000) {
      throw new AppError(
        "VALIDATION_ERROR",
        `File has ${rows.length} rows; split into files of 20,000 or fewer`,
        400
      );
    }

    const errors: RowError[] = [];
    let created = 0;
    let skipped = 0;
    const opts: WriteOpts = {
      defaultChapterId: input.defaultChapterId,
      createMissingPath: input.createMissingPath !== false,
      collectErrors: true,
    };

    if (input.kind === "mcq") {
      const mapped = mapMcqImportRows(rows, input.defaultChapterId);
      errors.push(...mapped.errors);
      for (const batch of chunk(mapped.items, 500)) {
        const result = await this.createMcqs(batch, opts);
        created += result.created;
        skipped += result.skipped;
        errors.push(...result.errors);
      }
    } else if (input.kind === "flash") {
      const mapped = mapFlashImportRows(rows, input.defaultChapterId);
      errors.push(...mapped.errors);
      for (const batch of chunk(mapped.items, 500)) {
        const result = await this.createFlashCards(batch, opts);
        created += result.created;
        skipped += result.skipped;
        errors.push(...result.errors);
      }
    } else {
      const mapped = mapBookImportRows(rows);
      errors.push(...mapped.errors);
      let questionsCreated = 0;
      let questionsSkipped = 0;
      let categoriesCreated = 0;
      let subcategoriesCreated = 0;
      for (const batch of chunk(mapped.items, 500)) {
        const result = await this.createBooks(batch, opts);
        created += result.created;
        skipped += result.skipped;
        questionsCreated += result.questionsCreated;
        questionsSkipped += result.questionsSkipped;
        categoriesCreated += result.categoriesCreated;
        subcategoriesCreated += result.subcategoriesCreated;
        errors.push(...result.errors);
      }
      return {
        created,
        skipped,
        questionsCreated,
        questionsSkipped,
        categoriesCreated,
        subcategoriesCreated,
        errors: errors.slice(0, 100),
        errorCount: errors.length,
        rowCount: rows.length,
      };
    }

    return {
      created,
      skipped,
      errors: errors.slice(0, 100),
      errorCount: errors.length,
      rowCount: rows.length,
    };
  }

  async listMcqs(opts: McqListOpts = {}) {
    const take = clampTake(opts.take, 50, 100);
    const filters = this.mcqWhere(opts);
    const cursor = decodeMcqCursor(opts.cursor);
    const where: Prisma.McqWhereInput = cursor
      ? {
          AND: [
            filters,
            {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            },
          ],
        }
      : filters;

    const [totalInFilter, rows] = await Promise.all([
      prisma.mcq.count({ where: filters }),
      prisma.mcq.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
        select: {
          id: true,
          question: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          correctOption: true,
          explanation: true,
          subject: true,
          topic: true,
          difficulty: true,
          status: true,
          chapterId: true,
          createdAt: true,
          chapter: { select: { id: true, title: true, subject: true } },
        },
      }),
    ]);

    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === take && last ? encodeMcqCursor(last.createdAt, last.id) : null;
    return { items: rows, nextCursor, totalInFilter };
  }

  async listMcqIds(opts: McqListOpts & { random?: boolean } = {}) {
    const take = clampTake(opts.take, 200, 200);
    const where = this.mcqWhere(opts);
    const totalInFilter = await prisma.mcq.count({ where });
    if (totalInFilter === 0) {
      return { ids: [] as string[], items: [] as { id: string; question: string }[], totalInFilter };
    }

    const select = { id: true, question: true } as const;
    if (opts.random) {
      const span = Math.max(0, totalInFilter - take);
      const skip = span === 0 ? 0 : Math.floor(Math.random() * (span + 1));
      const rows = await prisma.mcq.findMany({
        where,
        skip,
        take,
        select,
        orderBy: { id: "asc" },
      });
      return { ids: rows.map((r) => r.id), items: rows, totalInFilter };
    }

    const rows = await prisma.mcq.findMany({
      where,
      take,
      select,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return { ids: rows.map((r) => r.id), items: rows, totalInFilter };
  }

  async mcqPickerOptions(opts: {
    programId?: string;
    subjectId?: string;
    bookId?: string;
    chapterId?: string;
    categoryId?: string;
  }) {
    const empty = <T,>(items: T[] = []) => Promise.resolve(items);

    const [programs, subjects, books, chapters, categories, subcategories] = await Promise.all([
      prisma.program.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true },
      }),
      opts.programId
        ? prisma.programSubject.findMany({
            where: { programId: opts.programId },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true },
          })
        : empty<{ id: string; name: string }>(),
      opts.subjectId
        ? prisma.book.findMany({
            where: { subjectId: opts.subjectId },
            orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
            select: {
              id: true,
              title: true,
              author: { select: { name: true } },
            },
          })
        : empty<{ id: string; title: string; author: { name: string } }>(),
      opts.bookId
        ? prisma.chapter.findMany({
            where: { bookId: opts.bookId },
            orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
            select: { id: true, title: true },
          })
        : empty<{ id: string; title: string }>(),
      opts.chapterId
        ? prisma.category.findMany({
            where: { chapterId: opts.chapterId },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true, chapter: { select: { title: true } } },
          })
        : opts.bookId
          ? prisma.category.findMany({
              where: { chapter: { bookId: opts.bookId } },
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
              select: { id: true, name: true, chapter: { select: { title: true } } },
            })
          : empty<{ id: string; name: string; chapter: { title: string } | null }>(),
      opts.categoryId
        ? prisma.subcategory.findMany({
            where: { categoryId: opts.categoryId },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true },
          })
        : empty<{ id: string; name: string }>(),
    ]);

    return {
      programs,
      subjects,
      books: books.map((b) => ({
        id: b.id,
        name: b.title,
        authorName: b.author.name,
      })),
      chapters: chapters.map((c) => ({ id: c.id, name: c.title })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.chapter ? `${c.name} (${c.chapter.title})` : c.name,
      })),
      subcategories,
    };
  }

  private mcqWhere(opts: McqListOpts): Prisma.McqWhereInput {
    const where: Prisma.McqWhereInput = {};
    if (opts.subcategoryId) where.subcategoryId = opts.subcategoryId;
    else if (opts.categoryId) where.categoryId = opts.categoryId;
    else if (opts.chapterId) where.chapterId = opts.chapterId;
    else if (opts.bookId) where.chapter = { bookId: opts.bookId };
    else if (opts.subjectId) where.chapter = { book: { subjectId: opts.subjectId } };
    else if (opts.programId) where.chapter = { book: { subject: { programId: opts.programId } } };

    if (opts.q?.trim()) {
      where.question = { contains: opts.q.trim(), mode: "insensitive" };
    }
    if (opts.difficulty?.trim()) {
      where.difficulty = opts.difficulty.trim();
    }
    if (opts.status === "DRAFT" || opts.status === "ACTIVE" || opts.status === "INACTIVE") {
      where.status = opts.status;
    }
    return where;
  }

  private async remainingQuota(userId: string, kind: "flash" | "mcq") {
    const settings = await settingsService.get();
    const freePerDay = kind === "flash" ? settings.flashFreePerDay : settings.mcqFreePerDay;
    const dayStart = kind === "flash" ? startOfIstDay() : startOfUtcDay();

    const usedFree =
      kind === "flash"
        ? await prisma.flashCardReview.count({
            where: { userId, createdAt: { gte: dayStart } },
          })
        : await prisma.mcqAttempt.count({
            where: { userId, attemptedAt: { gte: dayStart } },
          });

    const unlock = await prisma.contentUnlock.findFirst({
      where: { userId, kind, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    const freeLeft = Math.max(0, freePerDay - usedFree);
    return {
      freeLeft,
      paidActive: Boolean(unlock),
      paidQuota: unlock?.quota ?? 0,
      unlockExpiresAt: unlock?.expiresAt?.toISOString() ?? null,
      settings,
    };
  }

  private async flashGoal(userId: string) {
    const settings = await settingsService.get();
    const ratedToday = await prisma.flashCardReview.count({
      where: { userId, createdAt: { gte: startOfIstDay() } },
    });
    return { ratedToday, dailyGoal: settings.flashDailyGoal };
  }

  private inChapterIds(ids: string[]) {
    return { in: ids.length > 0 ? ids : ["__none__"] };
  }

  private async entitledChapterIds(userId: string): Promise<Set<string>> {
    const ids = new Set<string>();
    const curriculum = await prisma.studentCurriculum.findUnique({
      where: { userId },
      select: {
        programId: true,
        modules: { select: { chapterId: true } },
      },
    });
    for (const m of curriculum?.modules ?? []) ids.add(m.chapterId);

    const grants = await prisma.studentContentGrant.findMany({
      where: { userId },
      select: { bookId: true },
    });
    if (grants.length > 0) {
      const grantedChapters = await prisma.chapter.findMany({
        where: { status: "ACTIVE", bookId: { in: grants.map((g) => g.bookId) } },
        select: { id: true },
      });
      for (const c of grantedChapters) ids.add(c.id);
    }

    if (curriculum?.programId) {
      const included = await prisma.chapter.findMany({
        where: {
          status: "ACTIVE",
          book: {
            status: "ACTIVE",
            includedInProgram: true,
            subject: { programId: curriculum.programId },
          },
        },
        select: { id: true },
      });
      for (const c of included) ids.add(c.id);
    }
    return ids;
  }

  private async chapterScope(
    userId: string,
    opts?: { chapterId?: string; subjectId?: string }
  ): Promise<{ chapterId?: string | { in: string[] } }> {
    const entitled = await this.entitledChapterIds(userId);

    if (opts?.chapterId) {
      const chapter = await prisma.chapter.findUnique({ where: { id: opts.chapterId } });
      if (!chapter) throw new AppError("NOT_FOUND", "Chapter not found", 404);
      if (!entitled.has(opts.chapterId)) {
        throw new AppError("FORBIDDEN", "This chapter is not in your study set", 403);
      }
      return { chapterId: opts.chapterId };
    }
    if (opts?.subjectId) {
      const subject = await prisma.programSubject.findUnique({ where: { id: opts.subjectId } });
      if (!subject) throw new AppError("NOT_FOUND", "Subject not found", 404);
      const chapters = await prisma.chapter.findMany({
        where: {
          OR: [
            { topic: { subjectId: opts.subjectId } },
            { book: { subjectId: opts.subjectId } },
            { subject: subject.name },
          ],
        },
        select: { id: true },
      });
      return { chapterId: this.inChapterIds(chapters.map((c) => c.id).filter((id) => entitled.has(id))) };
    }

    return { chapterId: this.inChapterIds([...entitled]) };
  }

  private toFlashCard(card: {
    id: string;
    front: string;
    back: string;
    subject: string | null;
    topic: string | null;
    chapterId: string | null;
    chapter?: { id: string; title: string; subject: string } | null;
  }) {
    return {
      id: card.id,
      front: card.front,
      back: card.back,
      subject: card.subject ?? card.chapter?.subject ?? null,
      topic: card.topic,
      chapterId: card.chapterId,
      chapterTitle: card.chapter?.title ?? null,
    };
  }

  async nextFlashCard(
    userId: string,
    opts?: { excludeId?: string; chapterId?: string; subjectId?: string }
  ) {
    const scope = await this.chapterScope(userId, opts);
    const excludeId = opts?.excludeId;
    const now = new Date();
    const include = { chapter: { select: { id: true, title: true, subject: true } } } as const;
    const flashWhere: Prisma.FlashCardWhereInput = { status: "ACTIVE", ...scope };
    const notCurrent = excludeId ? { id: { not: excludeId } } : {};
    const notCurrentView = excludeId ? { flashCardId: { not: excludeId } } : {};

    const dueReviews = await prisma.flashCardReview.findMany({
      where: {
        userId,
        flashCard: { ...flashWhere, ...notCurrent },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { flashCard: { include } },
    });
    const latest = new Map<string, (typeof dueReviews)[number]>();
    for (const row of dueReviews) {
      if (!latest.has(row.flashCardId)) latest.set(row.flashCardId, row);
    }
    const due = [...latest.values()].find((row) => row.dueAt <= now);

    let card = due?.flashCard ?? null;
    if (!card) {
      card = await prisma.flashCard.findFirst({
        where: {
          ...flashWhere,
          ...notCurrent,
          reviews: { none: { userId } },
          views: { none: { userId } },
        },
        orderBy: { createdAt: "asc" },
        include,
      });
    }
    if (!card) {
      const row = await prisma.flashCardView.findFirst({
        where: {
          userId,
          ...notCurrentView,
          flashCard: { ...flashWhere, reviews: { none: { userId } } },
        },
        orderBy: { viewedAt: "asc" },
        include: { flashCard: { include } },
      });
      card = row?.flashCard ?? null;
    }
    if (!card) {
      const row = await prisma.flashCardView.findFirst({
        where: { userId, ...notCurrentView, flashCard: flashWhere },
        orderBy: { viewedAt: "asc" },
        include: { flashCard: { include } },
      });
      card = row?.flashCard ?? null;
    }
    if (!card) {
      card = await prisma.flashCard.findFirst({
        where: { ...flashWhere, ...notCurrent },
        orderBy: { createdAt: "asc" },
        include,
      });
    }
    if (!card) {
      card = await prisma.flashCard.findFirst({
        where: flashWhere,
        orderBy: { createdAt: "asc" },
        include,
      });
    }
    if (!card) throw new AppError("NO_CONTENT", "No flash cards in this scope", 404);

    await prisma.flashCardView.upsert({
      where: { userId_flashCardId: { userId, flashCardId: card.id } },
      create: { userId, flashCardId: card.id },
      update: { viewedAt: new Date() },
    });

    const [quota, goal] = await Promise.all([this.remainingQuota(userId, "flash"), this.flashGoal(userId)]);
    return {
      card: this.toFlashCard(card),
      quota: {
        freeLeft: quota.freeLeft,
        paidActive: quota.paidActive,
        unlockExpiresAt: quota.unlockExpiresAt,
        unlockPrice: quota.settings.flashUnlockPrice,
      },
      goal,
    };
  }

  async reviewFlashCard(userId: string, flashCardId: string, rating: "EASY" | "HARD") {
    const quota = await this.remainingQuota(userId, "flash");
    if (quota.freeLeft <= 0 && !quota.paidActive) {
      throw new AppError("QUOTA_EXCEEDED", "Daily free flash reviews used. Unlock to continue.", 402, {
        unlockPrice: quota.settings.flashUnlockPrice,
        paidQuota: quota.settings.flashPaidQuota,
      });
    }

    const card = await prisma.flashCard.findUnique({
      where: { id: flashCardId },
      include: { chapter: { select: { id: true, title: true, subject: true } } },
    });
    if (!card || card.status !== "ACTIVE") {
      throw new AppError("NOT_FOUND", "Flash card not found", 404);
    }

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + (rating === "EASY" ? 3 : 1));

    const review = await prisma.flashCardReview.create({
      data: { userId, flashCardId, rating, dueAt },
    });
    const rewards = await rewardsService.afterFlash(userId, review.id);

    const [nextQuota, goal] = await Promise.all([
      this.remainingQuota(userId, "flash"),
      this.flashGoal(userId),
    ]);
    return {
      rating,
      dueAt: dueAt.toISOString(),
      card: this.toFlashCard(card),
      quota: {
        freeLeft: nextQuota.freeLeft,
        paidActive: nextQuota.paidActive,
        unlockExpiresAt: nextQuota.unlockExpiresAt,
        unlockPrice: nextQuota.settings.flashUnlockPrice,
      },
      goal,
      rewards,
    };
  }

  async unlockFlash(userId: string) {
    const settings = await settingsService.get();
    await walletService.debitDeposited({
      userId,
      amount: settings.flashUnlockPrice,
      type: "FLASH_UNLOCK",
      idempotencyKey: `flash-unlock:${userId}:${Date.now()}`,
    });
    const expiresAt = new Date(Date.now() + settings.flashUnlockHours * 60 * 60 * 1000);
    await prisma.contentUnlock.create({
      data: {
        userId,
        kind: "flash",
        quota: settings.flashPaidQuota,
        expiresAt,
      },
    });
    return { expiresAt: expiresAt.toISOString(), quota: settings.flashPaidQuota };
  }

  async nextMcq(
    userId: string,
    opts?: { excludeId?: string; chapterId?: string; subjectId?: string }
  ) {
    const quota = await this.remainingQuota(userId, "mcq");
    if (quota.freeLeft <= 0 && !quota.paidActive) {
      throw new AppError("QUOTA_EXCEEDED", "Daily free MCQs used. Unlock to continue.", 402, {
        unlockPrice: quota.settings.mcqUnlockPrice,
        paidQuota: quota.settings.mcqPaidQuota,
      });
    }

    const scope = await this.chapterScope(userId, opts);
    const attempted = await prisma.mcqAttempt.findMany({
      where: { userId },
      select: { mcqId: true },
      distinct: ["mcqId"],
    });
    const attemptedIds = attempted.map((a) => a.mcqId);
    const exclude = [opts?.excludeId, ...attemptedIds].filter((id): id is string => Boolean(id));

    let mcq = await prisma.mcq.findFirst({
      where: {
        status: "ACTIVE",
        ...scope,
        ...(exclude.length ? { id: { notIn: exclude } } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: { chapter: { select: { id: true, title: true, subject: true } } },
    });
    if (!mcq) {
      mcq = await prisma.mcq.findFirst({
        where: {
          status: "ACTIVE",
          ...scope,
          ...(opts?.excludeId ? { id: { not: opts.excludeId } } : {}),
        },
        orderBy: { createdAt: "asc" },
        include: { chapter: { select: { id: true, title: true, subject: true } } },
      });
    }
    if (!mcq) throw new AppError("NO_CONTENT", "No MCQs in this scope", 404);

    return {
      mcq: {
        id: mcq.id,
        question: mcq.question,
        optionA: mcq.optionA,
        optionB: mcq.optionB,
        optionC: mcq.optionC,
        optionD: mcq.optionD,
        subject: mcq.subject,
        topic: mcq.topic,
        chapterId: mcq.chapterId,
        chapter: mcq.chapter,
      },
      quota: {
        freeLeft: quota.freeLeft,
        paidActive: quota.paidActive,
        unlockExpiresAt: quota.unlockExpiresAt,
      },
    };
  }

  async answerMcq(userId: string, mcqId: string, selectedOption: string) {
    const quota = await this.remainingQuota(userId, "mcq");
    if (quota.freeLeft <= 0 && !quota.paidActive) {
      throw new AppError("QUOTA_EXCEEDED", "Daily free MCQs used. Unlock to continue.", 402);
    }

    const mcq = await prisma.mcq.findUnique({ where: { id: mcqId } });
    if (!mcq || mcq.status !== "ACTIVE") {
      throw new AppError("NOT_FOUND", "Question not found", 404);
    }

    const isCorrect = mcq.correctOption.toUpperCase() === selectedOption.toUpperCase();
    const attempt = await prisma.mcqAttempt.create({
      data: { userId, mcqId, selectedOption, isCorrect },
    });
    const rewards = await rewardsService.afterMcq(userId, attempt.id, isCorrect);

    const nextQuota = await this.remainingQuota(userId, "mcq");
    return {
      isCorrect,
      correctOption: mcq.correctOption,
      explanation: mcq.explanation,
      quota: {
        freeLeft: nextQuota.freeLeft,
        paidActive: nextQuota.paidActive,
        unlockExpiresAt: nextQuota.unlockExpiresAt,
      },
      rewards,
    };
  }

  async unlockMcq(userId: string) {
    const settings = await settingsService.get();
    await walletService.debitDeposited({
      userId,
      amount: settings.mcqUnlockPrice,
      type: "MCQ_UNLOCK",
      idempotencyKey: `mcq-unlock:${userId}:${Date.now()}`,
    });
    const expiresAt = new Date(Date.now() + settings.mcqUnlockHours * 60 * 60 * 1000);
    await prisma.contentUnlock.create({
      data: {
        userId,
        kind: "mcq",
        quota: settings.mcqPaidQuota,
        expiresAt,
      },
    });
    return { expiresAt: expiresAt.toISOString(), quota: settings.mcqPaidQuota };
  }

  async overviewCounts() {
    const [users, flashCards, mcqs, chapters] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.flashCard.count(),
      prisma.mcq.count(),
      prisma.chapter.count(),
    ]);
    return { users, flashCards, mcqs, chapters };
  }

  async listMcqSubmissions(opts?: { take?: number }) {
    const rows = await prisma.mcqAttempt.findMany({
      orderBy: { attemptedAt: "desc" },
      take: opts?.take ?? 200,
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        mcq: {
          select: {
            id: true,
            question: true,
            correctOption: true,
            chapter: { select: { id: true, title: true, subject: true } },
          },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      email: r.user.email,
      fullName: r.user.fullName,
      mcqId: r.mcqId,
      question: r.mcq.question,
      chapter: r.mcq.chapter,
      selectedOption: r.selectedOption,
      correctOption: r.mcq.correctOption,
      isCorrect: r.isCorrect,
      attemptedAt: r.attemptedAt.toISOString(),
    }));
  }
}

export const contentService = new ContentService();
