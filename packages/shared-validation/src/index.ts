import { z } from "zod";

const authDeviceFields = {
  deviceId: z.string().min(1).max(120).optional(),
  platform: z.string().max(40).optional(),
};

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(120).optional(),
  ...authDeviceFields,
});

export const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  ...authDeviceFields,
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  mobile: z.string().min(8).max(20).optional().nullable(),
  classOrExam: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(120).optional().nullable(),
  parentGuardian: z.string().max(200).optional().nullable(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  consentAccepted: z.boolean().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });

const contentStatus = z.enum(["DRAFT", "ACTIVE", "INACTIVE"]);

export const chapterCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    subject: z.string().min(1).max(120).optional(),
    topicId: z.string().min(1).optional(),
    bookId: z.string().min(1).optional(),
    description: z.string().max(1000).optional(),
    sortOrder: z.number().int().min(0).optional(),
    status: contentStatus.optional(),
  })
  .refine((d) => Boolean(d.subject || d.topicId || d.bookId), {
    message: "subject, topicId, or bookId is required",
  });

export const chapterUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(120).optional(),
  topicId: z.string().min(1).optional().nullable(),
  bookId: z.string().min(1).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  status: contentStatus.optional(),
});

export const programCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().max(1000).optional(),
  examBoard: z.string().max(80).optional(),
  sortOrder: z.number().int().min(0).optional(),
  status: contentStatus.optional(),
});

export const programUpdateSchema = programCreateSchema.partial();

export const programSubjectCreateSchema = z.object({
  programId: z.string().min(1),
  name: z.string().min(1).max(120),
  blurb: z.string().max(400).optional(),
  iconKey: z.string().max(80).optional(),
  sortOrder: z.number().int().min(0).optional(),
  status: contentStatus.optional(),
});

export const programSubjectUpdateSchema = programSubjectCreateSchema.omit({ programId: true }).partial();

export const topicCreateSchema = z.object({
  subjectId: z.string().min(1),
  name: z.string().min(1).max(120),
  sortOrder: z.number().int().min(0).optional(),
  status: contentStatus.optional(),
});

export const topicUpdateSchema = topicCreateSchema.omit({ subjectId: true }).partial();

const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const authorCreateSchema = z.object({
  name: z.string().min(1).max(160),
  slug: slugSchema.optional(),
  bio: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  status: contentStatus.optional(),
});

export const authorUpdateSchema = authorCreateSchema.partial();

export const bookWriteSchema = z
  .object({
    authorId: z.string().min(1).optional(),
    authorName: z.string().min(1).max(160).optional(),
    title: z.string().min(1).max(200),
    slug: slugSchema.optional(),
    subtitle: z.string().max(240).optional().nullable(),
    coverUrl: z.string().max(500).optional().nullable(),
    price: z.number().min(0).max(1_000_000).optional(),
    includedInProgram: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    status: contentStatus.optional(),
  })
  .refine((d) => Boolean(d.authorId || d.authorName), {
    message: "authorId or authorName is required",
  });

export const bookCreateSchema = bookWriteSchema.and(
  z.object({ subjectId: z.string().min(1) })
);

export const bookUpdateSchema = z.object({
  authorId: z.string().min(1).optional(),
  authorName: z.string().min(1).max(160).optional(),
  title: z.string().min(1).max(200).optional(),
  slug: slugSchema.optional(),
  subtitle: z.string().max(240).optional().nullable(),
  coverUrl: z.string().max(500).optional().nullable(),
  price: z.number().min(0).max(1_000_000).optional(),
  includedInProgram: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  status: contentStatus.optional(),
});

export const categoryCreateSchema = z.object({
  chapterId: z.string().min(1),
  name: z.string().min(1).max(120),
  sortOrder: z.number().int().min(0).optional(),
  status: contentStatus.optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.omit({ chapterId: true }).partial();

export const subcategoryCreateSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(120),
  sortOrder: z.number().int().min(0).optional(),
  status: contentStatus.optional(),
});

export const subcategoryUpdateSchema = subcategoryCreateSchema.omit({ categoryId: true }).partial();

