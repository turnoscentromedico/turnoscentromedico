import type { PrismaClient, Prisma } from "@prisma/client";

export class UserPreferenceService {
  constructor(private readonly prisma: PrismaClient) {}

  async get(userId: number): Promise<Record<string, unknown>> {
    const row = await this.prisma.userPreference.findUnique({
      where: { userId },
    });
    return (row?.data as Record<string, unknown>) ?? {};
  }

  async set(
    userId: number,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const existing = await this.get(userId);
    const merged = { ...existing, ...data };
    const json = merged as unknown as Prisma.InputJsonValue;

    await this.prisma.userPreference.upsert({
      where: { userId },
      update: { data: json },
      create: { userId, data: json },
    });

    return merged;
  }
}
