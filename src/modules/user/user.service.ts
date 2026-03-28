import { type PrismaClient, Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../utils/errors";
import { type PaginationQuery, paginationArgs, buildOrderBy } from "../../utils/pagination";

const SORTABLE_FIELDS = ["name", "email", "role", "active", "createdAt"];
import type { CreateUserInput, UpdateUserInput } from "./user.schema";

const USER_INCLUDE = { clinics: true, doctor: { select: { id: true, firstName: true, lastName: true } } } as const;

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateUserInput) {
    const { clinicIds, doctorId, ...rest } = data;
    try {
      return await this.prisma.user.create({
        data: {
          ...rest,
          clinics: clinicIds?.length
            ? { connect: clinicIds.map((id) => ({ id })) }
            : undefined,
          doctorId: doctorId ?? null,
        },
        include: USER_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const field = (error.meta?.target as string[])?.join(", ") ?? "field";
        throw new ConflictError(`User with this ${field} already exists`);
      }
      throw error;
    }
  }

  async findAll(query: PaginationQuery) {
    const orderBy = buildOrderBy(query, SORTABLE_FIELDS, { createdAt: "desc" });
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        include: USER_INCLUDE,
        orderBy,
        ...paginationArgs(query),
      }),
      this.prisma.user.count(),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: USER_INCLUDE,
    });
    if (!user) throw new NotFoundError("User", id);
    return user;
  }

  async update(id: number, data: UpdateUserInput) {
    await this.findById(id);
    const { clinicIds, doctorId, ...rest } = data;
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...rest,
          ...(clinicIds !== undefined && {
            clinics: { set: clinicIds.map((id) => ({ id })) },
          }),
          ...(doctorId !== undefined && { doctorId }),
        },
        include: USER_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const field = (error.meta?.target as string[])?.join(", ") ?? "field";
        throw new ConflictError(`User with this ${field} already exists`);
      }
      throw error;
    }
  }

  async delete(id: number) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
    });
  }
}
