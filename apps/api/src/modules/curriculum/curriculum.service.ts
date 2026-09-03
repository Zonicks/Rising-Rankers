import { prisma } from "../../infrastructure/database/prisma";
import { AppError } from "../../shared/errors/app-error";

export class CurriculumService {
  async build(
    userId: string,
    input: {
      firstName: string;
      lastName: string;
      programId: string;
      targetYear: number | null;
    }
  ) {
    const program = await prisma.program.findUnique({
      where: { id: input.programId },
      include: {
        subjects: {
          where: { status: "ACTIVE" },
          orderBy: { sortOrder: "asc" },
          include: {
            books: {
              where: { status: "ACTIVE", includedInProgram: true },
              orderBy: { sortOrder: "asc" },
              include: {
                chapters: {
                  where: { status: "ACTIVE" },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
            topics: {
              where: { status: "ACTIVE" },
              orderBy: { sortOrder: "asc" },
              include: {
                chapters: {
                  where: { status: "ACTIVE" },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });
    if (!program || program.status !== "ACTIVE") {
      throw new AppError("NOT_FOUND", "Program not found", 404);
    }

    const modules: { chapterId: string; subjectId: string; sortOrder: number }[] = [];
    let sort = 0;
    const seen = new Set<string>();
    for (const subject of program.subjects) {
      for (const book of subject.books) {
        for (const chapter of book.chapters) {
          if (seen.has(chapter.id)) continue;
          seen.add(chapter.id);
          modules.push({ chapterId: chapter.id, subjectId: subject.id, sortOrder: sort++ });
        }
      }
      for (const topic of subject.topics) {
        for (const chapter of topic.chapters) {
          if (seen.has(chapter.id)) continue;
          seen.add(chapter.id);
          modules.push({ chapterId: chapter.id, subjectId: subject.id, sortOrder: sort++ });
        }
      }
    }

    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();

    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { firstName, lastName, fullName },
      });
      await tx.userProfile.upsert({
        where: { userId },
        create: { userId, curriculumComplete: true, classOrExam: program.name },
        update: { curriculumComplete: true, classOrExam: program.name },
      });

      const existing = await tx.studentCurriculum.findUnique({ where: { userId } });
      const curriculum = existing
        ? await tx.studentCurriculum.update({
            where: { id: existing.id },
            data: {
              programId: program.id,
              targetYear: input.targetYear,
              rebuiltAt: new Date(),
            },
          })
        : await tx.studentCurriculum.create({
            data: {
              userId,
              programId: program.id,
              targetYear: input.targetYear,
            },
          });

      await tx.curriculumModule.deleteMany({ where: { curriculumId: curriculum.id } });
      if (modules.length > 0) {
        await tx.curriculumModule.createMany({
          data: modules.map((m) => ({ curriculumId: curriculum.id, ...m })),
        });
      }

      return {
        curriculumComplete: true as const,
        program: { id: program.id, name: program.name, slug: program.slug },
        targetYear: input.targetYear,
        moduleCount: modules.length,
      };
    });
  }
}

export const curriculumService = new CurriculumService();