export const achievementCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  iconKey: z.string().min(1).max(80).default("emoji_events"),
  tier: z.enum(["GOLD", "SILVER", "BRONZE"]).default("BRONZE"),
  criterion: z.enum([
    "STREAK_DAYS",
    "MCQ_ANSWERED",
    "FLASH_REVIEWED",
    "TESTS_SUBMITTED",
    "SUBJECT_MASTERY",
    "MODULES_COMPLETE",
    "NEWS_READ",
    "POINTS_TOTAL",
  ]),
  threshold: z.number().int().min(1).max(1_000_000),
  pointsReward: z.number().int().min(0).max(10_000).default(25),
  programId: z.string().min(1).optional().nullable(),
  subjectId: z.string().min(1).optional().nullable(),
  status: contentStatus.optional(),
});

export const achievementUpdateSchema = achievementCreateSchema.partial();

export const articleCreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50_000),
  excerpt: z.string().max(400).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  tag: z.string().max(80).optional().nullable(),
  featured: z.boolean().optional(),
  programId: z.string().min(1).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  publishedAt: z.string().datetime().optional().nullable(),
});

export const articleUpdateSchema = articleCreateSchema.partial();

export const uploadImageSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(80).optional(),
  data: z.string().min(1),
});

export const importPathFields = z.object({
  program: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  book: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  chapter: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  subcategory: z.string().min(1).optional(),
});

export const flashCardCreateSchema = z
  .object({
    front: z.string().min(1),
    back: z.string().min(1),
    chapterId: z.string().min(1).optional(),
    subject: z.string().optional(),
    topic: z.string().optional(),
    difficulty: z.string().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
    row: z.number().int().optional(),
  })
  .merge(importPathFields);

export const flashCardBulkSchema = z.object({
  items: z.array(flashCardCreateSchema).min(1).max(500),
  defaultChapterId: z.string().min(1).optional(),
  createMissingPath: z.boolean().optional(),
});

export const mcqCreateSchema = z
  .object({
    question: z.string().min(1),
    optionA: z.string().min(1),
    optionB: z.string().min(1),
    optionC: z.string().min(1),
    optionD: z.string().min(1),
    correctOption: z.enum(["A", "B", "C", "D"]),
    chapterId: z.string().min(1).optional(),
    explanation: z.string().optional(),
    subject: z.string().optional(),
    topic: z.string().optional(),
    difficulty: z.string().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
    row: z.number().int().optional(),
  })
  .merge(importPathFields);

export const mcqBulkSchema = z.object({
  items: z.array(mcqCreateSchema).min(1).max(500),
  defaultChapterId: z.string().min(1).optional(),
  createMissingPath: z.boolean().optional(),
});

export const bookImportItemSchema = z
  .object({
    program: z.string().min(1),
    subject: z.string().min(1),
    book: z.string().min(1).max(200),
    author: z.string().min(1).max(160).optional(),
    subtitle: z.string().max(240).optional(),
    price: z.number().min(0).max(1_000_000).optional(),
    includedInProgram: z.boolean().optional(),
    chapter: z.string().min(1).max(200).optional(),
    category: z.string().min(1).max(120).optional(),
    subcategory: z.string().min(1).max(120).optional(),
    question: z.string().min(1).optional(),
    optionA: z.string().min(1).optional(),
    optionB: z.string().min(1).optional(),
    optionC: z.string().min(1).optional(),
    optionD: z.string().min(1).optional(),
    correctOption: z.enum(["A", "B", "C", "D"]).optional(),
    explanation: z.string().optional(),
    topic: z.string().optional(),
    difficulty: z.string().optional(),
    row: z.number().int().optional(),
  })
  .refine(
    (d) =>
      !d.question ||
      Boolean(d.chapter && d.optionA && d.optionB && d.optionC && d.optionD && d.correctOption),
    { message: "chapter and options A–D are required when a question is set" }
  )
  .refine((d) => !d.subcategory || Boolean(d.category), {
    message: "category is required when subcategory is set",
  })
  .refine((d) => !(d.category || d.subcategory) || Boolean(d.chapter), {
    message: "chapter is required when category or subcategory is set",
  });

