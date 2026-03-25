import type { Prisma, PrismaClient } from "@prisma/client";
import { type PaginationQuery, paginationArgs, buildOrderBy } from "../utils/pagination";

const SORTABLE_FIELDS = ["type", "title", "read", "createdAt"];

export class InternalNotificationService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    clinicId?: number | null;
  }) {
    const data: Prisma.InternalNotificationCreateInput = {
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      ...(input.clinicId ? { clinic: { connect: { id: input.clinicId } } } : {}),
    };
    return this.prisma.internalNotification.create({ data });
  }

  async findAll(filters: { clinicIds?: number[]; unreadOnly?: boolean } & PaginationQuery) {
    const where: Record<string, unknown> = {};
    if (filters?.clinicIds?.length) {
      where.clinicId = { in: filters.clinicIds };
    }
    if (filters?.unreadOnly) {
      where.read = false;
    }
    const orderBy = buildOrderBy(filters, SORTABLE_FIELDS, { createdAt: "desc" });
    const [data, total] = await Promise.all([
      this.prisma.internalNotification.findMany({
        where,
        include: { clinic: true },
        orderBy,
        ...paginationArgs(filters),
      }),
      this.prisma.internalNotification.count({ where }),
    ]);
    return { data, total, page: filters.page, pageSize: filters.pageSize };
  }

  async unreadCount(clinicIds?: number[]) {
    const where: Record<string, unknown> = { read: false };
    if (clinicIds?.length) {
      where.clinicId = { in: clinicIds };
    }
    return this.prisma.internalNotification.count({ where });
  }

  async markAsRead(id: number) {
    return this.prisma.internalNotification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(clinicIds?: number[]) {
    const where: Record<string, unknown> = { read: false };
    if (clinicIds?.length) {
      where.clinicId = { in: clinicIds };
    }
    return this.prisma.internalNotification.updateMany({
      where,
      data: { read: true },
    });
  }
}
