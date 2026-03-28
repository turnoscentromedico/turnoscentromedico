import type { PrismaClient } from "@prisma/client";

const VIEW_DEFAULTS: Record<string, Record<string, boolean>> = {
  OPERATOR: {
    dashboard: true,
    appointments: true,
    "appointments.new": true,
    notifications: true,
    "medical-records": false,
    clinics: false,
    specialties: true,
    doctors: true,
    patients: true,
    users: false,
    settings: false,
  },
  DOCTOR: {
    dashboard: true,
    appointments: true,
    "appointments.new": false,
    notifications: false,
    "medical-records": true,
    clinics: false,
    specialties: false,
    doctors: false,
    patients: false,
    users: false,
    settings: false,
  },
};

const DEFAULTS: Record<string, string> = {
  "calendar.slotMinTime": "06:00",
  "calendar.slotMaxTime": "21:00",
  "calendar.show24h": "false",
  "notifications.emailEnabled": "true",
  "notifications.whatsappEnabled": "true",
  "views.OPERATOR": JSON.stringify(VIEW_DEFAULTS.OPERATOR),
  "views.DOCTOR": JSON.stringify(VIEW_DEFAULTS.DOCTOR),
};

export class SettingsService {
  constructor(private readonly prisma: PrismaClient) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    const map: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  }

  async get(key: string): Promise<string> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? DEFAULTS[key] ?? "";
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async bulkSet(entries: Record<string, string>): Promise<void> {
    const ops = Object.entries(entries).map(([key, value]) =>
      this.prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    );
    await this.prisma.$transaction(ops);
  }
}
