import { prisma } from "../../infrastructure/database/prisma";

export class FraudService {
  async flag(input: {
    userId: string;
    testId?: string;
    type: string;
    severity?: string;
    meta?: unknown;
  }) {
    return prisma.fraudFlag.create({
      data: {
        userId: input.userId,
        testId: input.testId,
        type: input.type,
        severity: input.severity ?? "MEDIUM",
        meta: input.meta as object | undefined,
      },
    });
  }

  /** Impossible / suspicious answer speed: < 1.5s per answered question */
  async checkSubmitSpeed(input: {
    userId: string;
    testId: string;
    answeredCount: number;
    timeTakenMs: number;
    correctCount: number;
    questionCount: number;
  }) {
    if (input.answeredCount <= 0) return null;
    const msPerAnswer = input.timeTakenMs / input.answeredCount;
    const perfect = input.correctCount === input.questionCount && input.questionCount >= 3;

    if (msPerAnswer < 1500 && input.answeredCount >= 3) {
      return this.flag({
        userId: input.userId,
        testId: input.testId,
        type: "SPEED_ANOMALY",
        severity: perfect ? "HIGH" : "MEDIUM",
        meta: {
          msPerAnswer: Math.round(msPerAnswer),
          answeredCount: input.answeredCount,
          timeTakenMs: input.timeTakenMs,
          correctCount: input.correctCount,
        },
      });
    }
    return null;
  }

  async checkAppSwitches(input: {
    userId: string;
    testId: string;
    appSwitchCount: number;
  }) {
    if (input.appSwitchCount >= 3) {
      return this.flag({
        userId: input.userId,
        testId: input.testId,
        type: "APP_SWITCH_THRESHOLD",
        severity: input.appSwitchCount >= 5 ? "HIGH" : "MEDIUM",
        meta: { appSwitchCount: input.appSwitchCount },
      });
    }
    return null;
  }

  async list(take = 100) {
    return prisma.fraudFlag.findMany({
      orderBy: { createdAt: "desc" },
      take,
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
  }
}

export const fraudService = new FraudService();
