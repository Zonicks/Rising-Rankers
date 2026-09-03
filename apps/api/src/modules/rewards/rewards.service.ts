import { prisma } from "../../infrastructure/database/prisma";

export type UnlockedAchievement = {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  tier: "GOLD" | "SILVER" | "BRONZE";
  pointsReward: number;
};

export type RewardsDelta = {
  streakCount: number;
  pointsDelta: number;
  unlocked: UnlockedAchievement[];
};

function istKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function shiftKey(key: string, days: number) {
  const d = new Date(`${key}T12:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return istKey(d);
}

function dateOnly(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

function istRange(key: string) {
  return {
    gte: new Date(`${key}T00:00:00+05:30`),
    lt: new Date(`${shiftKey(key, 1)}T00:00:00+05:30`),
  };
}

function initialsOf(first?: string | null, last?: string | null, full?: string | null) {
  const a = (first ?? "").trim();
  const b = (last ?? "").trim();
  if (a && b) return `${a[0]!.toUpperCase()}. ${b[0]!.toUpperCase()}.`;
  if (a) return `${a[0]!.toUpperCase()}.`;
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]!.toUpperCase()}. ${parts[1][0]!.toUpperCase()}.`;
  if (parts[0]) return `${parts[0][0]!.toUpperCase()}.`;
  return "?";
}

export class RewardsService {
  async afterMcq(userId: string, attemptId: string, isCorrect: boolean) {
    const points = await this.award(userId, isCorrect ? "MCQ_CORRECT" : "MCQ_INCORRECT", isCorrect ? 3 : 1, `mcq:${attemptId}`);
    const streak = await this.grantStreakIfQualified(userId, "mcq");
    const unlocked = await this.evaluateAchievements(userId);
    return this.delta(userId, points + streak.points, unlocked);
  }

  async afterFlash(userId: string, reviewId: string) {
    const points = await this.award(userId, "FLASH_REVIEW", 2, `flash:${reviewId}`);
    const streak = await this.grantStreakIfQualified(userId, "flash");
    const unlocked = await this.evaluateAchievements(userId);
    return this.delta(userId, points + streak.points, unlocked);
  }

  async afterTestSubmit(userId: string, testId: string, attemptId: string, daily: boolean, retakeCount = 0) {
    const day = istKey();
    const testPts = daily
      ? await this.award(userId, "DAILY_QUIZ", 15, `daily-quiz:${userId}:${day}`)
      : await this.award(userId, "TEST_SUBMIT", 20, `test-submit:${attemptId}:${retakeCount}`);
    const streak = await this.grantStreakIfQualified(userId, "test");
    const unlocked = await this.evaluateAchievements(userId);
    return this.delta(userId, testPts + streak.points, unlocked);
  }

  async afterNewsRead(userId: string, articleId: string) {
    const points = await this.award(userId, "NEWS_READ", 2, `news:${userId}:${articleId}`);
    const streak = await this.grantStreakIfQualified(userId, "news");
    const unlocked = await this.evaluateAchievements(userId);
    return this.delta(userId, points + streak.points, unlocked);
  }

  async afterTopTen(userId: string, testId: string) {
    await this.award(userId, "TEST_TOP10", 50, `test-top:${testId}:${userId}`);
    await this.evaluateAchievements(userId);
  }

  async refreshStreak(userId: string) {
    const today = istKey();
    const yesterday = shiftKey(today, -1);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { streakCount: true, streakLocalDate: true },
    });
    if (!user) return 0;
    const yesterdayRow = await prisma.streakDay.findUnique({
      where: { userId_date: { userId, date: dateOnly(yesterday) } },
    });
    const todayRow = await prisma.streakDay.findUnique({
      where: { userId_date: { userId, date: dateOnly(today) } },
    });
    if (!todayRow && !yesterdayRow && user.streakCount > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { streakCount: 0, streakLocalDate: null },
      });
      return 0;
    }
    return todayRow || yesterdayRow ? user.streakCount : 0;
  }

  async streakSheet(userId: string) {
    await this.refreshStreak(userId);
    const today = istKey();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { streakCount: true },
    });
    const from = dateOnly(shiftKey(today, -13));
    const rows = await prisma.streakDay.findMany({
      where: { userId, date: { gte: from } },
      select: { date: true, source: true },
    });
    const qualified = new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
    const days = Array.from({ length: 14 }, (_, i) => {
      const key = shiftKey(today, -13 + i);
      return { date: key, qualified: qualified.has(key) };
    });
    return {
      streakCount: user?.streakCount ?? 0,
      days,
      hint: "Do 10 MCQs or 5 cards today to keep it.",
    };
  }

  async myAchievements(userId: string) {
    await this.evaluateAchievements(userId);
    const [defs, unlocks] = await Promise.all([
      prisma.achievement.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        include: { subject: { select: { name: true } } },
      }),
      prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
      }),
    ]);
    const unlockedIds = new Set(unlocks.map((u) => u.achievementId));
    const progressMap = await this.progressMap(userId);
    const earned = unlocks.map((u) => ({
      id: u.achievement.id,
      name: u.achievement.name,
      description: u.achievement.description,
      iconKey: u.achievement.iconKey,
      tier: u.achievement.tier,
      pointsReward: u.achievement.pointsReward,
      unlockedAt: u.unlockedAt.toISOString(),
    }));
    const locked = defs
      .filter((d) => !unlockedIds.has(d.id))
      .map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        iconKey: d.iconKey,
        tier: d.tier,
        pointsReward: d.pointsReward,
        threshold: d.threshold,
        progress: Math.min(progressMap.get(d.id) ?? 0, d.threshold),
      }));
    return { earned, locked };
  }

  async leaderboard(viewerId: string) {
    await this.refreshStreak(viewerId);
    const viewer = await prisma.user.findUnique({
      where: { id: viewerId },
      include: {
        profile: { select: { city: true } },
        curriculum: { include: { program: { select: { id: true, name: true } } } },
      },
    });
    const programId = viewer?.curriculum?.programId ?? null;
    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        status: "ACTIVE",
        profile: { is: { city: { not: null } } },
        ...(programId ? { curriculum: { is: { programId } } } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        pointsBalance: true,
        profile: { select: { city: true } },
        curriculum: { select: { program: { select: { name: true } } } },
      },
    });
    const eligible = students
      .filter((s) => (s.profile?.city ?? "").trim().length > 0)
      .sort((a, b) => b.pointsBalance - a.pointsBalance || a.id.localeCompare(b.id));

    const rows = eligible.map((s, i) => ({
      rank: i + 1,
      userId: s.id,
      initials: initialsOf(s.firstName, s.lastName, s.fullName),
      city: s.profile!.city!.trim(),
      programName: s.curriculum?.program.name ?? "—",
      points: s.pointsBalance,
      isYou: s.id === viewerId,
    }));

    const you = rows.find((r) => r.isYou) ?? null;
    const cityMissing = !(viewer?.profile?.city ?? "").trim();
    const total = rows.length || 1;
    const youRank = you?.rank ?? null;
    const topPercent = youRank ? Math.max(1, Math.round((youRank / total) * 100)) : null;

    return {
      programName: viewer?.curriculum?.program.name ?? null,
      cityMissing,
      you,
      youRank,
      topPercent,
      total,
      podium: rows.slice(0, 3),
      list: rows.slice(0, 50),
    };
  }

  private async delta(userId: string, pointsDelta: number, unlocked: UnlockedAchievement[]) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { streakCount: true, pointsBalance: true },
    });
    return {
      streakCount: user?.streakCount ?? 0,
      pointsBalance: user?.pointsBalance ?? 0,
      pointsDelta,
      unlocked,
    };
  }

  private async award(userId: string, type: string, amount: number, ref: string) {
    const existing = await prisma.pointEvent.findUnique({ where: { ref } });
    if (existing) return 0;
    const day = istKey();
    const range = istRange(day);
    let grant = amount;
    if (type === "FLASH_REVIEW") {
      const used = await prisma.pointEvent.aggregate({
        where: { userId, type: "FLASH_REVIEW", createdAt: range },
        _sum: { amount: true },
      });
      grant = Math.min(grant, Math.max(0, 40 - (used._sum.amount ?? 0)));
    }
    if (type === "MCQ_CORRECT" || type === "MCQ_INCORRECT") {
      const used = await prisma.pointEvent.aggregate({
        where: { userId, type: { in: ["MCQ_CORRECT", "MCQ_INCORRECT"] }, createdAt: range },
        _sum: { amount: true },
      });
      grant = Math.min(grant, Math.max(0, 60 - (used._sum.amount ?? 0)));
    }
    if (grant <= 0) return 0;
    await prisma.$transaction([
      prisma.pointEvent.create({ data: { userId, type, amount: grant, ref } }),
      prisma.user.update({ where: { id: userId }, data: { pointsBalance: { increment: grant } } }),
    ]);
    return grant;
  }

  private async dayQualifies(userId: string, day: string) {
    const range = istRange(day);
    const [flash, mcq, tests, news] = await Promise.all([
      prisma.flashCardReview.count({ where: { userId, createdAt: range } }),
      prisma.mcqAttempt.count({ where: { userId, attemptedAt: range } }),
      prisma.testAttempt.count({
        where: { userId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] }, submittedAt: range },
      }),
      prisma.articleRead.count({ where: { userId, completedAt: range } }),
    ]);
    return { ok: flash >= 5 || mcq >= 10 || tests >= 1 || news >= 1, source: flash >= 5 ? "flash" : mcq >= 10 ? "mcq" : tests >= 1 ? "test" : news >= 1 ? "news" : "none" };
  }

  private async grantStreakIfQualified(userId: string, fallbackSource: string) {
    await this.refreshStreak(userId);
    const today = istKey();
    const yesterday = shiftKey(today, -1);
    const already = await prisma.streakDay.findUnique({
      where: { userId_date: { userId, date: dateOnly(today) } },
    });
    if (already) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { streakCount: true } });
      return { points: 0, streakCount: user?.streakCount ?? 0 };
    }
    const q = await this.dayQualifies(userId, today);
    if (!q.ok) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { streakCount: true } });
      return { points: 0, streakCount: user?.streakCount ?? 0 };
    }
    const yesterdayRow = await prisma.streakDay.findUnique({
      where: { userId_date: { userId, date: dateOnly(yesterday) } },
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { streakCount: true } });
    const next = yesterdayRow ? (user?.streakCount ?? 0) + 1 : 1;
    await prisma.streakDay.create({
      data: { userId, date: dateOnly(today), source: q.source === "none" ? fallbackSource : q.source },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { streakCount: next, streakLocalDate: dateOnly(today) },
    });
    const points = await this.award(userId, "STREAK_DAY", 5, `streak:${userId}:${today}`);
    return { points, streakCount: next };
  }

  private async progressMap(userId: string) {
    const map = new Map<string, number>();
    const defs = await prisma.achievement.findMany({ where: { status: "ACTIVE" } });
    const [mcqCount, flashCount, testCount, newsCount, user] = await Promise.all([
      prisma.mcqAttempt.count({ where: { userId } }),
      prisma.flashCardReview.count({ where: { userId } }),
      prisma.testAttempt.count({ where: { userId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } } }),
      prisma.articleRead.count({ where: { userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { streakCount: true, pointsBalance: true } }),
    ]);
    for (const d of defs) {
      let value = 0;
      if (d.criterion === "STREAK_DAYS") value = user?.streakCount ?? 0;
      else if (d.criterion === "MCQ_ANSWERED") value = mcqCount;
      else if (d.criterion === "FLASH_REVIEWED") value = flashCount;
      else if (d.criterion === "TESTS_SUBMITTED") value = testCount;
      else if (d.criterion === "NEWS_READ") value = newsCount;
      else if (d.criterion === "POINTS_TOTAL") value = user?.pointsBalance ?? 0;
      else if (d.criterion === "SUBJECT_MASTERY" && d.subjectId) {
        value = await this.subjectMastery(userId, d.subjectId);
      } else if (d.criterion === "MODULES_COMPLETE") {
        value = await this.modulesComplete(userId);
      }
      map.set(d.id, value);
    }
    return map;
  }

  private async subjectMastery(userId: string, subjectId: string) {
    const modules = await prisma.curriculumModule.findMany({
      where: { subjectId, curriculum: { userId } },
      select: { chapterId: true },
    });
    const chapterIds = modules.map((m) => m.chapterId);
    if (chapterIds.length === 0) return 0;
    const attempts = await prisma.mcqAttempt.findMany({
      where: { userId, mcq: { chapterId: { in: chapterIds } } },
      orderBy: { attemptedAt: "desc" },
      select: { mcqId: true, isCorrect: true },
    });
    const latest = new Map<string, boolean>();
    for (const a of attempts) {
      if (!latest.has(a.mcqId)) latest.set(a.mcqId, a.isCorrect);
    }
    if (latest.size < 20) return 0;
    const correct = [...latest.values()].filter(Boolean).length;
    return Math.round((correct / latest.size) * 100);
  }

  private async modulesComplete(userId: string) {
    const modules = await prisma.curriculumModule.findMany({
      where: { curriculum: { userId } },
      include: { chapter: { include: { _count: { select: { mcqs: true, flashCards: true } } } } },
    });
    if (modules.length === 0) return 0;
    const chapterIds = modules.map((m) => m.chapterId);
    const [mcqTouched, flashTouched] = await Promise.all([
      prisma.mcqAttempt.findMany({
        where: { userId, mcq: { chapterId: { in: chapterIds } } },
        select: { mcq: { select: { id: true, chapterId: true } } },
      }),
      prisma.flashCardReview.findMany({
        where: { userId, flashCard: { chapterId: { in: chapterIds } } },
        select: { flashCard: { select: { id: true, chapterId: true } } },
      }),
    ]);
    const mcqByCh = new Map<string, Set<string>>();
    for (const a of mcqTouched) {
      const ch = a.mcq.chapterId;
      if (!ch) continue;
      if (!mcqByCh.has(ch)) mcqByCh.set(ch, new Set());
      mcqByCh.get(ch)!.add(a.mcq.id);
    }
    const flashByCh = new Map<string, Set<string>>();
    for (const r of flashTouched) {
      const ch = r.flashCard.chapterId;
      if (!ch) continue;
      if (!flashByCh.has(ch)) flashByCh.set(ch, new Set());
      flashByCh.get(ch)!.add(r.flashCard.id);
    }
    let n = 0;
    for (const m of modules) {
      const total = m.chapter._count.mcqs + m.chapter._count.flashCards;
      if (total === 0) continue;
      const touched = (mcqByCh.get(m.chapterId)?.size ?? 0) + (flashByCh.get(m.chapterId)?.size ?? 0);
      if (touched >= total) n += 1;
    }
    return n;
  }

  async evaluateAchievements(userId: string) {
    const defs = await prisma.achievement.findMany({ where: { status: "ACTIVE" } });
    const already = await prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    const have = new Set(already.map((a) => a.achievementId));
    const progress = await this.progressMap(userId);
    const unlocked: UnlockedAchievement[] = [];
    for (const d of defs) {
      if (have.has(d.id)) continue;
      const value = progress.get(d.id) ?? 0;
      if (value < d.threshold) continue;
      await prisma.userAchievement.create({ data: { userId, achievementId: d.id } });
      await this.award(userId, "ACHIEVEMENT", d.pointsReward, `ach:${userId}:${d.id}`);
      unlocked.push({
        id: d.id,
        name: d.name,
        description: d.description,
        iconKey: d.iconKey,
        tier: d.tier,
        pointsReward: d.pointsReward,
      });
    }
    return unlocked;
  }
}

export const rewardsService = new RewardsService();
