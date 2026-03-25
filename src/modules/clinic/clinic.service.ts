import type { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../../utils/errors";
import { type PaginationQuery, paginationArgs, buildOrderBy } from "../../utils/pagination";
import type { CreateClinicInput, UpdateClinicInput } from "./clinic.schema";

const SORTABLE_FIELDS = ["name", "address", "phone"];

export class ClinicService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateClinicInput) {
    return this.prisma.clinic.create({ data });
  }

  async findAll(query: PaginationQuery) {
    const orderBy = buildOrderBy(query, SORTABLE_FIELDS, { name: "asc" });
    const [data, total] = await Promise.all([
      this.prisma.clinic.findMany({
        orderBy,
        ...paginationArgs(query),
      }),
      this.prisma.clinic.count(),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: number) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id },
      include: { _count: { select: { doctors: true, appointments: true } } },
    });
    if (!clinic) throw new NotFoundError("Clinic", id);
    return clinic;
  }

  async update(id: number, data: UpdateClinicInput) {
    await this.findById(id);
    return this.prisma.clinic.update({ where: { id }, data });
  }

  async delete(id: number) {
    await this.findById(id);
    return this.prisma.clinic.delete({ where: { id } });
  }
}
