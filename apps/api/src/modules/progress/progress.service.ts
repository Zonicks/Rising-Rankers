import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";
import { settingsService } from "../settings/settings.service";
import { rewardsService } from "../rewards/rewards.service";

const MASTERY_MIN_ATTEMPTS = 5;

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

function pct(n: number, d: number) {
  if (d <= 0) return 0;
  return Math.round((n / d) * 100);
}

type Latest = { isCorrect: boolean; at: number; chapterId: string | null };

export class ProgressService {
  async tracker(userId: string) {
    const streakCount = await rewardsService.refreshStreak(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new AppError("NOT_FOUND", "User not found", 404);

    const curriculum = await prisma.studentCurriculum.findUnique({
      where: { userId },
      include: {
        program: { select: { id: true, name: true, slug: true } },
        modules: {
          orderBy: { sortOrder: "asc" },
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                blurb: true,
                iconKey: true,
                sortOrder: true,
                programId: true,
              },
            },
            chapter: {
              include: {
                _count: { select: { mcqs: true, flashCards: true } },
              },
            },
          },
        },
      },
    });

    const settings = await settingsService.get();
    const visibleWhere = {
      status: "PUBLISHED" as const,
      publishedAt: { lte: new Date() },
      OR: [
        { programId: null },
        ...(curriculum?.programId ? [{ programId: curriculum.programId }] : []),
      ],
    };
    const [ratedToday, visibleArticles] = await Promise.all([
      prisma.flashCardReview.count({
        where: { userId, createdAt: { gte: startOfIstDay() } },
      }),
      prisma.article.findMany({ where: visibleWhere, select: { id: true } }),
    ]);
    const readCount =
      visibleArticles.length === 0
        ? 0
        : await prisma.articleRead.count({
            where: { userId, articleId: { in: visibleArticles.map((a) => a.id) } },
          });

    const daily = {
      quizQuestions: 20,
      quizMinutes: 15,
      flashGoal: settings.flashDailyGoal,
      flashRemaining: Math.max(0, settings.flashDailyGoal - ratedToday),
      unreadArticles: Math.max(0, visibleArticles.length - readCount),
    };

    if (!curriculum || curriculum.modules.length === 0) {
      return {
        program: curriculum?.program ?? null,
        streakCount,
        completion: { pct: 0, touchedModules: 0, totalModules: 0, touchedItems: 0, totalItems: 0 },
        mastery: { pct: null as number | null, attempts: 0, reliable: false },
        daily,
        subjects: [] as never[],
        recommended: null as null,
      };
    }

    const chapterIds = [...new Set(curriculum.modules.map((m) => m.chapterId))];

    const [attempts, liveAnswers, flashReviews] = await Promise.all([
      prisma.mcqAttempt.findMany({
        where: { userId, mcq: { chapterId: { in: chapterIds } } },
        orderBy: { attemptedAt: "desc" },
        include: { mcq: { select: { id: true, chapterId: true } } },
      }),
      prisma.testAnswer.findMany({
        where: {
          attempt: { userId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
        },
        include: { attempt: { select: { submittedAt: true } } },
      }),
      prisma.flashCardReview.findMany({
        where: { userId, flashCard: { chapterId: { in: chapterIds } } },
        select: { flashCardId: true, flashCard: { select: { chapterId: true } } },
      }),
    ]);

    const liveMcqIds = [...new Set(liveAnswers.map((a) => a.mcqId))];
    const liveMcqs =
      liveMcqIds.length === 0
        ? []
        : await prisma.mcq.findMany({
            where: { id: { in: liveMcqIds }, chapterId: { in: chapterIds } },
            select: { id: true, chapterId: true },
          });
    const liveChapterByMcq = new Map(liveMcqs.map((m) => [m.id, m.chapterId]));

    const latestByMcq = new Map<string, Latest>();
    for (const a of attempts) {
      if (latestByMcq.has(a.mcqId)) continue;
      latestByMcq.set(a.mcqId, {
        isCorrect: a.isCorrect,
        at: a.attemptedAt.getTime(),
        chapterId: a.mcq.chapterId,
      });
    }
    for (const ans of liveAnswers) {
      const chapterId = liveChapterByMcq.get(ans.mcqId);
      if (!chapterId) continue;
      const at = ans.attempt.submittedAt?.getTime() ?? 0;
      const prev = latestByMcq.get(ans.mcqId);
      if (!prev || at >= prev.at) {
        latestByMcq.set(ans.mcqId, {
          isCorrect: ans.isCorrect,
          at,
          chapterId,
        });
      }
    }

    const reviewedFlash = new Map<string, string | null>();
    for (const r of flashReviews) {
      reviewedFlash.set(r.flashCardId, r.flashCard.chapterId);
    }

    const chapterStats = new Map<
      string,
      {
        mcqCount: number;
        flashCount: number;
        touchedMcqs: number;
        touchedFlash: number;
        correct: number;
        attempts: number;
      }
    >();

    for (const mod of curriculum.modules) {
      chapterStats.set(mod.chapterId, {
        mcqCount: mod.chapter._count.mcqs,
        flashCount: mod.chapter._count.flashCards,
        touchedMcqs: 0,
        touchedFlash: 0,
        correct: 0,
        attempts: 0,
      });
    }

    const mcqsTouchedByChapter = new Map<string, Set<string>>();
    for (const a of attempts) {
      const ch = a.mcq.chapterId;
      if (!ch || !chapterStats.has(ch)) continue;
      if (!mcqsTouchedByChapter.has(ch)) mcqsTouchedByChapter.set(ch, new Set());
      mcqsTouchedByChapter.get(ch)!.add(a.mcqId);
    }
    for (const [ch, set] of mcqsTouchedByChapter) {
      const s = chapterStats.get(ch);
      if (s) s.touchedMcqs = set.size;
    }

    const flashTouchedByChapter = new Map<string, Set<string>>();
    for (const [flashId, ch] of reviewedFlash) {
      if (!ch || !chapterStats.has(ch)) continue;
      if (!flashTouchedByChapter.has(ch)) flashTouchedByChapter.set(ch, new Set());
      flashTouchedByChapter.get(ch)!.add(flashId);
    }
    for (const [ch, set] of flashTouchedByChapter) {
      const s = chapterStats.get(ch);
      if (s) s.touchedFlash = set.size;
    }

    for (const row of latestByMcq.values()) {
      if (!row.chapterId) continue;
      const s = chapterStats.get(row.chapterId);
      if (!s) continue;
      s.attempts += 1;
      if (row.isCorrect) s.correct += 1;
    }

    let touchedModules = 0;
    let touchedItems = 0;
    let totalItems = 0;
    let overallCorrect = 0;
    let overallAttempts = 0;

    const subjectsMap = new Map<
      string,
      {
        id: string;
        name: string;
        blurb: string | null;
        iconKey: string | null;
        sortOrder: number;
        addon: boolean;
        chapters: Array<{
          id: string;
          title: string;
          completionPct: number;
          masteryPct: number | null;
          masteryAttempts: number;
          reliable: boolean;
          mcqCount: number;
          flashCount: number;
          touchedItems: number;
          totalItems: number;
          touched: boolean;
        }>;
      }
    >();

    for (const mod of curriculum.modules) {
      const st = chapterStats.get(mod.chapterId)!;
      const items = st.mcqCount + st.flashCount;
      const touched = st.touchedMcqs + st.touchedFlash;
      totalItems += items;
      touchedItems += touched;
      const chapterTouched = touched > 0;
      if (chapterTouched) touchedModules += 1;
      overallCorrect += st.correct;
      overallAttempts += st.attempts;

      const completionPct = items > 0 ? pct(touched, items) : chapterTouched ? 100 : 0;
      const reliable = st.attempts >= MASTERY_MIN_ATTEMPTS;
      const masteryPct = st.attempts > 0 ? pct(st.correct, st.attempts) : null;

      if (!subjectsMap.has(mod.subjectId)) {
        subjectsMap.set(mod.subjectId, {
          id: mod.subject.id,
          name: mod.subject.name,
          blurb: mod.subject.blurb,
          iconKey: mod.subject.iconKey,
          sortOrder: mod.subject.sortOrder,
          addon: mod.subject.programId !== curriculum.programId,
          chapters: [],
        });
      }
      subjectsMap.get(mod.subjectId)!.chapters.push({
        id: mod.chapter.id,
        title: mod.chapter.title,
        completionPct,
        masteryPct,
        masteryAttempts: st.attempts,
        reliable,
        mcqCount: st.mcqCount,
        flashCount: st.flashCount,
        touchedItems: touched,
        totalItems: items,
        touched: chapterTouched,
      });
    }

    const totalModules = curriculum.modules.length;
    const subjects = [...subjectsMap.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((s) => {
        const ch = s.chapters;
        const subAttempts = ch.reduce((n, c) => n + c.masteryAttempts, 0);
        const subCorrect = ch.reduce((n, c) => {
          if (c.masteryPct == null || c.masteryAttempts === 0) return n;
          return n + Math.round((c.masteryPct / 100) * c.masteryAttempts);
        }, 0);
        const subItems = ch.reduce((n, c) => n + c.totalItems, 0);
        const subTouched = ch.reduce((n, c) => n + c.touchedItems, 0);
        const completionPct =
          subItems > 0 ? pct(subTouched, subItems) : pct(ch.filter((c) => c.touched).length, ch.length);
        const reliable = subAttempts >= MASTERY_MIN_ATTEMPTS;
        const masteryPct = subAttempts > 0 ? pct(subCorrect, subAttempts) : null;
        return {
          id: s.id,
          name: s.name,
          blurb: s.blurb,
          iconKey: s.iconKey,
          addon: s.addon,
          completionPct,
          masteryPct,
          masteryAttempts: subAttempts,
          reliable,
          cta: completionPct < 50 ? ("practice" as const) : ("review" as const),
          chapters: ch,
        };
      });

    let recommended: {
      chapterId: string;
      title: string;
      subjectId: string;
      subjectName: string;
      reason: string;
    } | null = null;

    const ranked = subjects.flatMap((s) =>
      s.chapters
        .filter((c) => c.mcqCount + c.flashCount > 0)
        .map((c) => ({ s, c }))
    );
    const weak = ranked
      .filter((x) => x.c.masteryAttempts > 0)
      .sort((a, b) => (a.c.masteryPct ?? 0) - (b.c.masteryPct ?? 0))[0];
    const untouched = ranked.find((x) => !x.c.touched);
    const pick = weak ?? untouched ?? ranked[0];
    if (pick) {
      recommended = {
        chapterId: pick.c.id,
        title: pick.c.title,
        subjectId: pick.s.id,
        subjectName: pick.s.name,
        reason: weak
          ? `Lowest mastery in ${pick.s.name}`
          : untouched
            ? `Not started in ${pick.s.name}`
            : `Continue ${pick.s.name}`,
      };
    }

    return {
      program: curriculum.program,
      streakCount,
      completion: {
        pct: pct(touchedModules, totalModules),
        touchedModules,
        totalModules,
        touchedItems,
        totalItems,
      },
      mastery: {
        pct: overallAttempts > 0 ? pct(overallCorrect, overallAttempts) : null,
        attempts: overallAttempts,
        reliable: overallAttempts >= MASTERY_MIN_ATTEMPTS,
      },
      daily,
      subjects,
      recommended,
    };
  }

  async progress(userId: string) {
    const full = await this.tracker(userId);
    return {
      program: full.program,
      streakCount: full.streakCount,
      completion: full.completion,
      mastery: full.mastery,
      daily: full.daily,
      subjects: full.subjects.map((s) => ({
        id: s.id,
        name: s.name,
        blurb: s.blurb,
        iconKey: s.iconKey,
        completionPct: s.completionPct,
        masteryPct: s.masteryPct,
        masteryAttempts: s.masteryAttempts,
        reliable: s.reliable,
      })),
    };
  }
}

export const progressService = new ProgressService();
