import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/infrastructure/database/prisma";
import { settingsService, DEFAULT_SETTINGS } from "../src/modules/settings/settings.service";
import { demoFlash, demoMcq, extraArticles, extraFlash, extraMcq } from "./seed-catalog";

async function seed() {
  const adminEmail = "admin@learning.local";
  const adminPassword = "Admin123!";
  const adminHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: "SUPER_ADMIN",
      passwordHash: adminHash,
      status: "ACTIVE",
      firstName: "Super",
      lastName: "Admin",
      fullName: "Super Admin",
    },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      fullName: "Super Admin",
      firstName: "Super",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      profile: { create: { profileComplete: true, consentAccepted: true, consentAt: new Date() } },
      wallet: { create: {} },
    },
  });

  const studentEmail = "student@learning.local";
  const studentPassword = "Student123!";
  const studentHash = await bcrypt.hash(studentPassword, 10);

  const student = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {
      role: "STUDENT",
      passwordHash: studentHash,
      status: "ACTIVE",
      firstName: "Demo",
      lastName: "Student",
      fullName: "Demo Student",
    },
    create: {
      email: studentEmail,
      passwordHash: studentHash,
      fullName: "Demo Student",
      firstName: "Demo",
      lastName: "Student",
      role: "STUDENT",
      profile: { create: { profileComplete: true, consentAccepted: true, consentAt: new Date() } },
      wallet: { create: {} },
    },
  });

  await settingsService.update(DEFAULT_SETTINGS);

  await prisma.appSetting.upsert({
    where: { key: "hardening" },
    create: {
      key: "hardening",
      value: {
        speedMsPerAnswerThreshold: 1500,
        appSwitchFlagAt: 3,
        appSwitchHighAt: 5,
        authRatePerMinute: 30,
        joinRatePerMinute: 20,
        webhookRatePerMinute: 120,
      },
    },
    update: {},
  });

  const scienceChapter =
    (await prisma.chapter.findFirst({ where: { title: "Basics of Science", subject: "Science" } })) ??
    (await prisma.chapter.create({
      data: {
        title: "Basics of Science",
        subject: "Science",
        description: "Foundational science prompts and MCQs",
        sortOrder: 1,
      },
    }));

  const mathChapter =
    (await prisma.chapter.findFirst({ where: { title: "Arithmetic Basics", subject: "Math" } })) ??
    (await prisma.chapter.create({
      data: {
        title: "Arithmetic Basics",
        subject: "Math",
        description: "Simple arithmetic practice",
        sortOrder: 2,
      },
    }));

  async function ensureChapter(input: {
    title: string;
    subject: string;
    description: string;
    sortOrder: number;
    topicId: string;
  }) {
    const existing = await prisma.chapter.findFirst({
      where: { title: input.title, subject: input.subject },
    });
    if (existing) {
      return prisma.chapter.update({
        where: { id: existing.id },
        data: {
          topicId: input.topicId,
          description: input.description,
          sortOrder: input.sortOrder,
          status: "ACTIVE",
        },
      });
    }
    return prisma.chapter.create({
      data: {
        title: input.title,
        subject: input.subject,
        description: input.description,
        sortOrder: input.sortOrder,
        topicId: input.topicId,
      },
    });
  }

  function catalogSlug(value: string) {
    const slug = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "item";
  }

  async function attachDefaultBooks() {
    const author = await prisma.author.upsert({
      where: { slug: "rising-rankers" },
      update: {
        name: "Rising Rankers",
        bio: "Official syllabus packs for each subject.",
        status: "ACTIVE",
        sortOrder: 0,
      },
      create: {
        name: "Rising Rankers",
        slug: "rising-rankers",
        bio: "Official syllabus packs for each subject.",
        status: "ACTIVE",
        sortOrder: 0,
      },
    });

    const subjects = await prisma.programSubject.findMany({
      include: {
        program: { select: { slug: true } },
        topics: { select: { id: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    for (const subject of subjects) {
      const title = `${subject.name} syllabus`;
      const slug = `${subject.program.slug}-${catalogSlug(subject.name)}-syllabus`;
      const book = await prisma.book.upsert({
        where: { subjectId_title: { subjectId: subject.id, title } },
        update: {
          authorId: author.id,
          includedInProgram: true,
          price: 0,
          status: "ACTIVE",
          subtitle: "Core syllabus chapters for this subject",
        },
        create: {
          subjectId: subject.id,
          authorId: author.id,
          title,
          slug,
          subtitle: "Core syllabus chapters for this subject",
          price: 0,
          includedInProgram: true,
          sortOrder: 0,
          status: "ACTIVE",
        },
      });
      const topicIds = subject.topics.map((t) => t.id);
      if (topicIds.length) {
        await prisma.chapter.updateMany({
          where: { topicId: { in: topicIds }, bookId: null },
          data: { bookId: book.id },
        });
      }
    }

    const orphaned = await prisma.chapter.findMany({
      where: { bookId: null, topicId: { not: null } },
      select: { id: true, topic: { select: { subjectId: true } } },
    });
    for (const row of orphaned) {
      if (!row.topic) continue;
      const book = await prisma.book.findFirst({
        where: { subjectId: row.topic.subjectId, includedInProgram: true },
        orderBy: { sortOrder: "asc" },
      });
      if (book) {
        await prisma.chapter.update({ where: { id: row.id }, data: { bookId: book.id } });
      }
    }
  }

  async function upsertAuthor(input: { slug: string; name: string; bio: string; sortOrder: number }) {
    return prisma.author.upsert({
      where: { slug: input.slug },
      update: { name: input.name, bio: input.bio, status: "ACTIVE", sortOrder: input.sortOrder },
      create: {
        slug: input.slug,
        name: input.name,
        bio: input.bio,
        status: "ACTIVE",
        sortOrder: input.sortOrder,
      },
    });
  }

  async function upsertNamedBook(input: {
    subjectId: string;
    authorId: string;
    title: string;
    slug: string;
    subtitle: string;
    price: number;
    includedInProgram: boolean;
    sortOrder: number;
  }) {
    const existing = await prisma.book.findUnique({
      where: { subjectId_title: { subjectId: input.subjectId, title: input.title } },
    });
    if (existing) {
      return prisma.book.update({
        where: { id: existing.id },
        data: {
          authorId: input.authorId,
          subtitle: input.subtitle,
          price: input.price,
          includedInProgram: input.includedInProgram,
          sortOrder: input.sortOrder,
          status: "ACTIVE",
        },
      });
    }
    const slugTaken = await prisma.book.findUnique({ where: { slug: input.slug } });
    return prisma.book.create({
      data: {
        subjectId: input.subjectId,
        authorId: input.authorId,
        title: input.title,
        slug: slugTaken ? `${input.slug}-${catalogSlug(input.subjectId).slice(0, 8)}` : input.slug,
        subtitle: input.subtitle,
        price: input.price,
        includedInProgram: input.includedInProgram,
        sortOrder: input.sortOrder,
        status: "ACTIVE",
      },
    });
  }

  async function ensureBookChapter(input: {
    bookId: string;
    title: string;
    subject: string;
    description: string;
    sortOrder: number;
    topicId: string;
  }) {
    const existing = await prisma.chapter.findFirst({
      where: { bookId: input.bookId, title: input.title },
    });
    if (existing) {
      return prisma.chapter.update({
        where: { id: existing.id },
        data: {
          subject: input.subject,
          description: input.description,
          sortOrder: input.sortOrder,
          topicId: input.topicId,
          status: "ACTIVE",
        },
      });
    }
    return prisma.chapter.create({
      data: {
        bookId: input.bookId,
        title: input.title,
        subject: input.subject,
        description: input.description,
        sortOrder: input.sortOrder,
        topicId: input.topicId,
        status: "ACTIVE",
      },
    });
  }

  async function insertFlash(rows: typeof extraFlash, chapterByKey: Map<string, { id: string }>) {
    const existing = await prisma.flashCard.findMany({ select: { front: true } });
    const fronts = new Set(existing.map((f) => f.front));
    const data = rows
      .map((c) => {
        const chapter = chapterByKey.get(c.chapterKey);
        if (!chapter) return null;
        return {
          chapterId: chapter.id,
          front: c.front,
          back: c.back,
          subject: c.subject,
          topic: c.topic,
          difficulty: c.difficulty,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row) && !fronts.has(row!.front));
    if (data.length) await prisma.flashCard.createMany({ data });
  }

  async function insertMcq(rows: typeof extraMcq, chapterByKey: Map<string, { id: string }>) {
    const existing = await prisma.mcq.findMany({ select: { question: true } });
    const questions = new Set(existing.map((m) => m.question));
    const data = rows
      .map((q) => {
        const chapter = chapterByKey.get(q.chapterKey);
        if (!chapter) return null;
        return {
          chapterId: chapter.id,
          question: q.question,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          explanation: q.explanation,
          subject: q.subject,
          topic: q.topic,
          difficulty: q.difficulty,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row) && !questions.has(row!.question));
    if (data.length) await prisma.mcq.createMany({ data });
  }

  async function seedNamedDemoBooks(input: {
    politySubjectId: string;
    polityTopicId: string;
    historySubjectId: string;
    historyTopicId: string;
    neetPhysicsId: string;
    mechanicsTopicId: string;
  }) {
    const laxmikanth = await upsertAuthor({
      slug: "m-laxmikanth",
      name: "M. Laxmikanth",
      bio: "Author of Indian Polity, a standard text for UPSC prelims and mains.",
      sortOrder: 10,
    });
    const spectrum = await upsertAuthor({
      slug: "rajiv-ahir",
      name: "Rajiv Ahir (Spectrum)",
      bio: "Author of Spectrum’s A Brief History of Modern India.",
      sortOrder: 11,
    });
    const verma = await upsertAuthor({
      slug: "hc-verma",
      name: "H.C. Verma",
      bio: "Author of Concepts of Physics (HC Verma), widely used for NEET and JEE mechanics.",
      sortOrder: 12,
    });

    const polityBook = await upsertNamedBook({
      subjectId: input.politySubjectId,
      authorId: laxmikanth.id,
      title: "Indian Polity",
      slug: "upsc-indian-polity",
      subtitle: "Constitution, rights, and Union machinery",
      price: 0,
      includedInProgram: true,
      sortOrder: 10,
    });
    const historyBook = await upsertNamedBook({
      subjectId: input.historySubjectId,
      authorId: spectrum.id,
      title: "A Brief History of Modern India",
      slug: "upsc-spectrum-modern-india",
      subtitle: "Spectrum · national movement from 1857 to independence",
      price: 0,
      includedInProgram: true,
      sortOrder: 10,
    });
    const physicsBook = await upsertNamedBook({
      subjectId: input.neetPhysicsId,
      authorId: verma.id,
      title: "Concepts of Physics Volume 1",
      slug: "neet-hcv-vol1",
      subtitle: "HC Verma · mechanics and energy for NEET",
      price: 49,
      includedInProgram: true,
      sortOrder: 10,
    });

    const laxRights = await ensureBookChapter({
      bookId: polityBook.id,
      title: "Fundamental Rights (Laxmikanth)",
      subject: "Polity",
      description: "Part III, Article 32, and writs",
      sortOrder: 1,
      topicId: input.polityTopicId,
    });
    const laxParliament = await ensureBookChapter({
      bookId: polityBook.id,
      title: "Parliament (Laxmikanth)",
      subject: "Polity",
      description: "Lok Sabha, Rajya Sabha, and Money Bills",
      sortOrder: 2,
      topicId: input.polityTopicId,
    });
    const revolt = await ensureBookChapter({
      bookId: historyBook.id,
      title: "Revolt of 1857",
      subject: "History",
      description: "Causes, centres, and the end of Company rule",
      sortOrder: 1,
      topicId: input.historyTopicId,
    });
    const gandhi = await ensureBookChapter({
      bookId: historyBook.id,
      title: "Gandhian Era",
      subject: "History",
      description: "Non-Cooperation, Civil Disobedience, and Quit India",
      sortOrder: 2,
      topicId: input.historyTopicId,
    });
    const newton = await ensureBookChapter({
      bookId: physicsBook.id,
      title: "Newton's Laws of Motion",
      subject: "Physics",
      description: "Inertia, F = ma, and action–reaction",
      sortOrder: 1,
      topicId: input.mechanicsTopicId,
    });
    const energy = await ensureBookChapter({
      bookId: physicsBook.id,
      title: "Work, Energy and Power",
      subject: "Physics",
      description: "Work–energy theorem and mechanical energy",
      sortOrder: 2,
      topicId: input.mechanicsTopicId,
    });

    const demoChapters = new Map<string, { id: string }>([
      ["lax-rights", laxRights],
      ["lax-parliament", laxParliament],
      ["spectrum-1857", revolt],
      ["spectrum-gandhi", gandhi],
      ["hcv-newton", newton],
      ["hcv-energy", energy],
    ]);
    await insertFlash(demoFlash, demoChapters);
    await insertMcq(demoMcq, demoChapters);

    return {
      upscChapters: [
        { chapter: laxRights, subjectId: input.politySubjectId },
        { chapter: laxParliament, subjectId: input.politySubjectId },
        { chapter: revolt, subjectId: input.historySubjectId },
        { chapter: gandhi, subjectId: input.historySubjectId },
      ],
      pricedBookTitle: physicsBook.title,
    };
  }

  const flashBank: Array<{
    chapterId: string;
    front: string;
    back: string;
    subject: string;
    topic: string;
    difficulty: string;
  }> = [
    {
      chapterId: scienceChapter.id,
      front: "What is photosynthesis?",
      back: "The process by which green plants make glucose from carbon dioxide and water using sunlight.",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "H2O is the chemical formula for?",
      back: "Water",
      subject: "Science",
      topic: "Chemistry",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Which gas do plants absorb during photosynthesis?",
      back: "Carbon dioxide (CO₂)",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "SI unit of force?",
      back: "Newton (N)",
      subject: "Science",
      topic: "Physics",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "pH of pure water at 25°C?",
      back: "7 — it is neutral.",
      subject: "Science",
      topic: "Chemistry",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Powerhouse of the cell?",
      back: "Mitochondria — they produce ATP.",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "What does DNA stand for?",
      back: "Deoxyribonucleic acid",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Chemical formula of ozone?",
      back: "O₃",
      subject: "Science",
      topic: "Chemistry",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Newton's third law of motion?",
      back: "For every action there is an equal and opposite reaction.",
      subject: "Science",
      topic: "Physics",
      difficulty: "medium",
    },
    {
      chapterId: scienceChapter.id,
      front: "Deficiency of Vitamin C causes?",
      back: "Scurvy",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Boiling point of water at 1 atmosphere?",
      back: "100°C (373 K)",
      subject: "Science",
      topic: "Chemistry",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Which blood cells fight infection?",
      back: "White blood cells (leucocytes)",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Speed of light in vacuum (approx.)?",
      back: "3 × 10⁸ m/s",
      subject: "Science",
      topic: "Physics",
      difficulty: "medium",
    },
    {
      chapterId: scienceChapter.id,
      front: "Smallest particle of an element that retains its properties?",
      back: "Atom",
      subject: "Science",
      topic: "Chemistry",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Why does Mars look red?",
      back: "Iron oxide (rust) on its surface.",
      subject: "Science",
      topic: "Astronomy",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Can sound travel through vacuum?",
      back: "No — sound needs a material medium.",
      subject: "Science",
      topic: "Physics",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Largest planet in the solar system?",
      back: "Jupiter",
      subject: "Science",
      topic: "Astronomy",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Atomic number of oxygen?",
      back: "8",
      subject: "Science",
      topic: "Chemistry",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "Which organ purifies blood in humans?",
      back: "Kidneys",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      front: "SI unit of electric current?",
      back: "Ampere (A)",
      subject: "Science",
      topic: "Physics",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "15% of 200?",
      back: "30",
      subject: "Math",
      topic: "Percentages",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "LCM of 12 and 18?",
      back: "36",
      subject: "Math",
      topic: "Number system",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "HCF of 24 and 36?",
      back: "12",
      subject: "Math",
      topic: "Number system",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "Square of 12?",
      back: "144",
      subject: "Math",
      topic: "Arithmetic",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "Cube of 5?",
      back: "125",
      subject: "Math",
      topic: "Arithmetic",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "Average of 10, 20 and 30?",
      back: "20",
      subject: "Math",
      topic: "Averages",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "Simple interest on ₹1,000 at 10% for 2 years?",
      back: "₹200 (SI = PRT/100)",
      subject: "Math",
      topic: "Interest",
      difficulty: "medium",
    },
    {
      chapterId: mathChapter.id,
      front: "3/4 of 80?",
      back: "60",
      subject: "Math",
      topic: "Fractions",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "0.25 as a fraction in lowest terms?",
      back: "1/4",
      subject: "Math",
      topic: "Fractions",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "Perimeter of a square with side 8 cm?",
      back: "32 cm",
      subject: "Math",
      topic: "Mensuration",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "Area of a rectangle 12 cm × 5 cm?",
      back: "60 cm²",
      subject: "Math",
      topic: "Mensuration",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "Split ₹50 in the ratio 2:3.",
      back: "₹20 and ₹30",
      subject: "Math",
      topic: "Ratio",
      difficulty: "medium",
    },
    {
      chapterId: mathChapter.id,
      front: "Next term in 2, 4, 8, 16, …?",
      back: "32 (each term doubles)",
      subject: "Math",
      topic: "Series",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "√81 = ?",
      back: "9",
      subject: "Math",
      topic: "Arithmetic",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      front: "Convert 3/5 to a percentage.",
      back: "60%",
      subject: "Math",
      topic: "Percentages",
      difficulty: "easy",
    },
  ];

  const existingFlash = await prisma.flashCard.findMany({ select: { front: true } });
  const flashFronts = new Set(existingFlash.map((f) => f.front));
  const newFlash = flashBank.filter((c) => !flashFronts.has(c.front));
  if (newFlash.length) {
    await prisma.flashCard.createMany({ data: newFlash });
  }
  await prisma.flashCard.updateMany({
    where: { chapterId: null, subject: "Science" },
    data: { chapterId: scienceChapter.id },
  });
  await prisma.flashCard.updateMany({
    where: { chapterId: null, subject: "Math" },
    data: { chapterId: mathChapter.id },
  });

  const mcqBank: Array<{
    chapterId: string;
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    explanation: string;
    subject: string;
    topic: string;
    difficulty: string;
  }> = [
    {
      chapterId: scienceChapter.id,
      question: "Which planet is known as the Red Planet?",
      optionA: "Earth",
      optionB: "Mars",
      optionC: "Venus",
      optionD: "Jupiter",
      correctOption: "B",
      explanation: "Mars appears red due to iron oxide on its surface.",
      subject: "Science",
      topic: "Astronomy",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "Which gas is absorbed by plants during photosynthesis?",
      optionA: "Oxygen",
      optionB: "Nitrogen",
      optionC: "Carbon dioxide",
      optionD: "Hydrogen",
      correctOption: "C",
      explanation: "Plants take in CO₂ and release O₂ during photosynthesis.",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "The SI unit of force is the",
      optionA: "Joule",
      optionB: "Newton",
      optionC: "Watt",
      optionD: "Pascal",
      correctOption: "B",
      explanation: "1 newton is the force that accelerates 1 kg by 1 m/s².",
      subject: "Science",
      topic: "Physics",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "The pH of pure water at 25°C is",
      optionA: "0",
      optionB: "5",
      optionC: "7",
      optionD: "14",
      correctOption: "C",
      explanation: "Pure water is neutral, with pH 7.",
      subject: "Science",
      topic: "Chemistry",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "Mitochondria are known as the",
      optionA: "Kitchen of the cell",
      optionB: "Powerhouse of the cell",
      optionC: "Control centre of the cell",
      optionD: "Packaging centre of the cell",
      correctOption: "B",
      explanation: "Mitochondria generate ATP, the cell's energy currency.",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "DNA stands for",
      optionA: "Deoxyribonucleic acid",
      optionB: "Diribonucleic acid",
      optionC: "Deoxyribose nitrate acid",
      optionD: "Dual nucleic acid",
      correctOption: "A",
      explanation: "DNA is deoxyribonucleic acid, the genetic material.",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "Ozone has the chemical formula",
      optionA: "O₂",
      optionB: "O₃",
      optionC: "CO₂",
      optionD: "NO₂",
      correctOption: "B",
      explanation: "Ozone is a triatomic molecule of oxygen, O₃.",
      subject: "Science",
      topic: "Chemistry",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "Deficiency of Vitamin C causes",
      optionA: "Rickets",
      optionB: "Beriberi",
      optionC: "Scurvy",
      optionD: "Night blindness",
      correctOption: "C",
      explanation: "Scurvy is caused by lack of ascorbic acid (Vitamin C).",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "Sound cannot travel through",
      optionA: "Steel",
      optionB: "Water",
      optionC: "Air",
      optionD: "Vacuum",
      correctOption: "D",
      explanation: "Sound is a mechanical wave and needs a medium.",
      subject: "Science",
      topic: "Physics",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "The largest planet in the solar system is",
      optionA: "Saturn",
      optionB: "Jupiter",
      optionC: "Neptune",
      optionD: "Earth",
      correctOption: "B",
      explanation: "Jupiter is a gas giant, the most massive planet.",
      subject: "Science",
      topic: "Astronomy",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "Atomic number of oxygen is",
      optionA: "6",
      optionB: "7",
      optionC: "8",
      optionD: "16",
      correctOption: "C",
      explanation: "Oxygen has 8 protons, so atomic number 8.",
      subject: "Science",
      topic: "Chemistry",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "Which organ filters blood in the human body?",
      optionA: "Liver",
      optionB: "Heart",
      optionC: "Lungs",
      optionD: "Kidneys",
      correctOption: "D",
      explanation: "Kidneys remove waste as urine and regulate water balance.",
      subject: "Science",
      topic: "Biology",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "The SI unit of electric current is the",
      optionA: "Volt",
      optionB: "Ohm",
      optionC: "Ampere",
      optionD: "Coulomb",
      correctOption: "C",
      explanation: "Current is measured in amperes.",
      subject: "Science",
      topic: "Physics",
      difficulty: "easy",
    },
    {
      chapterId: scienceChapter.id,
      question: "Newton's third law states that",
      optionA: "F = ma",
      optionB: "Every action has an equal and opposite reaction",
      optionC: "An object stays at rest unless a force acts",
      optionD: "Energy can neither be created nor destroyed",
      correctOption: "B",
      explanation: "Action–reaction pairs are equal in magnitude and opposite in direction.",
      subject: "Science",
      topic: "Physics",
      difficulty: "medium",
    },
    {
      chapterId: scienceChapter.id,
      question: "Water boils at 1 atmosphere at",
      optionA: "90°C",
      optionB: "100°C",
      optionC: "120°C",
      optionD: "0°C",
      correctOption: "B",
      explanation: "At standard atmospheric pressure, water boils at 100°C.",
      subject: "Science",
      topic: "Chemistry",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "2 + 2 = ?",
      optionA: "3",
      optionB: "4",
      optionC: "5",
      optionD: "22",
      correctOption: "B",
      explanation: "Basic addition.",
      subject: "Math",
      topic: "Arithmetic",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "What is 15% of 200?",
      optionA: "15",
      optionB: "20",
      optionC: "30",
      optionD: "45",
      correctOption: "C",
      explanation: "15/100 × 200 = 30.",
      subject: "Math",
      topic: "Percentages",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "LCM of 12 and 18 is",
      optionA: "18",
      optionB: "24",
      optionC: "36",
      optionD: "54",
      correctOption: "C",
      explanation: "12 = 2²×3, 18 = 2×3², LCM = 2²×3² = 36.",
      subject: "Math",
      topic: "Number system",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "The square of 12 is",
      optionA: "124",
      optionB: "132",
      optionC: "144",
      optionD: "156",
      correctOption: "C",
      explanation: "12 × 12 = 144.",
      subject: "Math",
      topic: "Arithmetic",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "Average of 10, 20 and 30 is",
      optionA: "15",
      optionB: "20",
      optionC: "25",
      optionD: "30",
      correctOption: "B",
      explanation: "(10+20+30)/3 = 20.",
      subject: "Math",
      topic: "Averages",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "Simple interest on ₹1,000 at 10% per annum for 2 years is",
      optionA: "₹100",
      optionB: "₹150",
      optionC: "₹200",
      optionD: "₹220",
      correctOption: "C",
      explanation: "SI = PRT/100 = 1000×10×2/100 = 200.",
      subject: "Math",
      topic: "Interest",
      difficulty: "medium",
    },
    {
      chapterId: mathChapter.id,
      question: "3/4 of 80 is",
      optionA: "20",
      optionB: "40",
      optionC: "50",
      optionD: "60",
      correctOption: "D",
      explanation: "(3/4)×80 = 60.",
      subject: "Math",
      topic: "Fractions",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "Perimeter of a square of side 8 cm is",
      optionA: "16 cm",
      optionB: "24 cm",
      optionC: "32 cm",
      optionD: "64 cm",
      correctOption: "C",
      explanation: "Perimeter = 4 × side = 32 cm.",
      subject: "Math",
      topic: "Mensuration",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "Area of a 12 cm × 5 cm rectangle is",
      optionA: "17 cm²",
      optionB: "34 cm²",
      optionC: "60 cm²",
      optionD: "120 cm²",
      correctOption: "C",
      explanation: "Area = length × breadth = 60 cm².",
      subject: "Math",
      topic: "Mensuration",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "0.25 as a fraction in lowest terms is",
      optionA: "1/2",
      optionB: "1/4",
      optionC: "2/5",
      optionD: "25/10",
      correctOption: "B",
      explanation: "0.25 = 25/100 = 1/4.",
      subject: "Math",
      topic: "Fractions",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "The next number in 2, 4, 8, 16, … is",
      optionA: "18",
      optionB: "24",
      optionC: "30",
      optionD: "32",
      correctOption: "D",
      explanation: "Each term is doubled.",
      subject: "Math",
      topic: "Series",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "√81 equals",
      optionA: "8",
      optionB: "9",
      optionC: "18",
      optionD: "81",
      correctOption: "B",
      explanation: "9 × 9 = 81.",
      subject: "Math",
      topic: "Arithmetic",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "3/5 as a percentage is",
      optionA: "35%",
      optionB: "53%",
      optionC: "60%",
      optionD: "75%",
      correctOption: "C",
      explanation: "(3/5)×100 = 60%.",
      subject: "Math",
      topic: "Percentages",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "HCF of 24 and 36 is",
      optionA: "6",
      optionB: "8",
      optionC: "12",
      optionD: "18",
      correctOption: "C",
      explanation: "24 = 2³×3, 36 = 2²×3², HCF = 2²×3 = 12.",
      subject: "Math",
      topic: "Number system",
      difficulty: "easy",
    },
    {
      chapterId: mathChapter.id,
      question: "₹50 split in the ratio 2:3 is",
      optionA: "₹10 and ₹40",
      optionB: "₹20 and ₹30",
      optionC: "₹25 and ₹25",
      optionD: "₹15 and ₹35",
      correctOption: "B",
      explanation: "5 equal parts of ₹10; 2 parts = ₹20, 3 parts = ₹30.",
      subject: "Math",
      topic: "Ratio",
      difficulty: "easy",
    },
  ];

  const existingMcq = await prisma.mcq.findMany({ select: { question: true } });
  const mcqQuestions = new Set(existingMcq.map((m) => m.question));
  const newMcq = mcqBank.filter((q) => !mcqQuestions.has(q.question));
  if (newMcq.length) {
    await prisma.mcq.createMany({ data: newMcq });
  }
  await prisma.mcq.updateMany({
    where: { chapterId: null, subject: "Science" },
    data: { chapterId: scienceChapter.id },
  });
  await prisma.mcq.updateMany({
    where: { chapterId: null, subject: "Math" },
    data: { chapterId: mathChapter.id },
  });
  await prisma.mcq.updateMany({
    where: { chapterId: null },
    data: { chapterId: scienceChapter.id },
  });

  const upsc = await prisma.program.upsert({
    where: { slug: "upsc" },
    update: {
      name: "UPSC",
      examBoard: "UPSC",
      description: "Civil Services Examination — prelims syllabus snapshot",
      status: "ACTIVE",
      sortOrder: 1,
    },
    create: {
      name: "UPSC",
      slug: "upsc",
      examBoard: "UPSC",
      description: "Civil Services Examination — prelims syllabus snapshot",
      sortOrder: 1,
    },
  });

  const neet = await prisma.program.upsert({
    where: { slug: "neet" },
    update: { name: "NEET", examBoard: "NTA", status: "ACTIVE", sortOrder: 2 },
    create: {
      name: "NEET",
      slug: "neet",
      examBoard: "NTA",
      description: "National Eligibility cum Entrance Test",
      sortOrder: 2,
    },
  });

  const scienceSubject = await prisma.programSubject.upsert({
    where: { programId_name: { programId: upsc.id, name: "Science" } },
    update: { blurb: "General science for prelims", iconKey: "science", sortOrder: 1, status: "ACTIVE" },
    create: {
      programId: upsc.id,
      name: "Science",
      blurb: "General science for prelims",
      iconKey: "science",
      sortOrder: 1,
    },
  });

  const mathSubject = await prisma.programSubject.upsert({
    where: { programId_name: { programId: upsc.id, name: "Math" } },
    update: { blurb: "Quantitative aptitude", iconKey: "calculate", sortOrder: 2, status: "ACTIVE" },
    create: {
      programId: upsc.id,
      name: "Math",
      blurb: "Quantitative aptitude",
      iconKey: "calculate",
      sortOrder: 2,
    },
  });

  const scienceTopic = await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: scienceSubject.id, name: "Foundations" } },
    update: { sortOrder: 1, status: "ACTIVE" },
    create: { subjectId: scienceSubject.id, name: "Foundations", sortOrder: 1 },
  });

  const mathTopic = await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: mathSubject.id, name: "Arithmetic" } },
    update: { sortOrder: 1, status: "ACTIVE" },
    create: { subjectId: mathSubject.id, name: "Arithmetic", sortOrder: 1 },
  });

  await prisma.chapter.update({
    where: { id: scienceChapter.id },
    data: { topicId: scienceTopic.id, subject: "Science" },
  });
  await prisma.chapter.update({
    where: { id: mathChapter.id },
    data: { topicId: mathTopic.id, subject: "Math" },
  });

  async function upsertSubject(
    programId: string,
    name: string,
    blurb: string,
    iconKey: string,
    sortOrder: number,
  ) {
    return prisma.programSubject.upsert({
      where: { programId_name: { programId, name } },
      update: { blurb, iconKey, sortOrder, status: "ACTIVE" },
      create: { programId, name, blurb, iconKey, sortOrder },
    });
  }

  const politySubject = await upsertSubject(
    upsc.id,
    "Polity",
    "Constitution, rights, and Union–State machinery",
    "gavel",
    3,
  );
  const economySubject = await upsertSubject(
    upsc.id,
    "Economy",
    "National income, money, and public finance",
    "account_balance",
    4,
  );
  const environmentSubject = await upsertSubject(
    upsc.id,
    "Environment",
    "Ecology, biodiversity, and climate treaties",
    "park",
    5,
  );
  const historySubject = await upsertSubject(
    upsc.id,
    "History",
    "Modern India and the national movement",
    "history_edu",
    6,
  );

  const polityTopic = await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: politySubject.id, name: "Constitution" } },
    update: { sortOrder: 1, status: "ACTIVE" },
    create: { subjectId: politySubject.id, name: "Constitution", sortOrder: 1 },
  });
  const economyTopic = await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: economySubject.id, name: "Basics" } },
    update: { sortOrder: 1, status: "ACTIVE" },
    create: { subjectId: economySubject.id, name: "Basics", sortOrder: 1 },
  });
  const environmentTopic = await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: environmentSubject.id, name: "Ecology" } },
    update: { sortOrder: 1, status: "ACTIVE" },
    create: { subjectId: environmentSubject.id, name: "Ecology", sortOrder: 1 },
  });
  const historyTopic = await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: historySubject.id, name: "Modern" } },
    update: { sortOrder: 1, status: "ACTIVE" },
    create: { subjectId: historySubject.id, name: "Modern", sortOrder: 1 },
  });

  const everydayScienceChapter = await ensureChapter({
    title: "Everyday Science",
    subject: "Science",
    description: "Applied GS science — health, energy, and household chemistry",
    sortOrder: 2,
    topicId: scienceTopic.id,
  });
  const constitutionChapter = await ensureChapter({
    title: "Indian Constitution",
    subject: "Polity",
    description: "Adoption, federal design, amendment, and key offices",
    sortOrder: 1,
    topicId: polityTopic.id,
  });
  const rightsChapter = await ensureChapter({
    title: "Fundamental Rights",
    subject: "Polity",
    description: "Part III, writs, and reasonable restrictions",
    sortOrder: 2,
    topicId: polityTopic.id,
  });
  const economyChapter = await ensureChapter({
    title: "Indian Economy",
    subject: "Economy",
    description: "GDP, inflation targeting, GST, and fiscal rules",
    sortOrder: 1,
    topicId: economyTopic.id,
  });
  const ecologyChapter = await ensureChapter({
    title: "Ecology & Biodiversity",
    subject: "Environment",
    description: "Hotspots, wildlife law, and climate treaties",
    sortOrder: 1,
    topicId: environmentTopic.id,
  });
  const modernIndiaChapter = await ensureChapter({
    title: "Modern India",
    subject: "History",
    description: "Congress, Gandhian movements, and transfer of power",
    sortOrder: 1,
    topicId: historyTopic.id,
  });

  const neetPhysics = await upsertSubject(
    neet.id,
    "Physics",
    "Mechanics and gravitation for NEET",
    "science",
    1,
  );
  const neetChemistry = await upsertSubject(
    neet.id,
    "Chemistry",
    "Atomic structure and quantum numbers",
    "science",
    2,
  );
  const neetBiology = await upsertSubject(
    neet.id,
    "Biology",
    "Human physiology — circulation, excretion, endocrine",
    "biotech",
    3,
  );
  const mechanicsTopic = await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: neetPhysics.id, name: "Mechanics" } },
    update: { sortOrder: 1, status: "ACTIVE" },
    create: { subjectId: neetPhysics.id, name: "Mechanics", sortOrder: 1 },
  });
  const atomicTopic = await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: neetChemistry.id, name: "Physical" } },
    update: { sortOrder: 1, status: "ACTIVE" },
    create: { subjectId: neetChemistry.id, name: "Physical", sortOrder: 1 },
  });
  const physiologyTopic = await prisma.topic.upsert({
    where: { subjectId_name: { subjectId: neetBiology.id, name: "Physiology" } },
    update: { sortOrder: 1, status: "ACTIVE" },
    create: { subjectId: neetBiology.id, name: "Physiology", sortOrder: 1 },
  });
  const mechanicsChapter = await ensureChapter({
    title: "Motion & Laws",
    subject: "Physics",
    description: "Newton's laws, work-energy, and gravitation",
    sortOrder: 1,
    topicId: mechanicsTopic.id,
  });
  const atomicChapter = await ensureChapter({
    title: "Atomic Structure",
    subject: "Chemistry",
    description: "Models of the atom, quantum numbers, and configuration",
    sortOrder: 1,
    topicId: atomicTopic.id,
  });
  const physiologyChapter = await ensureChapter({
    title: "Human Physiology",
    subject: "Biology",
    description: "Heart, lungs, kidney, and hormones",
    sortOrder: 1,
    topicId: physiologyTopic.id,
  });

  const extraChapterByKey = new Map<string, { id: string }>([
    ["everyday-science", everydayScienceChapter],
    ["indian-constitution", constitutionChapter],
    ["fundamental-rights", rightsChapter],
    ["indian-economy", economyChapter],
    ["ecology-biodiversity", ecologyChapter],
    ["modern-india", modernIndiaChapter],
    ["neet-mechanics", mechanicsChapter],
    ["neet-atomic", atomicChapter],
    ["neet-physiology", physiologyChapter],
  ]);
  await insertFlash(extraFlash, extraChapterByKey);
  await insertMcq(extraMcq, extraChapterByKey);

  const upscChapters = [
    { chapter: scienceChapter, subjectId: scienceSubject.id },
    { chapter: everydayScienceChapter, subjectId: scienceSubject.id },
    { chapter: mathChapter, subjectId: mathSubject.id },
    { chapter: constitutionChapter, subjectId: politySubject.id },
    { chapter: rightsChapter, subjectId: politySubject.id },
    { chapter: economyChapter, subjectId: economySubject.id },
    { chapter: ecologyChapter, subjectId: environmentSubject.id },
    { chapter: modernIndiaChapter, subjectId: historySubject.id },
  ];

  await attachDefaultBooks();
  const namedDemo = await seedNamedDemoBooks({
    politySubjectId: politySubject.id,
    polityTopicId: polityTopic.id,
    historySubjectId: historySubject.id,
    historyTopicId: historyTopic.id,
    neetPhysicsId: neetPhysics.id,
    mechanicsTopicId: mechanicsTopic.id,
  });
  upscChapters.push(...namedDemo.upscChapters);

  const scienceMcqs = await prisma.mcq.findMany({
    where: { chapterId: { in: [scienceChapter.id, everydayScienceChapter.id] }, status: "ACTIVE" },
    select: { id: true },
  });
  const mathMcqs = await prisma.mcq.findMany({
    where: { chapterId: mathChapter.id, status: "ACTIVE" },
    select: { id: true },
  });
  const polityMcqs = await prisma.mcq.findMany({
    where: { chapterId: { in: [constitutionChapter.id, rightsChapter.id] }, status: "ACTIVE" },
    select: { id: true },
  });
  const economyMcqs = await prisma.mcq.findMany({
    where: { chapterId: economyChapter.id, status: "ACTIVE" },
    select: { id: true },
  });
  const environmentMcqs = await prisma.mcq.findMany({
    where: { chapterId: ecologyChapter.id, status: "ACTIVE" },
    select: { id: true },
  });
  const historyMcqs = await prisma.mcq.findMany({
    where: { chapterId: modernIndiaChapter.id, status: "ACTIVE" },
    select: { id: true },
  });
  const physicsMcqs = await prisma.mcq.findMany({
    where: { chapterId: mechanicsChapter.id, status: "ACTIVE" },
    select: { id: true },
  });
  const upscMcqIds = [
    ...scienceMcqs,
    ...mathMcqs,
    ...polityMcqs,
    ...economyMcqs,
    ...environmentMcqs,
    ...historyMcqs,
  ].map((m) => m.id);
  const allMcqIds = upscMcqIds;

  async function ensureTest(input: {
    title: string;
    subject: string;
    scheduledAt: Date | null;
    durationMinutes: number;
    entryFee: number;
    minAwardPool: number;
    mcqIds: string[];
    status?: "SCHEDULED" | "LIVE";
    negativeMark?: number;
  }) {
    if (input.mcqIds.length === 0) return;
    const existing = await prisma.liveTest.findFirst({ where: { title: input.title } });
    if (existing) return;
    await prisma.liveTest.create({
      data: {
        title: input.title,
        subject: input.subject,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes,
        entryFee: input.entryFee,
        minAwardPool: input.minAwardPool,
        platformFeePercent: 10,
        negativeMark: input.negativeMark ?? 0,
        status: input.status ?? (input.scheduledAt ? "SCHEDULED" : "LIVE"),
        questions: {
          create: input.mcqIds.map((mcqId, index) => ({ mcqId, sortOrder: index })),
        },
      },
    });
  }

  await ensureTest({
    title: "Daily Quiz",
    subject: "Science",
    scheduledAt: null,
    durationMinutes: 15,
    entryFee: 0,
    minAwardPool: 0,
    mcqIds: allMcqIds.slice(0, 20),
  });
  await ensureTest({
    title: "Science: Foundations Paper",
    subject: "Science",
    scheduledAt: null,
    durationMinutes: 20,
    entryFee: 0,
    minAwardPool: 0,
    mcqIds: scienceMcqs.map((m) => m.id),
  });
  await ensureTest({
    title: "Arithmetic Speed Drill",
    subject: "Math",
    scheduledAt: null,
    durationMinutes: 15,
    entryFee: 29,
    minAwardPool: 0,
    mcqIds: mathMcqs.map((m) => m.id),
  });
  await ensureTest({
    title: "Weekly Mock — GS Paper 1",
    subject: "Science",
    scheduledAt: new Date(Date.now() - 15_000),
    durationMinutes: 30,
    entryFee: 49,
    minAwardPool: 1000,
    mcqIds: allMcqIds.slice(0, 25),
    status: "LIVE",
  });
  await ensureTest({
    title: "Polity: Constitution Sprint",
    subject: "Polity",
    scheduledAt: null,
    durationMinutes: 20,
    entryFee: 0,
    minAwardPool: 0,
    mcqIds: polityMcqs.map((m) => m.id),
  });
  await ensureTest({
    title: "Economy Prelims Mix",
    subject: "Economy",
    scheduledAt: null,
    durationMinutes: 15,
    entryFee: 19,
    minAwardPool: 0,
    mcqIds: economyMcqs.map((m) => m.id),
  });
  await ensureTest({
    title: "Environment & Ecology Paper",
    subject: "Environment",
    scheduledAt: null,
    durationMinutes: 20,
    entryFee: 39,
    minAwardPool: 0,
    mcqIds: environmentMcqs.map((m) => m.id),
  });
  await ensureTest({
    title: "Modern India Rapid Fire",
    subject: "History",
    scheduledAt: null,
    durationMinutes: 15,
    entryFee: 29,
    minAwardPool: 0,
    mcqIds: historyMcqs.map((m) => m.id),
  });
  await ensureTest({
    title: "Full Prelims Mix",
    subject: "GS",
    scheduledAt: null,
    durationMinutes: 45,
    entryFee: 59,
    minAwardPool: 0,
    mcqIds: upscMcqIds.slice(0, 40),
    negativeMark: 0.33,
  });
  await ensureTest({
    title: "Saturday Night Live Contest",
    subject: "GS",
    scheduledAt: new Date(Date.now() - 8 * 60 * 1000),
    durationMinutes: 25,
    entryFee: 99,
    minAwardPool: 2500,
    mcqIds: upscMcqIds.slice(0, 20),
    status: "LIVE",
    negativeMark: 0.33,
  });
  await ensureTest({
    title: "Sunday GS Marathon",
    subject: "GS",
    scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    durationMinutes: 60,
    entryFee: 79,
    minAwardPool: 2000,
    mcqIds: upscMcqIds.slice(0, 30),
    status: "SCHEDULED",
    negativeMark: 0.33,
  });
  await ensureTest({
    title: "NEET Physics Warm-up",
    subject: "Physics",
    scheduledAt: null,
    durationMinutes: 15,
    entryFee: 0,
    minAwardPool: 0,
    mcqIds: physicsMcqs.map((m) => m.id),
  });

  const studentWallet = await prisma.wallet.findUnique({ where: { userId: student.id } });
  if (studentWallet && Number(studentWallet.depositedBalance) < 100) {
    await prisma.wallet.update({
      where: { userId: student.id },
      data: { depositedBalance: 500 },
    });
  }

  const achievementSeeds: Array<{
    name: string;
    description: string;
    iconKey: string;
    tier: "GOLD" | "SILVER" | "BRONZE";
    criterion: "STREAK_DAYS" | "FLASH_REVIEWED" | "TESTS_SUBMITTED" | "SUBJECT_MASTERY" | "NEWS_READ";
    threshold: number;
    pointsReward: number;
    subjectId?: string;
  }> = [
    {
      name: "Firebrand Scholar",
      description: "Keep a 7-day study streak.",
      iconKey: "local_fire_department",
      tier: "SILVER",
      criterion: "STREAK_DAYS",
      threshold: 7,
      pointsReward: 50,
    },
    {
      name: "Card Sharp",
      description: "Rate 50 flashcards Easy or Hard.",
      iconKey: "style",
      tier: "BRONZE",
      criterion: "FLASH_REVIEWED",
      threshold: 50,
      pointsReward: 25,
    },
    {
      name: "First Paper",
      description: "Submit your first live or practice test.",
      iconKey: "quiz",
      tier: "BRONZE",
      criterion: "TESTS_SUBMITTED",
      threshold: 1,
      pointsReward: 25,
    },
    {
      name: "Science Ace",
      description: "Reach 80% mastery in Science (min. 20 scored attempts).",
      iconKey: "emoji_events",
      tier: "GOLD",
      criterion: "SUBJECT_MASTERY",
      threshold: 80,
      pointsReward: 100,
      subjectId: scienceSubject.id,
    },
    {
      name: "Polity Ace",
      description: "Reach 80% mastery in Polity (min. 20 scored attempts).",
      iconKey: "gavel",
      tier: "GOLD",
      criterion: "SUBJECT_MASTERY",
      threshold: 80,
      pointsReward: 100,
      subjectId: politySubject.id,
    },
    {
      name: "News Hound",
      description: "Read 10 current-affairs briefs.",
      iconKey: "article",
      tier: "BRONZE",
      criterion: "NEWS_READ",
      threshold: 10,
      pointsReward: 25,
    },
  ];

  for (const a of achievementSeeds) {
    const existing = await prisma.achievement.findFirst({ where: { name: a.name } });
    if (existing) {
      await prisma.achievement.update({ where: { id: existing.id }, data: a });
    } else {
      await prisma.achievement.create({ data: a });
    }
  }

  const demoProfile = await prisma.userProfile.findUnique({ where: { userId: student.id } });
  if (!(demoProfile?.city ?? "").trim()) {
    await prisma.userProfile.update({
      where: { userId: student.id },
      data: { city: "Delhi", state: "Delhi" },
    });
  }
  if (student.pointsBalance === 0) {
    await prisma.user.update({ where: { id: student.id }, data: { pointsBalance: 240 } });
  }

  const boardPeers: Array<{
    email: string;
    firstName: string;
    lastName: string;
    city: string;
    state: string;
    points: number;
  }> = [
    { email: "board.vikram@learning.local", firstName: "Vikram", lastName: "Rao", city: "Hyderabad", state: "Telangana", points: 920 },
    { email: "board.anjali@learning.local", firstName: "Anjali", lastName: "Singh", city: "Lucknow", state: "Uttar Pradesh", points: 810 },
    { email: "board.meera@learning.local", firstName: "Meera", lastName: "Iyer", city: "Chennai", state: "Tamil Nadu", points: 740 },
    { email: "board.rahul@learning.local", firstName: "Rahul", lastName: "Verma", city: "Jaipur", state: "Rajasthan", points: 610 },
    { email: "board.priya@learning.local", firstName: "Priya", lastName: "Das", city: "Kolkata", state: "West Bengal", points: 480 },
  ];

  for (const peer of boardPeers) {
    const user = await prisma.user.upsert({
      where: { email: peer.email },
      update: {
        firstName: peer.firstName,
        lastName: peer.lastName,
        fullName: `${peer.firstName} ${peer.lastName}`,
        pointsBalance: peer.points,
        role: "STUDENT",
        status: "ACTIVE",
      },
      create: {
        email: peer.email,
        passwordHash: studentHash,
        firstName: peer.firstName,
        lastName: peer.lastName,
        fullName: `${peer.firstName} ${peer.lastName}`,
        pointsBalance: peer.points,
        role: "STUDENT",
        profile: {
          create: {
            city: peer.city,
            state: peer.state,
            classOrExam: "UPSC",
            profileComplete: true,
            curriculumComplete: true,
            consentAccepted: true,
            consentAt: new Date(),
          },
        },
        wallet: { create: {} },
      },
    });
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        city: peer.city,
        state: peer.state,
        classOrExam: "UPSC",
        profileComplete: true,
        curriculumComplete: true,
        consentAccepted: true,
        consentAt: new Date(),
      },
      update: {
        city: peer.city,
        state: peer.state,
        curriculumComplete: true,
      },
    });
    const existingCurr = await prisma.studentCurriculum.findUnique({ where: { userId: user.id } });
    if (!existingCurr) {
      const curr = await prisma.studentCurriculum.create({
        data: { userId: user.id, programId: upsc.id, targetYear: 2027 },
      });
      await prisma.curriculumModule.createMany({
        data: upscChapters.map((row, index) => ({
          curriculumId: curr.id,
          chapterId: row.chapter.id,
          subjectId: row.subjectId,
          sortOrder: index,
        })),
      });
    }
  }

  async function syncUpscCurriculum(userId: string) {
    const existing = await prisma.studentCurriculum.findUnique({
      where: { userId },
      include: { modules: { select: { chapterId: true } } },
    });
    const curriculum =
      existing ??
      (await prisma.studentCurriculum.create({
        data: { userId, programId: upsc.id, targetYear: 2027 },
      }));
    if (existing && existing.programId !== upsc.id) return;
    const have = new Set((existing?.modules ?? []).map((m) => m.chapterId));
    const maxSort = existing?.modules.length ?? 0;
    const missing = upscChapters
      .filter((row) => !have.has(row.chapter.id))
      .map((row, index) => ({
        curriculumId: curriculum.id,
        chapterId: row.chapter.id,
        subjectId: row.subjectId,
        sortOrder: maxSort + index,
      }));
    if (missing.length) await prisma.curriculumModule.createMany({ data: missing });
    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        city: "Delhi",
        state: "Delhi",
        classOrExam: "UPSC",
        profileComplete: true,
        curriculumComplete: true,
        consentAccepted: true,
        consentAt: new Date(),
      },
      update: { curriculumComplete: true, classOrExam: "UPSC" },
    });
  }

  await syncUpscCurriculum(student.id);
  const upscCurricula = await prisma.studentCurriculum.findMany({
    where: { programId: upsc.id },
    select: { userId: true },
  });
  for (const row of upscCurricula) {
    if (row.userId === student.id) continue;
    await syncUpscCurriculum(row.userId);
  }

  const now = Date.now();
  const articleSeeds: Array<{
    title: string;
    excerpt: string;
    body: string;
    tag: string;
    featured: boolean;
    imageUrl: string;
    publishedAt: Date;
  }> = [
    {
      title: "Strategic Autonomy in the Indo-Pacific: Navigating Mini-laterals",
      excerpt:
        "India's participation in Quad and I2U2 signifies a shift towards strategic pragmatism. Understanding these alliances is critical for GS Paper II.",
      body: `India's participation in Quad and I2U2 signifies a shift towards strategic pragmatism rather than rigid bloc politics.

Mini-laterals let New Delhi cooperate on maritime security, technology, and supply chains without a treaty alliance. For prelims, remember the Quad members (India, US, Japan, Australia) and I2U2 (India, Israel, UAE, US).

For mains, contrast strategic autonomy with alignment: India still buys energy from Russia, talks to China at the LAC, and joins US-led groupings when interests converge. Use this to answer GS Paper II questions on regional stability and maritime security.`,
      tag: "InternationalRelations",
      featured: false,
      imageUrl:
        "https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?auto=format&fit=crop&w=1200&q=80",
      publishedAt: new Date(now - 20 * 60 * 1000),
    },
    {
      title: "The COP28 Legacy: Analyzing the Loss and Damage Fund Framework",
      excerpt:
        "The operationalization of the fund marks a historic victory for developing nations. This snippet breaks down the funding mechanism and India's role.",
      body: `The Loss and Damage Fund was agreed at COP27 and given operational shape at COP28. It is meant to help vulnerable countries recover from climate disasters they did little to cause.

Key points for GS Paper III: who pays, who is eligible, and whether the fund sits under the UNFCCC or a World Bank-hosted arrangement. India has argued that historical emitters must lead on finance, while still expanding renewable capacity at home.

Read this as a bridge between Environment and International Relations: climate justice, CBDR-RC, and the politics of climate finance.`,
      tag: "Environment",
      featured: true,
      imageUrl:
        "https://images.unsplash.com/photo-1569163139394-de440916edc3?auto=format&fit=crop&w=1200&q=80",
      publishedAt: new Date(now - 45 * 60 * 1000),
    },
    {
      title: "The Rise of Central Bank Digital Currency (e-Rupee)",
      excerpt:
        "RBI's pilot for wholesale and retail CBDCs aims to cut the cost of physical cash. Essential for financial inclusion and monetary policy in GS Paper III.",
      body: `The e-Rupee is the Reserve Bank of India's CBDC. Wholesale pilots target interbank settlement; retail pilots test person-to-person and merchant payments.

For exams: CBDCs are a liability of the central bank, unlike UPI balances held at commercial banks. Potential gains include cheaper cash logistics and programmable payments. Risks include bank disintermediation, privacy, and cyber resilience.

Pair this with financial inclusion, the payments stack (UPI, AePS), and RBI's role as monetary authority.`,
      tag: "Economy",
      featured: false,
      imageUrl:
        "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=1200&q=80",
      publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    },
    {
      title: "Revisiting the Data Protection Act: Compliance and Privacy",
      excerpt:
        "The Digital Personal Data Protection Act, 2023 sets a new benchmark for individual rights and corporate accountability.",
      body: `The Digital Personal Data Protection Act, 2023 introduces notice-and-consent, purpose limitation, and a Data Protection Board of India.

Notice the balance: easier consent for legitimate uses versus penalties for breaches. Cross-border transfer rules and the status of government processing are frequent mains angles.

Use this for Governance, Polity (fundamental rights and privacy after Puttaswamy), and Ethics (surveillance versus public good).`,
      tag: "Governance",
      featured: false,
      imageUrl:
        "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80",
      publishedAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
    },
    {
      title: "Basic Structure Doctrine: Why It Still Frames Constitutional Debate",
      excerpt:
        "Kesavananda Bharati remains the north star for constitutional amendments. A compact archive brief for Polity revision.",
      body: `The basic structure doctrine, laid down in Kesavananda Bharati (1973), holds that Parliament may amend the Constitution but cannot destroy its essential features.

Typical features cited by later benches: supremacy of the Constitution, rule of law, separation of powers, judicial review, federalism, and secularism. It is not a closed list.

Archive this as a Polity staple: amendment procedure (Art. 368), judicial review, and the tension between parliamentary sovereignty and constitutional supremacy.`,
      tag: "Polity",
      featured: false,
      imageUrl:
        "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80",
      publishedAt: new Date(now - 12 * 24 * 60 * 60 * 1000),
    },
    ...extraArticles.map((a) => ({
      title: a.title,
      excerpt: a.excerpt,
      body: a.body,
      tag: a.tag,
      featured: a.featured,
      imageUrl: a.imageUrl,
      publishedAt: new Date(now + a.publishedOffsetMs),
    })),
  ];

  for (const a of articleSeeds) {
    const existing = await prisma.article.findFirst({ where: { title: a.title } });
    const data = {
      title: a.title,
      excerpt: a.excerpt,
      body: a.body,
      tag: a.tag,
      featured: a.featured,
      imageUrl: a.imageUrl,
      programId: upsc.id,
      status: "PUBLISHED" as const,
      publishedAt: a.publishedAt,
    };
    if (existing) {
      await prisma.article.update({ where: { id: existing.id }, data });
    } else {
      await prisma.article.create({ data });
    }
  }

  const flashTotal = await prisma.flashCard.count();
  const mcqTotal = await prisma.mcq.count();
  const testTotal = await prisma.liveTest.count();
  const articleTotal = await prisma.article.count({ where: { status: "PUBLISHED" } });
  const subjectTotal = await prisma.programSubject.count();
  const bookTotal = await prisma.book.count();
  const authorTotal = await prisma.author.count();
  const unboundChapters = await prisma.chapter.count({ where: { bookId: null } });
  console.log("Seed complete");
  console.log(`Admin:   ${adminEmail} / ${adminPassword} (id=${admin.id})`);
  console.log(`Student: ${studentEmail} / ${studentPassword} (id=${student.id})`);
  console.log(
    `UPSC chapters: ${upscChapters.map((c) => c.chapter.title).join(", ")}`,
  );
  console.log(`Programs: ${upsc.name}, ${neet.name} · subjects ${subjectTotal}`);
  console.log(`Catalog: ${authorTotal} authors, ${bookTotal} books (${unboundChapters} chapters without a book)`);
  console.log(`Demo pay-to-add: search “HC Verma” (₹49 NEET add-on for the UPSC student)`);
  console.log(`Bank: ${mcqTotal} MCQs, ${flashTotal} flashcards, ${testTotal} tests, ${articleTotal} articles`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
