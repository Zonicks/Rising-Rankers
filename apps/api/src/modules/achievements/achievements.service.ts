import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";

type AchievementInput = {
  name: string;
  description: string;
  iconKey?: string;
  tier?: "GOLD" | "SILVER" | "BRONZE";
  criterion:
    | "STREAK_DAYS"
    | "MCQ_ANSWERED"
    | "FLASH_REVIEWED"
    | "TESTS_SUBMITTED"
    | "SUBJECT_MASTERY"
    | "MODULES_COMPLETE"
    | "NEWS_READ"
    | "POINTS_TOTAL";
  threshold: number;
  pointsReward?: number;
  programId?: string | null;
  subjectId?: string | null;
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
};

async function assertRefs(programId?: string | null, subjectId?: string | null) {
  if (programId) {
    const program = await prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new AppError("NOT_FOUND", "Program not found", 404);
  }
  if (subjectId) {
    const subject = await prisma.programSubject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new AppError("NOT_FOUND", "Subject not found", 404);
  }
}

export class AchievementsService {
  list() {
    return prisma.achievement.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        program: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        _count: { select: { unlocks: true } },
      },
    });
  }

  async create(input: AchievementInput) {
    if (input.criterion === "SUBJECT_MASTERY" && !input.subjectId) {
      throw new AppError("VALIDATION_ERROR", "Subject mastery needs a subject", 400);
    }
    await assertRefs(input.programId, input.subjectId);
    return prisma.achievement.create({
      data: {
        name: input.name,
        description: input.description,
        iconKey: input.iconKey ?? "emoji_events",
        tier: input.tier ?? "BRONZE",
        criterion: input.criterion,
        threshold: input.threshold,
        pointsReward: input.pointsReward ?? 25,
        programId: input.programId ?? null,
        subjectId: input.subjectId ?? null,
        status: input.status ?? "ACTIVE",
      },
      include: {
        program: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        _count: { select: { unlocks: true } },
      },
    });
  }

  async update(id: string, input: Partial<AchievementInput>) {
    const existing = await prisma.achievement.findUnique({ where: { id } });
    if (!existing) throw new AppError("NOT_FOUND", "Achievement not found", 404);
    const criterion = input.criterion ?? existing.criterion;
    const subjectId = input.subjectId === undefined ? existing.subjectId : input.subjectId;
    if (criterion === "SUBJECT_MASTERY" && !subjectId) {
      throw new AppError("VALIDATION_ERROR", "Subject mastery needs a subject", 400);
    }
    await assertRefs(
      input.programId === undefined ? existing.programId : input.programId,
      subjectId
    );
    return prisma.achievement.update({
      where: { id },
      data: input,
      include: {
        program: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        _count: { select: { unlocks: true } },
      },
    });
  }
}

export const achievementsService = new AchievementsService();
