import { prisma } from "../../infrastructure/database/prisma";

export const DEFAULT_SETTINGS = {
  flashFreePerDay: 25,
  flashUnlockPrice: 10,
  flashPaidQuota: 500,
  flashUnlockHours: 24,
  flashDailyGoal: 50,
  mcqFreePerDay: 25,
  mcqUnlockPrice: 10,
  mcqPaidQuota: 500,
  mcqUnlockHours: 24,
  grievanceOfficerName: "",
  grievanceOfficerEmail: "",
  grievanceOfficerPhone: "",
  requireAdminMfa: false,
  geoOnLogin: false,
  parentalConsentVendor: "manual",
  certInContactEmail: "",
  incidentLeadName: "",
  userNotifyLeadName: "",
};

export type AppSettings = typeof DEFAULT_SETTINGS;

export class SettingsService {
  async get(): Promise<AppSettings> {
    const row = await prisma.appSetting.findUnique({ where: { key: "freemium" } });
    if (!row) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(row.value as Partial<AppSettings>) };
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get();
    const next = { ...current, ...patch };
    await prisma.appSetting.upsert({
      where: { key: "freemium" },
      create: { key: "freemium", value: next },
      update: { value: next },
    });
    return next;
  }
}

export const settingsService = new SettingsService();
