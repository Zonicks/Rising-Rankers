import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";

export class DeviceService {
  async upsert(
    userId: string,
    deviceId: string,
    platform?: string,
    extra?: { ip?: string; userAgent?: string }
  ) {
    return prisma.deviceSession.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: {
        userId,
        deviceId,
        platform,
        lastIp: extra?.ip,
        lastUserAgent: extra?.userAgent,
      },
      update: {
        lastSeenAt: new Date(),
        platform,
        lastIp: extra?.ip,
        lastUserAgent: extra?.userAgent,
        revokedAt: null,
      },
    });
  }

  async assertTestDevice(userId: string, testId: string, deviceId?: string) {
    if (!deviceId) return;

    const attempt = await prisma.testAttempt.findUnique({
      where: { testId_userId: { testId, userId } },
    });

    if (!attempt?.deviceId || attempt.deviceId === deviceId) return;

    const test = await prisma.liveTest.findUnique({ where: { id: testId } });
    if (!test?.scheduledAt) {
      await prisma.testAttempt.update({
        where: { id: attempt.id },
        data: { deviceId },
      });
      return;
    }

    await prisma.fraudFlag.create({
      data: {
        userId,
        testId,
        type: "DEVICE_MISMATCH",
        severity: "HIGH",
        meta: { expected: attempt.deviceId, got: deviceId },
      },
    });
    throw new AppError(
      "DEVICE_MISMATCH",
      "This live test is bound to another device/session",
      403
    );
  }

  async listForUser(userId: string) {
    return prisma.deviceSession.findMany({
      where: { userId },
      orderBy: { lastSeenAt: "desc" },
    });
  }
}

export const deviceService = new DeviceService();
