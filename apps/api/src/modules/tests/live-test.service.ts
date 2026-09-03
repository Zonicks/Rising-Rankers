import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";
import { walletService } from "../wallet/wallet.service";
import { deviceService } from "../devices/device.service";
import { fraudService } from "../fraud/fraud.service";
import {
  awardLabel,
  awardPoolTotal,
  computeAwardPool,
  computeScore,
  distributeAwards,
  distributeFixedAwards,
  resolveAwardRules,
  type AwardRules,
} from "./scoring";
import { rewardsService } from "../rewards/rewards.service";

function asNumber(d: Decimal | number | string) {
  return typeof d === "number" ? d : Number(d);
}

function isoOrNull(at: Date | null | undefined) {
  return at ? at.toISOString() : null;
}

export class LiveTestService {
  async create(input: {
    title: string;
    subject?: string;
    scheduledAt?: string | null;
    durationMinutes: number;
    entryFee: number;
    minAwardPool: number;
    awardRules?: AwardRules;
    platformFeePercent: number;
    negativeMark: number;
    marksPerCorrect: number;
    mcqIds: string[];
  }) {
    const mcqs = await prisma.mcq.findMany({
      where: { id: { in: input.mcqIds }, status: "ACTIVE" },
    });
    if (mcqs.length !== input.mcqIds.length) {
      throw new AppError("INVALID_QUESTIONS", "One or more MCQs are missing or inactive", 400);
    }

    const rules = resolveAwardRules(input.awardRules ?? { mode: "none" }, input.minAwardPool);
    const pool = awardPoolTotal(rules);

    const test = await prisma.liveTest.create({
      data: {
        title: input.title,
        subject: input.subject,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        durationMinutes: input.durationMinutes,
        entryFee: new Decimal(input.entryFee),
        minAwardPool: new Decimal(pool),
        awardRules: rules,
        platformFeePercent: new Decimal(input.platformFeePercent),
        negativeMark: new Decimal(input.negativeMark),
        marksPerCorrect: new Decimal(input.marksPerCorrect),
        status: input.scheduledAt ? "SCHEDULED" : "LIVE",
        questions: {
          create: input.mcqIds.map((mcqId, index) => ({
            mcqId,
            sortOrder: index,
          })),
        },
      },
      include: { questions: true },
    });

    return this.toPublicTest(test.id);
  }

  async listForStudent(userId?: string) {
    return this.catalog(userId);
  }

  isPractice(test: { scheduledAt: Date | null }) {
    return !test.scheduledAt;
  }

  endsAtFor(
    test: { scheduledAt: Date | null; durationMinutes: number },
    attempt?: { startedAt: Date } | null
  ) {
    const startMs = test.scheduledAt
      ? test.scheduledAt.getTime()
      : (attempt?.startedAt.getTime() ?? Date.now());
    return new Date(startMs + test.durationMinutes * 60_000);
  }

  async finalizeIfExpired(userId: string, testId: string) {
    const [test, attempt] = await Promise.all([
      prisma.liveTest.findUnique({ where: { id: testId } }),
      prisma.testAttempt.findUnique({ where: { testId_userId: { testId, userId } } }),
    ]);
    if (!test || !attempt || attempt.status !== "IN_PROGRESS") return null;
    if (Date.now() < this.endsAtFor(test, attempt).getTime()) return null;
    const saved = await prisma.testAnswer.findMany({ where: { attemptId: attempt.id } });
    return this.submit(
      userId,
      testId,
      saved.map((a) => ({ mcqId: a.mcqId, selectedOption: a.selectedOption })),
      true
    );
  }

