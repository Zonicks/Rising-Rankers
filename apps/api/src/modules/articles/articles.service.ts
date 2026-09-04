import { createReadStream } from "node:fs";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";
import { rewardsService } from "../rewards/rewards.service";

export type ArticleRange = "today" | "week" | "archive" | "saved";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

type ArticleInput = {
  title: string;
  body: string;
  excerpt?: string | null;
  imageUrl?: string | null;
  tag?: string | null;
  featured?: boolean;
  programId?: string | null;
  status?: "DRAFT" | "PUBLISHED";
  publishedAt?: string | null;
};

function decodeImage(data: string, contentType?: string) {
  const match = data.match(/^data:([^;]+);base64,(.+)$/);
  const raw = match ? match[2] : data;
  const type = (match?.[1] ?? contentType ?? "").toLowerCase();
  const buffer = Buffer.from(raw.replace(/\s/g, ""), "base64");
  return { type, buffer };
}

function publishStamp(status?: "DRAFT" | "PUBLISHED", publishedAt?: string | null) {
  if (status !== "PUBLISHED") {
    return { status: status ?? "DRAFT", publishedAt: publishedAt ? new Date(publishedAt) : null };
  }
  return {
    status: "PUBLISHED" as const,
    publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
  };
}

export class ArticlesService {
  list() {
    return prisma.article.findMany({
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: { program: { select: { id: true, name: true } } },
    });
  }

