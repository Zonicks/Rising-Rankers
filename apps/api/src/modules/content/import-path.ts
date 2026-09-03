import { prisma } from "../../infrastructure/database/prisma";

export type PathDraft = {
  program?: string;
  subject?: string;
  book?: string;
  author?: string;
  chapter?: string;
  category?: string;
  subcategory?: string;
  chapterId?: string;
};

export type ResolvedContentPath = {
  chapterId: string;
  categoryId?: string;
  subcategoryId?: string;
  subjectName: string;
};

export class PathResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathResolveError";
  }
}

function norm(value?: string) {
  return value?.trim() ?? "";
}

function key(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

export class ImportPathResolver {
  private programs = new Map<string, { id: string; name: string; slug: string }>();
  private subjects = new Map<string, { id: string; name: string; programId: string }>();
  private books = new Map<string, { id: string; title: string; subjectId: string }>();
  private chapters = new Map<
    string,
    { id: string; title: string; subject: string; bookId: string | null }
  >();
  private categories = new Map<string, { id: string; name: string; chapterId: string }>();
  private subcategories = new Map<string, { id: string; name: string; categoryId: string }>();
  private authors = new Map<string, { id: string; name: string }>();

  constructor(private createMissing: boolean) {}

  async resolve(draft: PathDraft, defaultChapterId?: string): Promise<ResolvedContentPath> {
    const chapter = await this.resolveChapter(draft, defaultChapterId);
    if (draft.subcategory && !draft.category) {
      throw new PathResolveError("category is required when subcategory is set");
    }
    let categoryId: string | undefined;
    if (draft.category) {
      categoryId = (await this.findOrCreateCategory(chapter.id, draft.category)).id;
    }
    let subcategoryId: string | undefined;
    if (draft.subcategory) {
      subcategoryId = (await this.findOrCreateSubcategory(categoryId!, draft.subcategory)).id;
    }
    return {
      chapterId: chapter.id,
      categoryId,
      subcategoryId,
      subjectName: chapter.subject,
    };
  }

  private async resolveChapter(draft: PathDraft, defaultChapterId?: string) {
    if (draft.chapterId) {
      return this.getChapterById(draft.chapterId);
    }

    const catalogPath = Boolean(draft.program || draft.subject || draft.book);
    if (catalogPath) {
      return this.resolveFromCatalog(draft);
    }

    if (draft.chapter && defaultChapterId) {
      const fallback = await this.getChapterById(defaultChapterId);
      if (key(fallback.title) === key(draft.chapter)) return fallback;
      if (fallback.bookId) {
        return this.findOrCreateChapter(fallback.bookId, draft.chapter, fallback.subject);
      }
      throw new PathResolveError(
        `Chapter “${draft.chapter}” was not found. Add program/subject/book columns or pick a default chapter under a book.`
      );
    }

    if (defaultChapterId) return this.getChapterById(defaultChapterId);
    throw new PathResolveError(
      "Need path columns (program, subject, book, chapter) or a default chapter"
    );
  }

  private async resolveFromCatalog(draft: PathDraft) {
    const programName = norm(draft.program);
    const subjectName = norm(draft.subject);
    const bookTitle = norm(draft.book);
    const chapterTitle = norm(draft.chapter);
    if (!programName || !subjectName) {
      throw new PathResolveError("program and subject are required when placing a book path");
    }
    if (!bookTitle) throw new PathResolveError("book is required when program/subject are set");
    if (!chapterTitle) throw new PathResolveError("chapter is required when program/subject/book are set");

    const program = await this.findProgram(programName);
    const subject = await this.findSubject(program.id, subjectName);
    const book = await this.findOrCreateBook(subject, bookTitle, draft.author);
    return this.findOrCreateChapter(book.id, chapterTitle, subject.name);
  }

  private async getChapterById(id: string) {
    const cached = this.chapters.get(`id:${id}`);
    if (cached) return cached;
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      select: { id: true, title: true, subject: true, bookId: true },
    });
    if (!chapter) throw new PathResolveError("Chapter not found");
    this.chapters.set(`id:${id}`, chapter);
    if (chapter.bookId) this.chapters.set(`${chapter.bookId}:${key(chapter.title)}`, chapter);
    return chapter;
  }

  private async findProgram(nameOrSlug: string) {
    const k = key(nameOrSlug);
    const cached = this.programs.get(k);
    if (cached) return cached;
    const program = await prisma.program.findFirst({
      where: {
        OR: [
          { name: { equals: nameOrSlug.trim(), mode: "insensitive" } },
          { slug: { equals: k, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, slug: true },
    });
    if (!program) {
      throw new PathResolveError(
        `Program “${nameOrSlug}” was not found. Programs cannot be created from import.`
      );
    }
    this.programs.set(k, program);
    this.programs.set(key(program.name), program);
    this.programs.set(key(program.slug), program);
    return program;
  }

  private async findSubject(programId: string, name: string) {
    const k = `${programId}:${key(name)}`;
    const cached = this.subjects.get(k);
    if (cached) return cached;
    const subject = await prisma.programSubject.findFirst({
      where: { programId, name: { equals: name.trim(), mode: "insensitive" } },
      select: { id: true, name: true, programId: true },
    });
    if (!subject) {
      throw new PathResolveError(
        `Subject “${name}” was not found in that program. Subjects cannot be created from import.`
      );
    }
    this.subjects.set(k, subject);
    this.subjects.set(`${programId}:${key(subject.name)}`, subject);
    return subject;
  }

  async importBook(draft: {
    program: string;
    subject: string;
    book: string;
    author?: string;
    subtitle?: string;
    price?: number;
    includedInProgram?: boolean;
    chapter?: string;
    category?: string;
    subcategory?: string;
  }) {
    const program = await this.findProgram(draft.program);
    const subject = await this.findSubject(program.id, draft.subject);
    const book = await this.findOrCreateBook(subject, draft.book, draft.author, {
      subtitle: draft.subtitle,
      price: draft.price,
      includedInProgram: draft.includedInProgram,
    });
    let categoriesCreated = 0;
    let subcategoriesCreated = 0;
    if (draft.subcategory && !draft.category) {
      throw new PathResolveError("category is required when subcategory is set");
    }
    if ((draft.category || draft.subcategory) && !draft.chapter) {
      throw new PathResolveError("chapter is required when category or subcategory is set");
    }
    if (draft.chapter) {
      const chapter = await this.findOrCreateChapter(book.id, draft.chapter, subject.name);
      if (draft.category) {
        const category = await this.findOrCreateCategory(chapter.id, draft.category);
        if (category.created) categoriesCreated += 1;
        if (draft.subcategory) {
          const subcategory = await this.findOrCreateSubcategory(category.id, draft.subcategory);
          if (subcategory.created) subcategoriesCreated += 1;
        }
      }
    }
    return { ...book, categoriesCreated, subcategoriesCreated };
  }

  private async findOrCreateBook(
    subject: { id: string; name: string; programId: string },
    title: string,
    authorName?: string,
    extras?: { subtitle?: string; price?: number; includedInProgram?: boolean }
  ) {
    const k = `${subject.id}:${key(title)}`;
    const cached = this.books.get(k);
    if (cached) return { ...cached, created: false };
    const existing = await prisma.book.findFirst({
      where: { subjectId: subject.id, title: { equals: title.trim(), mode: "insensitive" } },
      select: { id: true, title: true, subjectId: true },
    });
    if (existing) {
      this.books.set(k, existing);
      return { ...existing, created: false };
    }
    if (!this.createMissing) {
      throw new PathResolveError(`Book “${title}” was not found under ${subject.name}`);
    }
    const program = await prisma.program.findUnique({
      where: { id: subject.programId },
      select: { slug: true },
    });
    const author = await this.findOrCreateAuthor(authorName || "Rising Rankers");
    const slug = await this.uniqueBookSlug(`${program?.slug ?? "book"}-${slugify(title)}`);
    try {
      const book = await prisma.book.create({
        data: {
          subjectId: subject.id,
          authorId: author.id,
          title: title.trim(),
          slug,
          subtitle: extras?.subtitle?.trim() || null,
          price: extras?.price ?? 0,
          includedInProgram: extras?.includedInProgram ?? true,
          status: "ACTIVE",
        },
        select: { id: true, title: true, subjectId: true },
      });
      this.books.set(k, book);
      return { ...book, created: true };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      const again = await prisma.book.findFirst({
        where: { subjectId: subject.id, title: { equals: title.trim(), mode: "insensitive" } },
        select: { id: true, title: true, subjectId: true },
      });
      if (!again) throw error;
      this.books.set(k, again);
      return { ...again, created: false };
    }
  }

  private async findOrCreateAuthor(name: string) {
    const k = key(name);
    const cached = this.authors.get(k);
    if (cached) return cached;
    const existing = await prisma.author.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (existing) {
      this.authors.set(k, existing);
      return existing;
    }
    if (!this.createMissing) {
      throw new PathResolveError(`Author “${name}” was not found`);
    }
    const slug = await this.uniqueAuthorSlug(slugify(name));
    const author = await prisma.author.create({
      data: { name: name.trim(), slug, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    this.authors.set(k, author);
    return author;
  }

  private async findOrCreateChapter(bookId: string, title: string, subjectName: string) {
    const k = `${bookId}:${key(title)}`;
    const cached = this.chapters.get(k);
    if (cached) return cached;
    const existing = await prisma.chapter.findFirst({
      where: { bookId, title: { equals: title.trim(), mode: "insensitive" } },
      select: { id: true, title: true, subject: true, bookId: true },
    });
    if (existing) {
      this.chapters.set(k, existing);
      this.chapters.set(`id:${existing.id}`, existing);
      return existing;
    }
    if (!this.createMissing) {
      throw new PathResolveError(`Chapter “${title}” was not found in that book`);
    }
    const chapter = await prisma.chapter.create({
      data: {
        title: title.trim(),
        subject: subjectName,
        bookId,
        status: "ACTIVE",
      },
      select: { id: true, title: true, subject: true, bookId: true },
    });
    this.chapters.set(k, chapter);
    this.chapters.set(`id:${chapter.id}`, chapter);
    return chapter;
  }

  private async findOrCreateCategory(chapterId: string, name: string) {
    const k = `${chapterId}:${key(name)}`;
    const cached = this.categories.get(k);
    if (cached) return { id: cached.id, created: false };
    const existing = await prisma.category.findFirst({
      where: { chapterId, name: { equals: name.trim(), mode: "insensitive" } },
      select: { id: true, name: true, chapterId: true },
    });
    if (existing) {
      this.categories.set(k, existing);
      return { id: existing.id, created: false };
    }
    if (!this.createMissing) {
      throw new PathResolveError(`Category “${name}” was not found`);
    }
    try {
      const category = await prisma.category.create({
        data: { chapterId, name: name.trim(), status: "ACTIVE" },
        select: { id: true, name: true, chapterId: true },
      });
      this.categories.set(k, category);
      return { id: category.id, created: true };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      const again = await prisma.category.findFirst({
        where: { chapterId, name: { equals: name.trim(), mode: "insensitive" } },
        select: { id: true, name: true, chapterId: true },
      });
      if (!again) throw error;
      this.categories.set(k, again);
      return { id: again.id, created: false };
    }
  }

  private async findOrCreateSubcategory(categoryId: string, name: string) {
    const k = `${categoryId}:${key(name)}`;
    const cached = this.subcategories.get(k);
    if (cached) return { id: cached.id, created: false };
    const existing = await prisma.subcategory.findFirst({
      where: { categoryId, name: { equals: name.trim(), mode: "insensitive" } },
      select: { id: true, name: true, categoryId: true },
    });
    if (existing) {
      this.subcategories.set(k, existing);
      return { id: existing.id, created: false };
    }
    if (!this.createMissing) {
      throw new PathResolveError(`Subcategory “${name}” was not found`);
    }
    try {
      const subcategory = await prisma.subcategory.create({
        data: { categoryId, name: name.trim(), status: "ACTIVE" },
        select: { id: true, name: true, categoryId: true },
      });
      this.subcategories.set(k, subcategory);
      return { id: subcategory.id, created: true };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      const again = await prisma.subcategory.findFirst({
        where: { categoryId, name: { equals: name.trim(), mode: "insensitive" } },
        select: { id: true, name: true, categoryId: true },
      });
      if (!again) throw error;
      this.subcategories.set(k, again);
      return { id: again.id, created: false };
    }
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
}

export function isPathResolveError(error: unknown): error is PathResolveError {
  return error instanceof PathResolveError || (error as { name?: string })?.name === "PathResolveError";
}