  async catalog(userId?: string) {
    if (userId) {
      const open = await prisma.testAttempt.findMany({
        where: { userId, status: "IN_PROGRESS" },
        select: { testId: true },
      });
      await Promise.all(open.map((a) => this.finalizeIfExpired(userId, a.testId)));
    }

    const tests = await prisma.liveTest.findMany({
      where: { status: { in: ["SCHEDULED", "LIVE", "COMPLETED"] } },
      include: {
        _count: { select: { registrations: true, questions: true } },
        attempts: userId
          ? {
              where: { userId },
              select: {
                status: true,
                score: true,
                correctCount: true,
                incorrectCount: true,
                retakeCount: true,
                submittedAt: true,
                startedAt: true,
                rank: true,
              },
            }
          : false,
      },
    });

    const rows = tests.map((t) => {
      const fee = asNumber(t.entryFee);
      const attempt = userId && "attempts" in t ? t.attempts[0] : undefined;
      const submitted =
        attempt?.status === "SUBMITTED" || attempt?.status === "AUTO_SUBMITTED";
      const inProgress = attempt?.status === "IN_PROGRESS";
      const practice = this.isPractice(t);
      const ended = !practice && t.status === "COMPLETED";
      const retakeCount = attempt?.retakeCount ?? 0;
      const nextFee = submitted && practice ? (retakeCount === 0 ? 0 : fee) : fee;
      const totalQs = t._count.questions;
      const scorePct =
        submitted && totalQs > 0
          ? Math.round((attempt!.correctCount / totalQs) * 100)
          : null;
      const kind = t.title.toLowerCase().includes("daily")
        ? ("daily" as const)
        : practice
          ? ("practice" as const)
          : ("live" as const);
      const endsAt = inProgress && attempt ? this.endsAtFor(t, attempt) : null;
      const remainingSeconds = endsAt
        ? Math.max(0, Math.floor((endsAt.getTime() - Date.now()) / 1000))
        : null;
      const cta = submitted
        ? practice
          ? ("retake" as const)
          : ("result" as const)
        : inProgress
          ? ("resume" as const)
          : ended
            ? ("ended" as const)
            : ("start" as const);

      return {
        id: t.id,
        title: t.title,
        subject: t.subject,
        kind,
        scheduledAt: isoOrNull(t.scheduledAt),
        durationMinutes: t.durationMinutes,
        entryFee: fee,
        priceLabel:
          cta === "resume"
            ? fee === 0
              ? "FREE"
              : "Paid"
            : (cta === "retake" ? nextFee : fee) === 0
              ? "FREE"
              : `₹${cta === "retake" ? nextFee : fee}`,
        chargeAmount:
          cta === "result" || cta === "ended" || cta === "resume" ? 0 : cta === "retake" ? nextFee : fee,
        remainingSeconds,
        awardPool: awardPoolTotal(resolveAwardRules(t.awardRules, asNumber(t.minAwardPool))) > 0 && !practice,
        awardLabel: awardLabel(resolveAwardRules(t.awardRules, asNumber(t.minAwardPool))),
        minAwardPool: t.minAwardPool.toString(),
        status: t.status,
        participantCount: t._count.registrations,
        questionCount: totalQs,
        completed: Boolean(submitted),
        scorePct,
        rank: attempt?.rank ?? null,
        cta,
        retakeCount,
      };
    });

    rows.sort((a, b) => {
      if (a.cta === "resume" && b.cta !== "resume") return -1;
      if (b.cta === "resume" && a.cta !== "resume") return 1;
      const order = { daily: 0, live: 1, practice: 2 };
      const d = order[a.kind] - order[b.kind];
      if (d !== 0) return d;
      return a.title.localeCompare(b.title);
    });

    const featured =
      rows.find((r) => r.cta === "resume") ??
      rows.find((r) => r.kind === "daily") ??
      rows.find((r) => r.kind === "live" && r.status !== "COMPLETED") ??
      rows[0] ??
      null;

    const subjects = [...new Set(rows.map((r) => r.subject).filter(Boolean))] as string[];

    return { featured, tests: rows, subjects };
  }

