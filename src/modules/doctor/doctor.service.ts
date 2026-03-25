import { type PrismaClient, Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../utils/errors";
import { type PaginationQuery, paginationArgs, buildOrderBy } from "../../utils/pagination";

const SORTABLE_FIELDS = [
  "firstName", "lastName", "dni", "licenseNumber",
  "specialty.name", "clinic.name", "createdAt",
];
import type {
  CreateDoctorInput,
  UpdateDoctorInput,
  DoctorQuery,
} from "./doctor.schema";

const DOCTOR_INCLUDE = { specialty: true, clinic: true } as const;

export class DoctorService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateDoctorInput) {
    await this.validateRelations(data.specialtyId, data.clinicId);
    try {
      return await this.prisma.doctor.create({
        data,
        include: DOCTOR_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const field = (error.meta?.target as string[])?.join(", ") ?? "field";
        throw new ConflictError(`Doctor with this ${field} already exists`);
      }
      throw error;
    }
  }

  async findAll(query: DoctorQuery & PaginationQuery) {
    const where: Record<string, unknown> = {};
    if (query.specialtyId) where.specialtyId = query.specialtyId;
    if (query.clinicId) where.clinicId = query.clinicId;

    const orderBy = buildOrderBy(query, SORTABLE_FIELDS, { lastName: "asc" });
    const [data, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        include: DOCTOR_INCLUDE,
        orderBy,
        ...paginationArgs(query),
      }),
      this.prisma.doctor.count({ where }),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: number) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: {
        ...DOCTOR_INCLUDE,
        schedule: { orderBy: { dayOfWeek: "asc" } },
        _count: { select: { appointments: true, schedule: true } },
      },
    });
    if (!doctor) throw new NotFoundError("Doctor", id);
    return doctor;
  }

  async update(id: number, data: UpdateDoctorInput) {
    await this.findById(id);
    if (data.specialtyId || data.clinicId) {
      await this.validateRelations(data.specialtyId, data.clinicId);
    }
    try {
      return await this.prisma.doctor.update({
        where: { id },
        data,
        include: DOCTOR_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const field = (error.meta?.target as string[])?.join(", ") ?? "field";
        throw new ConflictError(`Doctor with this ${field} already exists`);
      }
      throw error;
    }
  }

  async delete(id: number) {
    await this.findById(id);
    return this.prisma.doctor.delete({ where: { id } });
  }

  private async validateRelations(specialtyId?: number, clinicId?: number) {
    if (specialtyId) {
      const specialty = await this.prisma.specialty.findUnique({
        where: { id: specialtyId },
      });
      if (!specialty) throw new NotFoundError("Specialty", specialtyId);
    }
    if (clinicId) {
      const clinic = await this.prisma.clinic.findUnique({
        where: { id: clinicId },
      });
      if (!clinic) throw new NotFoundError("Clinic", clinicId);
    }
  }
}
