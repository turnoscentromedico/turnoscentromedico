import type { PrismaClient } from "@prisma/client";

const DEFAULTS: Record<string, string> = {
  "calendar.slotMinTime": "06:00",
  "calendar.slotMaxTime": "21:00",
  "calendar.show24h": "false",
  "notifications.emailEnabled": "true",
  "notifications.whatsappEnabled": "true",
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