export const bookBulkSchema = z.object({
  items: z.array(bookImportItemSchema).min(1).max(500),
  createMissingPath: z.boolean().optional(),
});

export const mcqAnswerSchema = z.object({
  selectedOption: z.enum(["A", "B", "C", "D"]),
});

export const flashReviewSchema = z.object({
  rating: z.enum(["EASY", "HARD"]),
});

export const adminCreditSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  bucket: z.enum(["deposited", "award", "promo"]).default("deposited"),
  note: z.string().max(240).optional(),
});

export const settingsUpdateSchema = z.object({
  flashFreePerDay: z.number().int().min(0).optional(),
  flashUnlockPrice: z.number().min(0).optional(),
  flashPaidQuota: z.number().int().min(1).optional(),
  flashUnlockHours: z.number().int().min(1).optional(),
  mcqFreePerDay: z.number().int().min(0).optional(),
  mcqUnlockPrice: z.number().min(0).optional(),
  mcqPaidQuota: z.number().int().min(1).optional(),
  mcqUnlockHours: z.number().int().min(1).optional(),
  flashDailyGoal: z.number().int().min(1).max(500).optional(),
  grievanceOfficerName: z.string().trim().max(120).optional(),
  grievanceOfficerEmail: z.string().email().optional().or(z.literal("")),
  grievanceOfficerPhone: z.string().trim().max(30).optional(),
  requireAdminMfa: z.boolean().optional(),
  geoOnLogin: z.boolean().optional(),
  parentalConsentVendor: z.enum(["none", "manual", "digilocker_planned"]).optional(),
  certInContactEmail: z.string().email().optional().or(z.literal("")),
  incidentLeadName: z.string().trim().max(120).optional(),
  userNotifyLeadName: z.string().trim().max(120).optional(),
});

export const totpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const mfaVerifySchema = z.object({
  mfaToken: z.string().min(20),
  code: z.string().regex(/^\d{6}$/),
});

export const mfaEnableSchema = z.object({
  enrollToken: z.string().min(20).optional(),
  code: z.string().regex(/^\d{6}$/),
});

export const adminBulkExportSchema = z.object({
  purpose: z.enum(["support_case", "law_enforcement", "user_request", "fraud_review"]),
  reason: z.string().trim().min(10).max(500),
  q: z.string().trim().max(160).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "BLOCKED", "WITHDRAWAL_RESTRICTED", "UNDER_REVIEW", "KYC_PENDING"]).optional(),
});

const emptyToUndef = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const optQueryString = (max: number) =>
  z.preprocess(emptyToUndef, z.string().trim().max(max).optional());
const optIsoDate = z.preprocess(emptyToUndef, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());

export const adminAuditQuerySchema = z.object({
  q: optQueryString(160),
  action: optQueryString(80),
  entityType: optQueryString(80),
  entityId: optQueryString(80),
  actorId: optQueryString(40),
  from: optIsoDate,
  to: optIsoDate,
  cursor: optQueryString(200),
  take: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(100).optional()),
});

export const adminAuditExportSchema = adminAuditQuerySchema
  .omit({ cursor: true, take: true })
  .extend({
    purpose: z.enum(["support_case", "law_enforcement", "user_request", "fraud_review"]),
    reason: z.string().trim().min(10).max(500),
    format: z.enum(["csv", "json"]).default("csv"),
  });

export const adminIncidentSchema = z.object({
  kind: z.enum(["data_breach", "account_compromise", "availability", "malware", "other"]),
  notes: z.string().trim().min(10).max(2000),
  certInWithin6h: z.boolean(),
  usersWithin72h: z.boolean(),
});

export const adminParentalConsentSchema = z.object({
  method: z.enum(["MANUAL", "VENDOR_PENDING"]),
  reference: z.string().trim().min(4).max(120),
  note: z.string().trim().min(10).max(500),
});

export const adminStaffCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(1).max(120),
  role: z.enum(["SUPER_ADMIN", "CONTENT_ADMIN", "TEST_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "READ_ONLY"]),
});