  async quizStats(userId: string) {
    const attempts = await prisma.testAttempt.findMany({
      where: {
        userId,
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
      },
      include: {
        test: { select: { id: true, title: true, subject: true, scheduledAt: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    const results = attempts.map((a) => {
      const answered = a.correctCount + a.incorrectCount;
      const accuracy = answered > 0 ? Math.round((a.correctCount / answered) * 100) : null;
      const total = a.correctCount + a.incorrectCount + a.skippedCount;
      const scorePct = total > 0 ? Math.round((a.correctCount / total) * 100) : 0;
      return {
        testId: a.testId,
        title: a.test.title,
        subject: a.test.subject,
        scorePct,
        accuracy,
        rank: a.rank,
        submittedAt: a.submittedAt?.toISOString() ?? null,
      };
    });

    const days: Array<{ date: string; scorePct: number | null }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
      const inDay = results.filter((r) => r.submittedAt && r.submittedAt.slice(0, 10) === key);
      const avg =
        inDay.length === 0
          ? null
          : Math.round(inDay.reduce((n, r) => n + r.scorePct, 0) / inDay.length);
      days.push({ date: key, scorePct: avg });
    }

    const scored = results.filter((r) => r.scorePct != null);
    const avgScore =
      scored.length === 0
        ? null
        : Math.round(scored.reduce((n, r) => n + r.scorePct, 0) / scored.length);
    const withAcc = results.filter((r) => r.accuracy != null);
    const accuracy =
      withAcc.length === 0
        ? null
        : Math.round(withAcc.reduce((n, r) => n + (r.accuracy ?? 0), 0) / withAcc.length);

    const bySubject = new Map<string, number[]>();
    for (const r of results) {
      if (!r.subject) continue;
      if (!bySubject.has(r.subject)) bySubject.set(r.subject, []);
      bySubject.get(r.subject)!.push(r.scorePct);
    }
    let weakSubject: string | null = null;
    let weakAvg = 101;
    for (const [name, scores] of bySubject) {
      const avg = scores.reduce((n, s) => n + s, 0) / scores.length;
      if (avg < weakAvg) {
        weakAvg = avg;
        weakSubject = name;
      }
    }

    return { days, avgScore, accuracy, weakSubject, results };
  }

  async listForAdmin() {
    const tests = await prisma.liveTest.findMany({
      where: { status: { in: ["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { registrations: true, questions: true } },
        awards: { select: { status: true } },
      },
    });
    return tests.map((t) => ({
      id: t.id,
      title: t.title,
      subject: t.subject,
      scheduledAt: isoOrNull(t.scheduledAt),
      durationMinutes: t.durationMinutes,
      entryFee: t.entryFee.toString(),
      minAwardPool: t.minAwardPool.toString(),
      awardRules: resolveAwardRules(t.awardRules, asNumber(t.minAwardPool)),
      awardLabel: awardLabel(resolveAwardRules(t.awardRules, asNumber(t.minAwardPool))),
      status: t.status,
      participantCount: t._count.registrations,
      questionCount: t._count.questions,
      pendingAwardCount: t.awards.filter((a) => a.status === "PENDING_REVIEW").length,
      creditedAwardCount: t.awards.filter((a) => a.status === "CREDITED").length,
    }));
  }

  async toPublicTest(testId: string) {
    const t = await prisma.liveTest.findUnique({
      where: { id: testId },
      include: { _count: { select: { registrations: true, questions: true } } },
    });
    if (!t) throw new AppError("NOT_FOUND", "Test not found", 404);
    return {
      id: t.id,
      title: t.title,
      subject: t.subject,
      scheduledAt: isoOrNull(t.scheduledAt),
      durationMinutes: t.durationMinutes,
      entryFee: t.entryFee.toString(),
      minAwardPool: t.minAwardPool.toString(),
      awardRules: resolveAwardRules(t.awardRules, asNumber(t.minAwardPool)),
      awardLabel: awardLabel(resolveAwardRules(t.awardRules, asNumber(t.minAwardPool))),
      platformFeePercent: t.platformFeePercent.toString(),
      status: t.status,
      participantCount: t._count.registrations,
      questionCount: t._count.questions,
      resultDeclaredAt: t.resultDeclaredAt?.toISOString() ?? null,
    };
  }

  async join(userId: string, testId: string) {
    const test = await prisma.liveTest.findUnique({ where: { id: testId } });
    if (!test) throw new AppError("NOT_FOUND", "Test not found", 404);
    if (test.status === "CANCELLED") {
      throw new AppError("TEST_CLOSED", "This test cannot be joined", 400);
    }
    if (test.status === "DRAFT") {
      throw new AppError("TEST_NOT_OPEN", "Test is not scheduled yet", 400);
    }
    const practice = this.isPractice(test);
    if (test.status === "COMPLETED" && !practice) {
      throw new AppError("TEST_CLOSED", "This test cannot be joined", 400);
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { testId_userId: { testId, userId } },
    });
    const submitted =
      attempt?.status === "SUBMITTED" || attempt?.status === "AUTO_SUBMITTED";

    if (submitted && !practice) {
      return { registrationId: null, alreadyJoined: true, completed: true, charged: 0 };
    }

    if (submitted && practice && attempt) {
      const nextFee = attempt.retakeCount === 0 ? 0 : asNumber(test.entryFee);
      if (nextFee > 0) {
        await walletService.debitDeposited({
          userId,
          amount: nextFee,
          type: "TEST_ENTRY",
          idempotencyKey: `test-entry:${testId}:${userId}:retake:${attempt.retakeCount + 1}`,
          reference: testId,
        });
      }
      await prisma.testAnswer.deleteMany({ where: { attemptId: attempt.id } });
      await prisma.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
          submittedAt: null,
          score: 0,
          correctCount: 0,
          incorrectCount: 0,
          skippedCount: 0,
          timeTakenMs: null,
          rank: null,
          retakeCount: { increment: 1 },
          deviceId: null,
          appSwitchCount: 0,
        },
      });
      const existing = await prisma.testRegistration.findUnique({
        where: { testId_userId: { testId, userId } },
      });
      return {
        registrationId: existing?.id ?? null,
        alreadyJoined: true,
        retake: true,
        charged: nextFee,
      };
    }

    const existing = await prisma.testRegistration.findUnique({
      where: { testId_userId: { testId, userId } },
    });
    if (existing && existing.status === "JOINED") {
      return { registrationId: existing.id, alreadyJoined: true, charged: 0 };
    }

    const fee = asNumber(test.entryFee);
    if (fee > 0) {
      await walletService.debitDeposited({
        userId,
        amount: fee,
        type: "TEST_ENTRY",
        idempotencyKey: `test-entry:${testId}:${userId}`,
        reference: testId,
      });
    }

    const reg = await prisma.testRegistration.upsert({
      where: { testId_userId: { testId, userId } },
      create: {
        testId,
        userId,
        feePaid: test.entryFee,
        status: "JOINED",
      },
      update: {
        feePaid: test.entryFee,
        status: "JOINED",
        joinedAt: new Date(),
      },
    });

    return { registrationId: reg.id, alreadyJoined: false, charged: fee };
  }

  async waitingRoom(userId: string, testId: string) {
    const expired = await this.finalizeIfExpired(userId, testId);
    if (expired) {
      const test = await this.toPublicTest(testId);
      return {
        ...test,
        alreadySubmitted: true,
        canStart: false,
        countdownSeconds: 0,
        serverNow: new Date().toISOString(),
      };
    }
    const [reg, attempt] = await Promise.all([
      prisma.testRegistration.findUnique({
        where: { testId_userId: { testId, userId } },
      }),
      prisma.testAttempt.findUnique({
        where: { testId_userId: { testId, userId } },
      }),
    ]);
    const submitted =
      attempt?.status === "SUBMITTED" || attempt?.status === "AUTO_SUBMITTED";
    if (submitted) {
      const test = await this.toPublicTest(testId);
      return {
        ...test,
        alreadySubmitted: true,
        canStart: false,
        countdownSeconds: 0,
        serverNow: new Date().toISOString(),
      };
    }
    if (!reg || reg.status !== "JOINED") {
      throw new AppError("NOT_JOINED", "Join the test before entering waiting room", 403);
    }
    const test = await this.toPublicTest(testId);
    const now = Date.now();
    const start = test.scheduledAt ? new Date(test.scheduledAt).getTime() : now;
    return {
      ...test,
      alreadySubmitted: false,
      serverNow: new Date().toISOString(),
      countdownSeconds: Math.max(0, Math.floor((start - now) / 1000)),
      canStart: !test.scheduledAt || now >= start || test.status === "LIVE",
    };
  }

  private async ensureLive(testId: string) {
    const test = await prisma.liveTest.findUnique({ where: { id: testId } });
    if (!test) throw new AppError("NOT_FOUND", "Test not found", 404);
    if (test.status === "CANCELLED") throw new AppError("TEST_CANCELLED", "Test cancelled", 400);
    if (test.status === "COMPLETED") {
      throw new AppError("TEST_COMPLETED", "Test already completed", 400);
    }

    const now = Date.now();
    const startMs = test.scheduledAt?.getTime() ?? now;
    if (test.status === "SCHEDULED" && now >= startMs) {
      await prisma.liveTest.update({ where: { id: testId }, data: { status: "LIVE" } });
      return prisma.liveTest.findUniqueOrThrow({ where: { id: testId } });
    }
    if (test.status === "SCHEDULED" && now < startMs) {
      throw new AppError("TEST_NOT_STARTED", "Test has not started yet", 400);
    }
    return test;
  }

  async getSession(userId: string, testId: string, deviceId?: string) {
    const expired = await this.finalizeIfExpired(userId, testId);
    if (expired) {
      throw new AppError("ALREADY_SUBMITTED", "Attempt already submitted", 400);
    }
    const [reg, existing] = await Promise.all([
      prisma.testRegistration.findUnique({
        where: { testId_userId: { testId, userId } },
      }),
      prisma.testAttempt.findUnique({
        where: { testId_userId: { testId, userId } },
      }),
    ]);
    if (existing && existing.status !== "IN_PROGRESS") {
      throw new AppError("ALREADY_SUBMITTED", "Attempt already submitted", 400);
    }
    if (!reg || reg.status !== "JOINED") {
      throw new AppError("NOT_JOINED", "Join the test first", 403);
    }

    let attempt = existing;

    const test = await this.ensureLive(testId);

    if (!attempt) {
      attempt = await prisma.testAttempt.create({
        data: { testId, userId, status: "IN_PROGRESS", deviceId },
      });
    } else if (attempt.deviceId && deviceId && attempt.deviceId !== deviceId) {
      if (this.isPractice(test)) {
        attempt = await prisma.testAttempt.update({
          where: { id: attempt.id },
          data: { deviceId },
        });
      } else {
        throw new AppError(
          "DEVICE_MISMATCH",
          "This live test is bound to another device/session",
          403
        );
      }
    } else if (!attempt.deviceId && deviceId) {
      attempt = await prisma.testAttempt.update({
        where: { id: attempt.id },
        data: { deviceId },
      });
    }

    const endsAt = this.endsAtFor(test, attempt);

    const [questions, saved] = await Promise.all([
      prisma.liveTestQuestion.findMany({
        where: { testId },
        orderBy: { sortOrder: "asc" },
        include: {
          mcq: {
            select: {
              id: true,
              question: true,
              optionA: true,
              optionB: true,
              optionC: true,
              optionD: true,
            },
          },
        },
      }),
      prisma.testAnswer.findMany({ where: { attemptId: attempt.id } }),
    ]);

    const answers: Record<string, string> = {};
    for (const a of saved) {
      if (a.selectedOption) answers[a.mcqId] = a.selectedOption;
    }

    return {
      attemptId: attempt.id,
      testId,
      startedAt: attempt.startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      serverNow: new Date().toISOString(),
      remainingSeconds: Math.max(0, Math.floor((endsAt.getTime() - Date.now()) / 1000)),
      durationMinutes: test.durationMinutes,
      deviceId: attempt.deviceId,
      appSwitchCount: attempt.appSwitchCount,
      answers,
      questions: questions.map((q) => q.mcq),
    };
  }

  async saveAnswer(
    userId: string,
    testId: string,
    mcqId: string,
    selectedOption: string | null,
    deviceId?: string
  ) {
    const attempt = await prisma.testAttempt.findUnique({
      where: { testId_userId: { testId, userId } },
    });
    if (!attempt || attempt.status !== "IN_PROGRESS") {
      throw new AppError("NO_ATTEMPT", "No active attempt", 400);
    }
    await deviceService.assertTestDevice(userId, testId, deviceId);
    const belongs = await prisma.liveTestQuestion.findFirst({
      where: { testId, mcqId },
      select: { id: true },
    });
    if (!belongs) throw new AppError("NOT_FOUND", "Question is not on this test", 404);
    await prisma.testAnswer.upsert({
      where: { attemptId_mcqId: { attemptId: attempt.id, mcqId } },
      create: {
        attemptId: attempt.id,
        mcqId,
        selectedOption,
        isCorrect: false,
      },
      update: { selectedOption },
    });
    return { saved: true, mcqId, selectedOption };
  }

  async recordAppSwitch(userId: string, testId: string, deviceId?: string) {
    await deviceService.assertTestDevice(userId, testId, deviceId);
    const attempt = await prisma.testAttempt.findUnique({
      where: { testId_userId: { testId, userId } },
    });
    if (!attempt || attempt.status !== "IN_PROGRESS") {
      throw new AppError("NO_ATTEMPT", "No active attempt", 400);
    }
    const updated = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: { appSwitchCount: { increment: 1 } },
    });
    await fraudService.checkAppSwitches({
      userId,
      testId,
      appSwitchCount: updated.appSwitchCount,
    });
    return { appSwitchCount: updated.appSwitchCount };
  }

