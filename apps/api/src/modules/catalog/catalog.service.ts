import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";
import { walletService } from "../wallet/wallet.service";

type Cta = "study" | "add" | "unlock";

type CatalogCtx = {
  programId: string | null;
  grantedBookIds: Set<string>;
  moduleBookIds: Set<string>;
};

function clampLimit(raw?: string) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 8;
  return Math.min(20, Math.floor(n));
}

function displayPrice(book: { price: { toString(): string } | number; includedInProgram: boolean }, inProgram: boolean) {
  if (inProgram && book.includedInProgram) return 0;
  return Number(book.price);
}

function bookFlags(
  book: { id: string; price: { toString(): string } | number; includedInProgram: boolean; subject: { programId: string } },
  ctx: CatalogCtx
) {
  const inProgram = Boolean(ctx.programId && book.subject.programId === ctx.programId);
  const granted = ctx.grantedBookIds.has(book.id) || ctx.moduleBookIds.has(book.id);
  const price = displayPrice(book, inProgram);
  const entitled = granted || (inProgram && book.includedInProgram);
  let cta: Cta = "unlock";
  if (entitled) cta = "study";
  else if (inProgram && price === 0) cta = "add";
  return { inProgram, granted: entitled, price, cta };
}

export class CatalogService {
  async search(userId: string, qRaw: string, limitRaw?: string) {
    const q = qRaw.trim();
    const limit = clampLimit(limitRaw);
    if (q.length < 2) {
      return { q, books: [], authors: [], subjects: [], chapters: [] };
    }

    const ctx = await this.context(userId);
    const contains = { contains: q, mode: "insensitive" as const };

    const matchingPrograms = await prisma.program.findMany({
      where: { status: "ACTIVE", OR: [{ name: contains }, { slug: contains }] },
      select: { id: true },
    });
    const programIds = matchingPrograms.map((p) => p.id);

    const [books, authors, subjects, chapters] = await Promise.all([
      prisma.book.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { title: contains },
            { subtitle: contains },
            { author: { name: contains } },
            ...(programIds.length ? [{ subject: { programId: { in: programIds } } }] : []),
          ],
        },
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        include: {
          author: { select: { id: true, name: true } },
          subject: {
            select: {
              id: true,
              name: true,
              programId: true,
              program: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.author.findMany({
        where: { status: "ACTIVE", name: contains },
        take: limit,
        orderBy: { name: "asc" },
        select: { id: true, name: true, bio: true },
      }),
      prisma.programSubject.findMany({
        where: {
          status: "ACTIVE",
          OR: [{ name: contains }, ...(programIds.length ? [{ programId: { in: programIds } }] : [])],
        },
        take: limit,
        orderBy: { name: "asc" },
        include: { program: { select: { id: true, name: true } } },
      }),
      prisma.chapter.findMany({
        where: { status: "ACTIVE", title: contains, bookId: { not: null } },
        take: limit,
        orderBy: { title: "asc" },
        include: {
          book: {
            include: {
              author: { select: { name: true } },
              subject: {
                select: {
                  id: true,
                  name: true,
                  programId: true,
                  program: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      q,
      books: books.map((b) => this.toBookHit(b, ctx)),
      authors: authors.map((a) => ({
        id: a.id,
        kind: "author" as const,
        title: a.name,
        subtitle: a.bio,
        program: null,
        inProgram: null,
        price: null,
        granted: false,
        cta: "books" as const,
      })),
      subjects: subjects.map((s) => {
        const inProgram = Boolean(ctx.programId && s.programId === ctx.programId);
        return {
          id: s.id,
          kind: "subject" as const,
          title: s.name,
          subtitle: s.program.name,
          program: s.program.name,
          programId: s.program.id,
          inProgram,
          price: inProgram ? 0 : null,
          granted: inProgram,
          cta: inProgram ? ("study" as const) : ("unlock" as const),
        };
      }),
      chapters: chapters
        .filter((c) => c.book)
        .map((c) => {
          const book = c.book!;
          const flags = bookFlags(book, ctx);
          return {
            id: c.id,
            kind: "chapter" as const,
            title: c.title,
            subtitle: `${book.title} · ${book.author.name} · ${book.subject.program.name}`,
            program: book.subject.program.name,
            bookId: book.id,
            subjectId: book.subject.id,
            inProgram: flags.inProgram,
            price: flags.price,
            granted: flags.granted,
            cta: flags.cta,
          };
        }),
    };
  }

  async authorBooks(userId: string, authorId: string) {
    const author = await prisma.author.findUnique({
      where: { id: authorId },
      select: { id: true, name: true, bio: true, status: true },
    });
    if (!author || author.status !== "ACTIVE") throw new AppError("NOT_FOUND", "Author not found", 404);
    const ctx = await this.context(userId);
    const books = await prisma.book.findMany({
      where: { authorId, status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: {
        author: { select: { id: true, name: true } },
        subject: {
          select: {
            id: true,
            name: true,
            programId: true,
            program: { select: { id: true, name: true } },
          },
        },
      },
    });
    return {
      author: { id: author.id, name: author.name, bio: author.bio },
      books: books.map((b) => this.toBookHit(b, ctx)),
    };
  }

  async bookDetail(userId: string, bookId: string) {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        author: { select: { id: true, name: true } },
        subject: {
          select: {
            id: true,
            name: true,
            programId: true,
            program: { select: { id: true, name: true } },
          },
        },
        chapters: {
          where: { status: "ACTIVE" },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
          select: {
            id: true,
            title: true,
            _count: { select: { mcqs: true, flashCards: true } },
          },
        },
      },
    });
    if (!book || book.status !== "ACTIVE") throw new AppError("NOT_FOUND", "Book not found", 404);
    const ctx = await this.context(userId);
    const hit = this.toBookHit(book, ctx);
    return {
      ...hit,
      chapters: book.chapters.map((c) => ({
        id: c.id,
        title: c.title,
        mcqCount: c._count.mcqs,
        flashCount: c._count.flashCards,
      })),
    };
  }

  async unlock(userId: string, bookId: string) {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        subject: { select: { id: true, programId: true } },
        chapters: {
          where: { status: "ACTIVE" },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
          select: { id: true },
        },
      },
    });
    if (!book || book.status !== "ACTIVE") throw new AppError("NOT_FOUND", "Book not found", 404);

    const curriculum = await prisma.studentCurriculum.findUnique({ where: { userId } });
    if (!curriculum) {
      throw new AppError("CURRICULUM_REQUIRED", "Finish curriculum setup before adding books", 400);
    }

    const inProgram = book.subject.programId === curriculum.programId;
    const price = displayPrice(book, inProgram);
    const key = `book-unlock:${userId}:${bookId}`;

    const existingGrant = await prisma.studentContentGrant.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });

    if (!existingGrant) {
      let ledgerId: string | null = null;
      let amountPaid = 0;
      let source = "PROMO";
      if (price > 0) {
        await walletService.debitSpendable({
          userId,
          amount: price,
          type: "BOOK_UNLOCK",
          idempotencyKey: key,
          reference: bookId,
        });
        const ledger = await prisma.walletLedger.findUnique({ where: { idempotencyKey: key } });
        ledgerId = ledger?.id ?? null;
        amountPaid = price;
        source = "WALLET";
      }
      await prisma.studentContentGrant.upsert({
        where: { userId_bookId: { userId, bookId } },
        create: { userId, bookId, source, amountPaid, ledgerId },
        update: {},
      });
    }

    const modulesAdded = await this.appendBookModules(curriculum.id, book.subject.id, book.chapters);
    const grant = await prisma.studentContentGrant.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });
    return {
      granted: true as const,
      amountPaid: Number(grant?.amountPaid ?? 0),
      alreadyGranted: Boolean(existingGrant),
      modulesAdded,
      rewards: null,
    };
  }