export const adminStaffUpdateSchema = z.object({
  role: z
    .enum(["SUPER_ADMIN", "CONTENT_ADMIN", "TEST_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "READ_ONLY"])
    .optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  reason: z.string().trim().min(10).max(500),
});

export const depositSchema = z.object({
  amount: z.number().positive().max(100000),
});

export const sandboxConfirmSchema = z.object({
  paymentId: z.string().min(1),
  status: z.enum(["SUCCESSFUL", "FAILED"]).default("SUCCESSFUL"),
});

export const paymentWebhookSchema = z.object({
  providerRef: z.string().min(1),
  status: z.enum(["SUCCESSFUL", "FAILED"]),
  signature: z.string().optional(),
});

export const awardPrizeSchema = z.object({
  rank: z.number().int().min(1).max(100),
  amount: z.number().min(0).max(1_000_000),
});

export const awardRulesSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({
    mode: z.literal("fixed"),
    prizes: z.array(awardPrizeSchema).min(1).max(50),
  }),
  z.object({
    mode: z.literal("pool"),
    minAwardPool: z.number().min(1).max(10_000_000),
    winnerPercent: z.number().min(1).max(100).default(30),
    topBandCount: z.number().int().min(1).max(100).default(10),
    topSharePercent: z.number().min(0).max(100).default(25),
  }),
]);

export const createLiveTestSchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  durationMinutes: z.number().int().min(1).max(300).default(30),
  entryFee: z.number().min(0),
  minAwardPool: z.number().min(0).default(0),
  awardRules: awardRulesSchema.optional(),
  platformFeePercent: z.number().min(0).max(100).default(10),
  negativeMark: z.number().min(0).default(0),
  marksPerCorrect: z.number().positive().default(1),
  mcqIds: z.array(z.string().min(1)).min(1).max(200),
});

export const submitTestSchema = z.object({
  answers: z
    .array(
      z.object({
        mcqId: z.string().min(1),
        selectedOption: z.union([z.enum(["A", "B", "C", "D"]), z.null()]).optional(),
      })
    )
    .default([]),
  autoSubmit: z.boolean().optional(),
  deviceId: z.string().min(1).max(120).optional(),
  appSwitchCount: z.number().int().min(0).max(100).optional(),
});

export const saveTestAnswerSchema = z.object({
  mcqId: z.string().min(1),
  selectedOption: z.union([z.enum(["A", "B", "C", "D"]), z.null()]),
  deviceId: z.string().min(1).max(120).optional(),
});

export const deviceRegisterSchema = z.object({
  deviceId: z.string().min(1).max(120),
  platform: z.string().max(40).optional(),
});

export const appSwitchSchema = z.object({
  testId: z.string().min(1),
  deviceId: z.string().min(1).max(120).optional(),
});

export const withdrawalSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["UPI", "BANK"]).default("UPI"),
  destination: z.string().min(3).max(200),
});

export const withdrawalReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  rejectReason: z.string().max(240).optional(),
});

export const supportTicketSchema = z.object({
  category: z.enum([
    "Payment",
    "Wallet",
    "Withdrawal",
    "Question error",
    "Test issue",
    "Account",
    "Privacy",
    "Other",
  ]),
  subject: z.string().min(1).max(160),
  message: z.string().min(1).max(2000),
});

export const supportTicketStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});

export const adminUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "BLOCKED", "WITHDRAWAL_RESTRICTED"]),
  reason: z.string().trim().min(10).max(500),
  notify: z.boolean().optional(),
});

export const adminRevokeSessionsSchema = z.object({
  deviceId: z.string().min(1).max(120).optional(),
  reason: z.string().trim().min(10).max(500),
});

export const adminUserTicketSchema = supportTicketSchema.extend({
  visibility: z.enum(["INTERNAL", "STUDENT"]).default("INTERNAL"),
});

export const adminTicketNoteSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  visibility: z.enum(["INTERNAL", "STUDENT"]).default("INTERNAL"),
});

export const adminPasswordResetSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