  async create(input: ArticleInput) {
    if (input.programId) {
      const program = await prisma.program.findUnique({ where: { id: input.programId } });
      if (!program) throw new AppError("NOT_FOUND", "Program not found", 404);
    }
    const stamp = publishStamp(input.status, input.publishedAt);
    return prisma.article.create({
      data: {
        title: input.title,
        body: input.body,
        excerpt: input.excerpt ?? null,
        imageUrl: input.imageUrl ?? null,
        tag: input.tag ?? null,
        featured: input.featured ?? false,
        programId: input.programId ?? null,
        status: stamp.status,
        publishedAt: stamp.publishedAt,
      },
      include: { program: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, input: Partial<ArticleInput>) {
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Article not found", 404);
    if (input.programId) {
      const program = await prisma.program.findUnique({ where: { id: input.programId } });
      if (!program) throw new AppError("NOT_FOUND", "Program not found", 404);
    }
    const { publishedAt: publishedAtInput, status, ...rest } = input;
    const shouldStamp = status !== undefined || publishedAtInput !== undefined;
    const stamp = shouldStamp
      ? publishStamp(status ?? existing.status, publishedAtInput ?? existing.publishedAt?.toISOString())
      : null;
    return prisma.article.update({
      where: { id },
      data: {
        ...rest,
        ...(stamp ?? {}),
      },
      include: { program: { select: { id: true, name: true } } },
    });
  }

  async saveUpload(input: { filename: string; contentType?: string; data: string }) {
    const { type, buffer } = decodeImage(input.data, input.contentType);
    if (!buffer.length) throw new AppError("VALIDATION_ERROR", "Image data is empty", 400);
    if (buffer.length > MAX_BYTES) {
      throw new AppError("VALIDATION_ERROR", "Image must be 5 MB or smaller", 400);
    }
    const extFromName = path.extname(input.filename).toLowerCase();
    const ext = ALLOWED[type] ?? ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extFromName)
      ? extFromName === ".jpeg"
        ? ".jpg"
        : extFromName
      : null);
    if (!ext) throw new AppError("VALIDATION_ERROR", "Use a JPEG, PNG, WebP, or GIF image", 400);

    await mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    await writeFile(path.join(UPLOAD_DIR, name), buffer);
    return { url: `/uploads/${name}`, filename: name, bytes: buffer.length };
  }

  async streamFile(filename: string) {
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      throw new AppError("NOT_FOUND", "File not found", 404);
    }
    const filePath = path.join(UPLOAD_DIR, path.basename(filename));
    try {
      await access(filePath);
    } catch {
      throw new AppError("NOT_FOUND", "File not found", 404);
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
            ? "image/gif"
            : "image/jpeg";
    return { stream: createReadStream(filePath), mime };
  }

  async listForStudent(userId: string, range: ArticleRange = "today") {
    if (range === "saved") return this.listSaved(userId);

    const visible = await this.visibleWhere(userId);
    const rows = await prisma.article.findMany({
      where: {
        ...visible,
        publishedAt: { lte: new Date(), ...rangeWindow(range) },
      },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
    });
    const ids = rows.map((r) => r.id);
    const [readIds, bookmarkIds] = await Promise.all([
      this.readIdSet(userId, ids),
      this.bookmarkIdSet(userId, ids),
    ]);
    const articles = rows.map((row) => this.toCard(row, readIds.has(row.id), bookmarkIds.has(row.id)));
    const featured = articles.find((a) => a.featured) ?? null;
    return {
      range,
      featured,
      articles: featured ? articles.filter((a) => a.id !== featured.id) : articles,
    };
  }

  async listSaved(userId: string) {
    const visible = await this.visibleWhere(userId);
    const marks = await prisma.articleBookmark.findMany({
      where: {
        userId,
        article: {
          ...visible,
          publishedAt: { lte: new Date() },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { article: true },
    });
    const rows = marks.map((m) => m.article);
    const readIds = await this.readIdSet(
      userId,
      rows.map((r) => r.id)
    );
    return {
      range: "saved" as const,
      featured: null,
      articles: rows.map((row) => this.toCard(row, readIds.has(row.id), true)),
    };
  }

  async getForStudent(userId: string, id: string) {
    const visible = await this.visibleWhere(userId);
    const row = await prisma.article.findFirst({ where: { id, ...visible, publishedAt: { lte: new Date() } } });
    if (!row) throw new AppError("NOT_FOUND", "Article not found", 404);
    const [read, mark] = await Promise.all([
      prisma.articleRead.findUnique({
        where: { userId_articleId: { userId, articleId: id } },
      }),
      prisma.articleBookmark.findUnique({
        where: { userId_articleId: { userId, articleId: id } },
      }),
    ]);
    return { ...this.toCard(row, Boolean(read), Boolean(mark)), body: row.body };
  }

  async bookmark(userId: string, id: string) {
    await this.getForStudent(userId, id);
    await prisma.articleBookmark.upsert({
      where: { userId_articleId: { userId, articleId: id } },
      create: { userId, articleId: id },
      update: {},
    });
    return { bookmarked: true as const };
  }

  async unbookmark(userId: string, id: string) {
    await prisma.articleBookmark.deleteMany({ where: { userId, articleId: id } });
    return { bookmarked: false as const };
  }

  async importBookmarks(userId: string, ids: string[]) {
    const unique = [...new Set(ids.map(String).filter(Boolean))].slice(0, 50);
    const imported: string[] = [];
    for (const id of unique) {
      try {
        await this.bookmark(userId, id);
        imported.push(id);
      } catch {
        // skip unpublished / unknown
      }
    }
    return { imported };
  }

  async markRead(userId: string, id: string) {
    await this.getForStudent(userId, id);
    await prisma.articleRead.upsert({
      where: { userId_articleId: { userId, articleId: id } },
      create: { userId, articleId: id },
      update: {},
    });
    const rewards = await rewardsService.afterNewsRead(userId, id);
    return { read: true as const, rewards };
  }

  private async visibleWhere(userId: string) {
    const curriculum = await prisma.studentCurriculum.findUnique({
      where: { userId },
      select: { programId: true },
    });
    return {
      status: "PUBLISHED" as const,
      OR: [{ programId: null }, ...(curriculum?.programId ? [{ programId: curriculum.programId }] : [])],
    };
  }

  private async readIdSet(userId: string, articleIds: string[]) {
    if (articleIds.length === 0) return new Set<string>();
    const reads = await prisma.articleRead.findMany({
      where: { userId, articleId: { in: articleIds } },
      select: { articleId: true },
    });
    return new Set(reads.map((r) => r.articleId));
  }

  private async bookmarkIdSet(userId: string, articleIds: string[]) {
    if (articleIds.length === 0) return new Set<string>();
    const marks = await prisma.articleBookmark.findMany({
      where: { userId, articleId: { in: articleIds } },
      select: { articleId: true },
    });
    return new Set(marks.map((m) => m.articleId));
  }

  private toCard(
    row: {
      id: string;
      title: string;
      body: string;
      excerpt: string | null;
      imageUrl: string | null;
      tag: string | null;
      featured: boolean;
      publishedAt: Date | null;
    },
    read: boolean,
    bookmarked: boolean
  ) {
    const excerpt = (row.excerpt ?? "").trim() || row.body.replace(/\s+/g, " ").trim().slice(0, 180);
    return {
      id: row.id,
      title: row.title,
      excerpt,
      imageUrl: row.imageUrl,
      tag: row.tag,
      featured: row.featured,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      timeAgo: relativeTime(row.publishedAt),
      read,
      bookmarked,
    };
  }
}

function istKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function shiftIst(key: string, days: number) {
  const d = new Date(`${key}T12:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return istKey(d);
}

function istStart(key: string) {
  return new Date(`${key}T00:00:00+05:30`);
}

function rangeWindow(range: Exclude<ArticleRange, "saved">) {
  const weekStart = istStart(shiftIst(istKey(), -6));
  if (range === "today") return { gte: istStart(istKey()) };
  if (range === "week") return { gte: weekStart };
  return { lt: weekStart };
}

function relativeTime(at: Date | null) {
  if (!at) return "";
  const mins = Math.max(0, Math.round((Date.now() - at.getTime()) / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const today = istKey();
  if (istKey(at) === shiftIst(today, -1)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: istKey(at).slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
  }).format(at);
}

export const articlesService = new ArticlesService();