  async submit(
    userId: string,
    testId: string,
    answers: Array<{ mcqId: string; selectedOption?: string | null }>,
    autoSubmit = false,
    opts?: { deviceId?: string; appSwitchCount?: number }
  ) {
    const test = await prisma.liveTest.findUnique({
      where: { id: testId },
      include: { questions: { include: { mcq: true } } },
    });
    if (!test) throw new AppError("NOT_FOUND", "Test not found", 404);

    const attempt = await prisma.testAttempt.findUnique({
      where: { testId_userId: { testId, userId } },
    });
    if (!attempt) throw new AppError("NO_ATTEMPT", "Start the session first", 400);
    if (attempt.status !== "IN_PROGRESS") {
      return this.getResult(userId, testId);
    }

    await deviceService.assertTestDevice(userId, testId, opts?.deviceId);

    const keyMap = new Map(test.questions.map((q) => [q.mcqId, q.mcq.correctOption.toUpperCase()]));
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;

    const answeredCount = answers.filter((a) => a.selectedOption).length;
    const timeTakenMs = Date.now() - attempt.startedAt.getTime();

    await prisma.$transaction(async (tx) => {
      for (const q of test.questions) {
        const ans = answers.find((a) => a.mcqId === q.mcqId);
        const selected = ans?.selectedOption?.toUpperCase() ?? null;
        let isCorrect = false;
        if (!selected) skipped += 1;
        else if (selected === keyMap.get(q.mcqId)) {
          isCorrect = true;
          correct += 1;
        } else incorrect += 1;

        await tx.testAnswer.upsert({
          where: { attemptId_mcqId: { attemptId: attempt.id, mcqId: q.mcqId } },
          create: {
            attemptId: attempt.id,
            mcqId: q.mcqId,
            selectedOption: selected,
            isCorrect,
          },
          update: { selectedOption: selected, isCorrect },
        });
      }

      const score = computeScore({
        correct,
        incorrect,
        marksPerCorrect: asNumber(test.marksPerCorrect),
        negativeMark: asNumber(test.negativeMark),
      });

      await tx.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: autoSubmit ? "AUTO_SUBMITTED" : "SUBMITTED",
          submittedAt: new Date(),
          score: new Decimal(score),
          correctCount: correct,
          incorrectCount: incorrect,
          skippedCount: skipped,
          timeTakenMs,
          appSwitchCount: opts?.appSwitchCount ?? attempt.appSwitchCount,
        },
      });
    });

    await fraudService.checkSubmitSpeed({
      userId,
      testId,
      answeredCount,
      timeTakenMs,
      correctCount: correct,
      questionCount: test.questions.length,
    });
    if ((opts?.appSwitchCount ?? attempt.appSwitchCount) > 0) {
      await fraudService.checkAppSwitches({
        userId,
        testId,
        appSwitchCount: opts?.appSwitchCount ?? attempt.appSwitchCount,
      });
    }

    const daily = /daily/i.test(test.title);
    const rewards = await rewardsService.afterTestSubmit(
      userId,
      testId,
      attempt.id,
      daily,
      attempt.retakeCount ?? 0
    );
    const result = await this.getResult(userId, testId);
    return { ...result, rewards };
  }

  async getResult(userId: string, testId: string) {
    const attempt = await prisma.testAttempt.findUnique({
      where: { testId_userId: { testId, userId } },
      include: { test: { select: { title: true, subject: true } } },
    });
    if (!attempt || attempt.status === "IN_PROGRESS") {
      throw new AppError("RESULT_PENDING", "Result not available yet", 400);
    }
    const award = await prisma.awardPayout.findUnique({
      where: { testId_userId: { testId, userId } },
    });
    const total = attempt.correctCount + attempt.incorrectCount + attempt.skippedCount;
    const answered = attempt.correctCount + attempt.incorrectCount;
    return {
      title: attempt.test.title,
      subject: attempt.test.subject,
      score: attempt.score.toString(),
      scorePct: total > 0 ? Math.round((attempt.correctCount / total) * 100) : 0,
      accuracy: answered > 0 ? Math.round((attempt.correctCount / answered) * 100) : null,
      correctCount: attempt.correctCount,
      incorrectCount: attempt.incorrectCount,
      skippedCount: attempt.skippedCount,
      timeTakenMs: attempt.timeTakenMs,
      rank: attempt.rank,
      status: attempt.status,
      award: award
        ? { amount: award.amount.toString(), status: award.status, rank: award.rank }
        : null,
    };
  }

  async cancel(testId: string, reason?: string) {
    const test = await prisma.liveTest.findUnique({
      where: { id: testId },
      include: { registrations: { where: { status: "JOINED" } } },
    });
    if (!test) throw new AppError("NOT_FOUND", "Test not found", 404);
    if (test.status === "CANCELLED") return { refunded: 0 };

    await prisma.liveTest.update({
      where: { id: testId },
      data: { status: "CANCELLED", cancelReason: reason ?? "Cancelled by admin" },
    });

    let refunded = 0;
    for (const reg of test.registrations) {
      await walletService.credit({
        userId: reg.userId,
        amount: asNumber(reg.feePaid),
        bucket: "deposited",
        type: "REFUND",
        idempotencyKey: `test-refund:${testId}:${reg.userId}`,
        reference: testId,
        note: reason,
      });
      await prisma.testRegistration.update({
        where: { id: reg.id },
        data: { status: "REFUNDED" },
      });
      refunded += 1;
    }
    return { refunded };
  }

  /** Rank attempts and build award payouts pending finance review */
  async declareResults(testId: string) {
    const test = await prisma.liveTest.findUnique({
      where: { id: testId },
      include: {
        registrations: { where: { status: "JOINED" } },
        attempts: { where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } } },
      },
    });
    if (!test) throw new AppError("NOT_FOUND", "Test not found", 404);
    if (test.status === "CANCELLED") throw new AppError("TEST_CANCELLED", "Cancelled", 400);
    if (test.status === "COMPLETED") {
      throw new AppError("RESULTS_DECLARED", "Results are already declared", 400);
    }

    const attempts = [...test.attempts].sort((a, b) => {
      const scoreDiff = asNumber(b.score) - asNumber(a.score);
      if (scoreDiff !== 0) return scoreDiff;
      const timeA = a.timeTakenMs ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.timeTakenMs ?? Number.MAX_SAFE_INTEGER;
      if (timeA !== timeB) return timeA - timeB;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      if (a.incorrectCount !== b.incorrectCount) return a.incorrectCount - b.incorrectCount;
      return (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0);
    });

    for (let i = 0; i < attempts.length; i++) {
      await prisma.testAttempt.update({
        where: { id: attempts[i].id },
        data: { rank: i + 1 },
      });
    }

    const validCount = test.registrations.length;
    const rankedIds = attempts.map((a) => a.userId);
    const rules = resolveAwardRules(test.awardRules, asNumber(test.minAwardPool));
    const feePercent = asNumber(test.platformFeePercent);
    let gross = validCount * asNumber(test.entryFee);
    let fee = (gross * feePercent) / 100;
    let subsidy = 0;
    let net = Math.max(0, gross - fee);
    let payouts: Array<{ userId: string; rank: number; amount: number }> = [];

    if (rules.mode === "fixed") {
      payouts = distributeFixedAwards({
        prizes: rules.prizes ?? [],
        winnerUserIdsInRankOrder: rankedIds,
      });
      net = payouts.reduce((n, p) => n + p.amount, 0);
      subsidy = Math.max(0, net - Math.max(0, gross - fee));
    } else if (rules.mode === "pool") {
      const pool = computeAwardPool({
        participantCount: validCount,
        entryFee: asNumber(test.entryFee),
        platformFeePercent: feePercent,
        minAwardPool: rules.minAwardPool ?? asNumber(test.minAwardPool),
        winnerPercent: rules.winnerPercent,
      });
      gross = pool.gross;
      fee = pool.fee;
      subsidy = pool.subsidy;
      net = pool.net;
      payouts = distributeAwards({
        net,
        winnerUserIdsInRankOrder: rankedIds.slice(0, Math.min(pool.winnerCount, rankedIds.length)),
        topBandCount: rules.topBandCount,
        topSharePercent: rules.topSharePercent,
      });
    }

    await prisma.awardPayout.deleteMany({ where: { testId } });

    for (const row of payouts) {
      await prisma.awardPayout.create({
        data: {
          testId,
          userId: row.userId,
          rank: row.rank,
          amount: new Decimal(row.amount),
          status: "PENDING_REVIEW",
          reportMeta: {
            mode: rules.mode,
            gross,
            fee,
            subsidy,
            net,
            winnerCount: payouts.length,
          },
        },
      });
    }

    await prisma.liveTest.update({
      where: { id: testId },
      data: { status: "COMPLETED", resultDeclaredAt: new Date() },
    });

    const isLiveContest = asNumber(test.entryFee) > 0 || Boolean(test.scheduledAt);
    if (isLiveContest && attempts.length > 0) {
      const topN = Math.max(1, Math.ceil(attempts.length * 0.1));
      for (const row of attempts.slice(0, topN)) {
        await rewardsService.afterTopTen(row.userId, testId);
      }
    }

    return {
      testId,
      participantCount: validCount,
      gross,
      platformFee: fee,
      subsidy,
      netDistributable: net,
      winners: payouts,
    };
  }

  async approveAwards(testId: string) {
    const pending = await prisma.awardPayout.findMany({
      where: { testId, status: "PENDING_REVIEW" },
    });
    for (const row of pending) {
      await walletService.credit({
        userId: row.userId,
        amount: asNumber(row.amount),
        bucket: "award",
        type: "AWARD_CREDIT",
        idempotencyKey: `award:${testId}:${row.userId}`,
        reference: testId,
      });
      await prisma.awardPayout.update({
        where: { id: row.id },
        data: { status: "CREDITED", creditedAt: new Date() },
      });
    }
    return { credited: pending.length };
  }

  async awardReport(testId: string) {
    const test = await this.toPublicTest(testId);
    const awards = await prisma.awardPayout.findMany({
      where: { testId },
      orderBy: { rank: "asc" },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    return {
      test,
      awards: awards.map((a) => ({
        userId: a.userId,
        email: a.user.email,
        fullName: a.user.fullName,
        rank: a.rank,
        amount: a.amount.toString(),
        status: a.status,
        reportMeta: a.reportMeta,
      })),
    };
  }

  async listSubmissions(opts?: { testId?: string; take?: number }) {
    const attempts = await prisma.testAttempt.findMany({
      where: {
        ...(opts?.testId ? { testId: opts.testId } : {}),
        status: { not: "IN_PROGRESS" },
      },
      orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
      take: opts?.take ?? 200,
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        test: { select: { id: true, title: true, status: true } },
      },
    });

    return attempts.map((a) => ({
      id: a.id,
      testId: a.testId,
      testTitle: a.test.title,
      testStatus: a.test.status,
      userId: a.userId,
      email: a.user.email,
      fullName: a.user.fullName,
      status: a.status,
      score: a.score.toString(),
      correctCount: a.correctCount,
      incorrectCount: a.incorrectCount,
      skippedCount: a.skippedCount,
      timeTakenMs: a.timeTakenMs,
      rank: a.rank,
      appSwitchCount: a.appSwitchCount,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
    }));
  }

  async getSubmission(attemptId: string) {
    const a = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        test: { select: { id: true, title: true, status: true } },
        answers: true,
      },
    });
    if (!a) throw new AppError("NOT_FOUND", "Submission not found", 404);

    const mcqIds = a.answers.map((ans) => ans.mcqId);
    const mcqs = await prisma.mcq.findMany({
      where: { id: { in: mcqIds } },
      select: {
        id: true,
        question: true,
        correctOption: true,
      },
    });
    const mcqMap = new Map(mcqs.map((m) => [m.id, m]));

    return {
      id: a.id,
      testId: a.testId,
      testTitle: a.test.title,
      userId: a.userId,
      email: a.user.email,
      fullName: a.user.fullName,
      status: a.status,
      score: a.score.toString(),
      correctCount: a.correctCount,
      incorrectCount: a.incorrectCount,
      skippedCount: a.skippedCount,
      timeTakenMs: a.timeTakenMs,
      rank: a.rank,
      appSwitchCount: a.appSwitchCount,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
      answers: a.answers.map((ans) => {
        const mcq = mcqMap.get(ans.mcqId);
        return {
          mcqId: ans.mcqId,
          question: mcq?.question ?? "—",
          selectedOption: ans.selectedOption,
          correctOption: mcq?.correctOption ?? null,
          isCorrect: ans.isCorrect,
        };
      }),
    };
  }
}

export const liveTestService = new LiveTestService();
