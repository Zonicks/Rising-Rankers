import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";

type ContentStatus = "DRAFT" | "ACTIVE" | "INACTIVE";

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "program";
}

function emptyToNull(value?: string | null) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function rethrowUnique(error: unknown, message: string): never {
  const code = (error as { code?: string }).code;
  if (code === "P2002") throw new AppError("DUPLICATE", message, 409);
  throw error;
}

export class ProgramsService {
  async list() {
    return prisma.program.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        subjects: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, status: true },
        },
      },
    });
  }

  async listActive() {
    return prisma.program.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        examBoard: true,
        description: true,
      },
    });
  }

  async tree() {
    const programs = await prisma.program.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        subjects: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            books: {
              orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
              include: {
                author: { select: { id: true, name: true, slug: true } },
                chapters: {
                  orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
                  include: {
                    _count: { select: { mcqs: true, flashCards: true } },
                    categories: {
                      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                      include: {
                        subcategories: {
                          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return programs.map((program) => ({
      id: program.id,
      kind: "program" as const,
      name: program.name,
      slug: program.slug,
      examBoard: program.examBoard,
      description: program.description,
      sortOrder: program.sortOrder,
      status: program.status,
      children: program.subjects.map((subject) => ({
        id: subject.id,
        kind: "subject" as const,
        name: subject.name,
        blurb: subject.blurb,
        iconKey: subject.iconKey,
        sortOrder: subject.sortOrder,
        status: subject.status,
        children: subject.books.map((book) => {
          const chapters = book.chapters.map((chapter) => this.toChapterNode(chapter));
          return {
            id: book.id,
            kind: "book" as const,
            name: book.title,
            slug: book.slug,
            subtitle: book.subtitle,
            coverUrl: book.coverUrl,
            price: Number(book.price),
            includedInProgram: book.includedInProgram,
            authorId: book.author.id,
            authorName: book.author.name,
            sortOrder: book.sortOrder,
            status: book.status,
            mcqCount: chapters.reduce((sum, c) => sum + (c.mcqCount ?? 0), 0),
            flashCardCount: chapters.reduce((sum, c) => sum + (c.flashCardCount ?? 0), 0),
            children: chapters,
          };
        }),
      })),
    }));
  }

  private toChapterNode(chapter: {
    id: string;
    title: string;
    subject: string;
    description: string | null;
    sortOrder: number;
    status: string;
    _count: { mcqs: number; flashCards: number };
    categories: Array<{
      id: string;
      name: string;
      sortOrder: number;
      status: string;
      subcategories: Array<{ id: string; name: string; sortOrder: number; status: string }>;
    }>;
  }) {
    return {
      id: chapter.id,
      kind: "chapter" as const,
      name: chapter.title,
      subject: chapter.subject,
      description: chapter.description,
      sortOrder: chapter.sortOrder,
      status: chapter.status,
      mcqCount: chapter._count.mcqs,
      flashCardCount: chapter._count.flashCards,
      children: chapter.categories.map((category) => ({
        id: category.id,
        kind: "category" as const,
        name: category.name,
        sortOrder: category.sortOrder,
        status: category.status,
        children: category.subcategories.map((sub) => ({
          id: sub.id,
          kind: "subcategory" as const,
          name: sub.name,
          sortOrder: sub.sortOrder,
          status: sub.status,
          children: [] as never[],
        })),
      })),
    };
  }

  async createProgram(input: {
    name: string;
    slug?: string;
    description?: string;
    examBoard?: string;
    sortOrder?: number;
    status?: ContentStatus;
  }) {
    const slug = input.slug ?? slugify(input.name);
    try {
      return await prisma.program.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          examBoard: input.examBoard,
          sortOrder: input.sortOrder ?? 0,
          status: input.status ?? "ACTIVE",
        },
      });
    } catch (error) {
      rethrowUnique(error, "A program with that slug already exists");
    }
  }

  async updateProgram(
    id: string,
    input: {
      name?: string;
      slug?: string;
      description?: string;
      examBoard?: string;
      sortOrder?: number;
      status?: ContentStatus;
    }
  ) {
    await this.requireProgram(id);
    try {
      return await prisma.program.update({ where: { id }, data: input });
    } catch (error) {
      rethrowUnique(error, "A program with that slug already exists");
    }
  }

  async createSubject(input: {
    programId: string;
    name: string;
    blurb?: string;
    iconKey?: string;
    sortOrder?: number;
    status?: ContentStatus;
  }) {
    await this.requireProgram(input.programId);
    try {
      return await prisma.programSubject.create({
        data: {
          programId: input.programId,
          name: input.name,
          blurb: input.blurb,
          iconKey: input.iconKey,
          sortOrder: input.sortOrder ?? 0,
          status: input.status ?? "ACTIVE",
        },
      });
    } catch (error) {
      rethrowUnique(error, "That subject already exists in this program");
    }
  }

  async updateSubject(
    id: string,
    input: {
      name?: string;
      blurb?: string;
      iconKey?: string;
      sortOrder?: number;
      status?: ContentStatus;
    }
  ) {
    const existing = await prisma.programSubject.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Subject not found", 404);
    try {
      return await prisma.programSubject.update({ where: { id }, data: input });
    } catch (error) {
      rethrowUnique(error, "That subject already exists in this program");
    }
  }

  async createTopic(input: {
    subjectId: string;
    name: string;
    sortOrder?: number;
    status?: ContentStatus;
  }) {
    const subject = await prisma.programSubject.findUnique({ where: { id: input.subjectId } });
    if (!subject) throw new AppError("NOT_FOUND", "Subject not found", 404);
    try {
      return await prisma.topic.create({
        data: {
          subjectId: input.subjectId,
          name: input.name,
          sortOrder: input.sortOrder ?? 0,
          status: input.status ?? "ACTIVE",
        },
      });
    } catch (error) {
      rethrowUnique(error, "That topic already exists in this subject");
    }
  }

  async updateTopic(
    id: string,
    input: { name?: string; sortOrder?: number; status?: ContentStatus }
  ) {
    const existing = await prisma.topic.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Topic not found", 404);
    try {
      return await prisma.topic.update({ where: { id }, data: input });
    } catch (error) {
      rethrowUnique(error, "That topic already exists in this subject");
    }
  }

  async createCategory(input: {
    chapterId: string;
    name: string;
    sortOrder?: number;
    status?: ContentStatus;
  }) {
    const chapter = await prisma.chapter.findUnique({ where: { id: input.chapterId } });
    if (!chapter) throw new AppError("NOT_FOUND", "Chapter not found", 404);
    try {
      return await prisma.category.create({
        data: {
          chapterId: input.chapterId,
          name: input.name,
          sortOrder: input.sortOrder ?? 0,
          status: input.status ?? "ACTIVE",
        },
      });
    } catch (error) {
      rethrowUnique(error, "That category already exists in this chapter");
    }
  }

  async updateCategory(
    id: string,
    input: { name?: string; sortOrder?: number; status?: ContentStatus }
  ) {
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Category not found", 404);
    try {
      return await prisma.category.update({ where: { id }, data: input });
    } catch (error) {
      rethrowUnique(error, "That category already exists in this chapter");
    }
  }

  async createSubcategory(input: {
    categoryId: string;
    name: string;
    sortOrder?: number;
    status?: ContentStatus;
  }) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new AppError("NOT_FOUND", "Category not found", 404);
    try {
      return await prisma.subcategory.create({
        data: {
          categoryId: input.categoryId,
          name: input.name,
          sortOrder: input.sortOrder ?? 0,
          status: input.status ?? "ACTIVE",
        },
      });
    } catch (error) {
      rethrowUnique(error, "That subcategory already exists in this category");
    }
  }

  async updateSubcategory(
    id: string,
    input: { name?: string; sortOrder?: number; status?: ContentStatus }
  ) {
    const existing = await prisma.subcategory.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Subcategory not found", 404);
    try {
      return await prisma.subcategory.update({ where: { id }, data: input });
    } catch (error) {
      rethrowUnique(error, "That subcategory already exists in this category");
    }
  }

  async listAuthors() {
    const rows = await prisma.author.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { books: true } } },
    });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      bio: a.bio,
      sortOrder: a.sortOrder,
      status: a.status,
      bookCount: a._count.books,
    }));
  }

  async createAuthor(input: {
    name: string;
    slug?: string;
    bio?: string;
    sortOrder?: number;
    status?: ContentStatus;
  }) {
    const slug = input.slug ?? (await this.uniqueAuthorSlug(slugify(input.name)));
    try {
      return await prisma.author.create({
        data: {
          name: input.name.trim(),
          slug,
          bio: emptyToNull(input.bio),
          sortOrder: input.sortOrder ?? 0,
          status: input.status ?? "ACTIVE",
        },
      });
    } catch (error) {
      rethrowUnique(error, "An author with that slug already exists");
    }
  }

  async updateAuthor(
    id: string,
    input: {
      name?: string;
      slug?: string;
      bio?: string;
      sortOrder?: number;
      status?: ContentStatus;
    }
  ) {
    const existing = await prisma.author.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Author not found", 404);
    try {
      return await prisma.author.update({
        where: { id },
        data: {
          name: input.name?.trim(),
          slug: input.slug,
          bio: input.bio === undefined ? undefined : emptyToNull(input.bio),
          sortOrder: input.sortOrder,
          status: input.status,
        },
      });
    } catch (error) {
      rethrowUnique(error, "An author with that slug already exists");
    }
  }

  async createBook(input: {
    subjectId: string;
    authorId?: string;
    authorName?: string;
    title: string;
    slug?: string;
    subtitle?: string | null;
    coverUrl?: string | null;
    price?: number;
    includedInProgram?: boolean;
    sortOrder?: number;
    status?: ContentStatus;
  }) {
    const subject = await prisma.programSubject.findUnique({
      where: { id: input.subjectId },
      include: { program: { select: { slug: true } } },
    });
    if (!subject) throw new AppError("NOT_FOUND", "Subject not found", 404);
    const author = await this.resolveAuthor(input.authorId, input.authorName);
    const slug =
      input.slug ??
      (await this.uniqueBookSlug(`${subject.program.slug}-${slugify(input.title)}`));
    try {
      const book = await prisma.book.create({
        data: {
          subjectId: subject.id,
          authorId: author.id,
          title: input.title.trim(),
          slug,
          subtitle: emptyToNull(input.subtitle),
          coverUrl: emptyToNull(input.coverUrl),
          price: input.price ?? 0,
          includedInProgram: input.includedInProgram ?? true,
          sortOrder: input.sortOrder ?? 0,
          status: input.status ?? "ACTIVE",
        },
        include: { author: { select: { id: true, name: true, slug: true } } },
      });
      return this.toBookDto(book);
    } catch (error) {
      rethrowUnique(error, "A book with that title or slug already exists");
    }
  }

  async updateBook(
    id: string,
    input: {
      authorId?: string;
      authorName?: string;
      title?: string;
      slug?: string;
      subtitle?: string | null;
      coverUrl?: string | null;
      price?: number;
      includedInProgram?: boolean;
      sortOrder?: number;
      status?: ContentStatus;
    }
  ) {
    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Book not found", 404);
    const authorId =
      input.authorId || input.authorName
        ? (await this.resolveAuthor(input.authorId, input.authorName)).id
        : undefined;
    try {
      const book = await prisma.book.update({
        where: { id },
        data: {
          authorId,
          title: input.title?.trim(),
          slug: input.slug,
          subtitle: input.subtitle === undefined ? undefined : emptyToNull(input.subtitle),
          coverUrl: input.coverUrl === undefined ? undefined : emptyToNull(input.coverUrl),
          price: input.price,
          includedInProgram: input.includedInProgram,
          sortOrder: input.sortOrder,
          status: input.status,
        },
        include: { author: { select: { id: true, name: true, slug: true } } },
      });
      return this.toBookDto(book);
    } catch (error) {
      rethrowUnique(error, "A book with that title or slug already exists");
    }
  }

  private toBookDto(book: {
    id: string;
    title: string;
    slug: string;
    subtitle: string | null;
    coverUrl: string | null;
    price: { toString(): string } | number;
    includedInProgram: boolean;
    sortOrder: number;
    status: string;
    subjectId: string;
    author: { id: string; name: string; slug: string };
  }) {
    return {
      id: book.id,
      kind: "book" as const,
      name: book.title,
      title: book.title,
      slug: book.slug,
      subtitle: book.subtitle,
      coverUrl: book.coverUrl,
      price: Number(book.price),
      includedInProgram: book.includedInProgram,
      sortOrder: book.sortOrder,
      status: book.status,
      subjectId: book.subjectId,
      authorId: book.author.id,
      authorName: book.author.name,
    };
  }

  private async resolveAuthor(authorId?: string, authorName?: string) {
    if (authorId) {
      const author = await prisma.author.findUnique({ where: { id: authorId } });
      if (!author) throw new AppError("NOT_FOUND", "Author not found", 404);
      return author;
    }
    const name = authorName?.trim();
    if (!name) throw new AppError("VALIDATION_ERROR", "authorId or authorName is required", 400);
    const existing = await prisma.author.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) return existing;
    const slug = await this.uniqueAuthorSlug(slugify(name));
    return prisma.author.create({
      data: { name, slug, status: "ACTIVE" },
    });
  }

  private async uniqueAuthorSlug(base: string) {
    let slug = slugify(base);
    let n = 0;
    while (await prisma.author.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${slugify(base)}-${n}`;
    }
    return slug;
  }

  private async uniqueBookSlug(base: string) {
    let slug = slugify(base);
    let n = 0;
    while (await prisma.book.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${slugify(base)}-${n}`;
    }
    return slug;
  }

  private async requireProgram(id: string) {
    const program = await prisma.program.findUnique({ where: { id } });
    if (!program) throw new AppError("NOT_FOUND", "Program not found", 404);
    return program;
  }
}

export const programsService = new ProgramsService();
