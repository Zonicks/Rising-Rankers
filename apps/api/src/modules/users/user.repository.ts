import { prisma } from "../../infrastructure/database/prisma";

export class UserRepository {
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { profile: true, wallet: true },
    });
  }

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        wallet: true,
        curriculum: {
          include: {
            program: { select: { id: true, name: true, slug: true } },
            _count: { select: { modules: true } },
          },
        },
      },
    });
  }

  createStudent(data: { email: string; passwordHash: string; fullName?: string }) {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        role: "STUDENT",
        profile: { create: {} },
        wallet: { create: {} },
      },
      include: { profile: true, wallet: true },
    });
  }

  updateProfile(
    userId: string,
    data: {
      fullName?: string;
      firstName?: string;
      lastName?: string;
      mobile?: string | null;
      classOrExam?: string | null;
      city?: string | null;
      state?: string | null;
      parentGuardian?: string | null;
      dateOfBirth?: Date | null;
      consentAccepted?: boolean;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const userPatch: Record<string, unknown> = {};
      if (data.fullName !== undefined) userPatch.fullName = data.fullName;
      if (data.firstName !== undefined) userPatch.firstName = data.firstName;
      if (data.lastName !== undefined) userPatch.lastName = data.lastName;
      if (Object.keys(userPatch).length) {
        await tx.user.update({ where: { id: userId }, data: userPatch });
      }
      const existing = await tx.userProfile.findUnique({ where: { userId } });
      const profileData: Record<string, unknown> = {};
      if (data.mobile !== undefined) profileData.mobile = data.mobile;
      if (data.classOrExam !== undefined) profileData.classOrExam = data.classOrExam;
      if (data.city !== undefined) profileData.city = data.city;
      if (data.state !== undefined) profileData.state = data.state;
      if (data.parentGuardian !== undefined) profileData.parentGuardian = data.parentGuardian;
      if (data.dateOfBirth !== undefined) profileData.dateOfBirth = data.dateOfBirth;
      if (data.consentAccepted === true) {
        profileData.consentAccepted = true;
        if (!existing?.consentAccepted) {
          profileData.consentAt = new Date();
        }
      }
      if (data.consentAccepted === false) {
        profileData.consentAccepted = false;
      }
      const merged = { ...(existing ?? {}), ...profileData } as {
        fullName?: string;
        classOrExam?: string | null;
        consentAccepted?: boolean;
      };
      const user = await tx.user.findUnique({ where: { id: userId } });
      const profileComplete = Boolean(
        (data.fullName ?? user?.fullName) &&
          (data.classOrExam !== undefined ? data.classOrExam : existing?.classOrExam) &&
          (data.consentAccepted === true || existing?.consentAccepted)
      );
      profileData.profileComplete = profileComplete;

      await tx.userProfile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData,
      });

      return tx.user.findUnique({
        where: { id: userId },
        include: { profile: true, wallet: true },
      });
    });
  }

  updatePasswordHash(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}

export const userRepository = new UserRepository();