export const passwordResetConsumeSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(8).max(128),
});

export const adminUserCorrectSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    fullName: z.string().trim().min(1).max(120).optional(),
    mobile: z.string().trim().min(8).max(20).optional().nullable(),
    city: z.string().trim().max(120).optional().nullable(),
    state: z.string().trim().max(120).optional().nullable(),
    classOrExam: z.string().trim().max(120).optional().nullable(),
    parentGuardian: z.string().trim().max(200).optional().nullable(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    reason: z.string().trim().min(10).max(500),
  })
  .refine(
    (d) =>
      d.firstName !== undefined ||
      d.lastName !== undefined ||
      d.fullName !== undefined ||
      d.mobile !== undefined ||
      d.city !== undefined ||
      d.state !== undefined ||
      d.classOrExam !== undefined ||
      d.parentGuardian !== undefined ||
      d.dateOfBirth !== undefined,
    { message: "Change at least one profile field" }
  );

export const adminRightsCreateSchema = z.object({
  type: z.enum(["ACCESS", "ERASE", "CONSENT_WITHDRAW", "NOMINATE", "GRIEVANCE"]),
  reason: z.string().trim().min(10).max(500),
  purpose: z.enum(["support_case", "law_enforcement", "user_request", "fraud_review"]).optional(),
  notify: z.boolean().optional(),
  parentNote: z.string().trim().min(10).max(500).optional(),
  nominee: z
    .object({
      name: z.string().trim().min(1).max(120),
      email: z.string().email().optional().or(z.literal("")),
      mobile: z.string().trim().max(20).optional(),
      relation: z.string().trim().max(80).optional(),
    })
    .optional(),
});

export const adminRightsExportSchema = z.object({
  purpose: z.enum(["support_case", "law_enforcement", "user_request", "fraud_review"]),
});

export const adminRightsEraseSchema = z.object({
  reason: z.string().trim().min(10).max(500),
  parentNote: z.string().trim().min(10).max(500).optional(),
});

export const curriculumSetupSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  programId: z.string().min(1),
  targetYear: z.number().int().min(2000).max(2100).nullable(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SupportTicketInput = z.infer<typeof supportTicketSchema>;
export type SupportTicketStatusInput = z.infer<typeof supportTicketStatusSchema>;
export type CurriculumSetupInput = z.infer<typeof curriculumSetupSchema>;
export type AdminUserStatusInput = z.infer<typeof adminUserStatusSchema>;
export type AdminRevokeSessionsInput = z.infer<typeof adminRevokeSessionsSchema>;
export type AdminUserTicketInput = z.infer<typeof adminUserTicketSchema>;
export type AdminTicketNoteInput = z.infer<typeof adminTicketNoteSchema>;
export type AdminPasswordResetInput = z.infer<typeof adminPasswordResetSchema>;
export type PasswordResetConsumeInput = z.infer<typeof passwordResetConsumeSchema>;
export type AdminUserCorrectInput = z.infer<typeof adminUserCorrectSchema>;
export type AdminRightsCreateInput = z.infer<typeof adminRightsCreateSchema>;
export type AdminRightsExportInput = z.infer<typeof adminRightsExportSchema>;
export type AdminRightsEraseInput = z.infer<typeof adminRightsEraseSchema>;
export type TotpCodeInput = z.infer<typeof totpCodeSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type MfaEnableInput = z.infer<typeof mfaEnableSchema>;
export type BookBulkInput = z.infer<typeof bookBulkSchema>;
export type AdminBulkExportInput = z.infer<typeof adminBulkExportSchema>;
export type AdminAuditQueryInput = z.infer<typeof adminAuditQuerySchema>;
export type AdminAuditExportInput = z.infer<typeof adminAuditExportSchema>;
export type AdminIncidentInput = z.infer<typeof adminIncidentSchema>;
export type AdminParentalConsentInput = z.infer<typeof adminParentalConsentSchema>;
export type AdminStaffCreateInput = z.infer<typeof adminStaffCreateSchema>;
export type AdminStaffUpdateInput = z.infer<typeof adminStaffUpdateSchema>;
