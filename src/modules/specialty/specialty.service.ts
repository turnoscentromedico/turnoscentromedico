import type { PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../utils/errors";
import { type PaginationQuery, paginationArgs, buildOrderBy } from "../../utils/pagination";

const SORTABLE_FIELDS = ["name", "createdAt"];
import type {
  CreateSpecialtyInput,
  UpdateSpecialtyInput,
} from "./specialty.schema";

export class SpecialtyService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateSpecialtyInput) {
    const exists = await this.prisma.specialty.findUnique({
      where: { name: data.name },
    });
    if (exists) throw new ConflictError(`Specialty '${data.name}' already exists`);

    return this.prisma.specialty.create({ data });
  }

  async findAll(query: PaginationQuery) {
    const orderBy = buildOrderBy(query, SORTABLE_FIELDS, { name: "asc" });
    const [data, total] = await Promise.all([
      this.prisma.specialty.findMany({
        include: { _count: { select: { doctors: true } } },
        orderBy,
        ...paginationArgs(query),
      }),
      this.prisma.specialty.count(),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: number) {
    const specialty = await this.prisma.specialty.findUnique({
      where: { id },
      include: { _count: { select: { doctors: true } } },
    });
    if (!specialty) throw new NotFoundError("Specialty", id);
    return specialty;
  }

  async update(id: number, data: UpdateSpecialtyInput) {
    await this.findById(id);

    if (data.name) {
      const duplicate = await this.prisma.specialty.findFirst({
        where: { name: data.name, NOT: { id } },
      });
      if (duplicate) throw new ConflictError(`Specialty '${data.name}' already exists`);
    }

    return this.prisma.specialty.update({ where: { id }, data });
  }

  async delete(id: number) {
    await this.findById(id);
    return this.prisma.specialty.delete({ where: { id } });
  }
}