  private async appendBookModules(
    curriculumId: string,
    subjectId: string,
    chapters: Array<{ id: string }>
  ) {
    if (chapters.length === 0) return 0;
    const existing = await prisma.curriculumModule.findMany({
      where: { curriculumId, chapterId: { in: chapters.map((c) => c.id) } },
      select: { chapterId: true },
    });
    const have = new Set(existing.map((e) => e.chapterId));
    const missing = chapters.filter((c) => !have.has(c.id));
    if (missing.length === 0) return 0;
    const agg = await prisma.curriculumModule.aggregate({
      where: { curriculumId },
      _max: { sortOrder: true },
    });
    let sort = (agg._max.sortOrder ?? -1) + 1;
    await prisma.curriculumModule.createMany({
      data: missing.map((c) => ({
        curriculumId,
        chapterId: c.id,
        subjectId,
        sortOrder: sort++,
      })),
      skipDuplicates: true,
    });
    return missing.length;
  }

  private toBookHit(
    book: {
      id: string;
      title: string;
      subtitle: string | null;
      coverUrl: string | null;
      price: { toString(): string } | number;
      includedInProgram: boolean;
      author: { id: string; name: string };
      subject: { id: string; name: string; programId: string; program: { id: string; name: string } };
    },
    ctx: CatalogCtx
  ) {
    const flags = bookFlags(book, ctx);
    return {
      id: book.id,
      kind: "book" as const,
      title: book.title,
      subtitle: `${book.author.name} · ${book.subject.program.name} · ${book.subject.name}`,
      authorId: book.author.id,
      authorName: book.author.name,
      program: book.subject.program.name,
      programId: book.subject.program.id,
      subjectId: book.subject.id,
      subjectName: book.subject.name,
      coverUrl: book.coverUrl,
      includedInProgram: book.includedInProgram,
      inProgram: flags.inProgram,
      price: flags.price,
      granted: flags.granted,
      cta: flags.cta,
    };
  }

  private async context(userId: string): Promise<CatalogCtx> {
    const [curriculum, grants] = await Promise.all([
      prisma.studentCurriculum.findUnique({
        where: { userId },
        select: {
          programId: true,
          modules: { select: { chapter: { select: { bookId: true } } } },
        },
      }),
      prisma.studentContentGrant.findMany({
        where: { userId },
        select: { bookId: true },
      }),
    ]);
    const moduleBookIds = new Set(
      (curriculum?.modules ?? [])
        .map((m) => m.chapter.bookId)
        .filter((id): id is string => Boolean(id))
    );
    return {
      programId: curriculum?.programId ?? null,
      grantedBookIds: new Set(grants.map((g) => g.bookId)),
      moduleBookIds,
    };
  }
}

export const catalogService = new CatalogService();
