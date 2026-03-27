import { Prisma, type PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../utils/errors";
import { type PaginationQuery, paginationArgs, buildOrderBy } from "../../utils/pagination";

const SORTABLE_FIELDS = [
  "firstName", "lastName", "dni", "email", "phone", "dateOfBirth", "createdAt",
];
import type {
  CreatePatientInput,
  UpdatePatientInput,
} from "./patient.schema";

export class PatientService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreatePatientInput) {
    try {
      return await this.prisma.patient.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.includes("dni")) {
          throw new ConflictError(`Ya existe un paciente con DNI '${data.dni}'`);
        }
        throw new ConflictError("El paciente ya existe");
      }
      throw error;
    }
  }

  async findAll(query: PaginationQuery) {
    const orderBy = buildOrderBy(query, SORTABLE_FIELDS, { lastName: "asc" });
    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        orderBy,
        ...paginationArgs(query),
      }),
      this.prisma.patient.count(),
    ]);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        _count: { select: { appointments: true, medicalRecords: true } },
        appointments: {
          orderBy: { date: "desc" },
          take: 5,
          include: {
            doctor: { select: { id: true, firstName: true, lastName: true } },
            clinic: { select: { id: true, name: true } },
            specialty: { select: { id: true, name: true } },
          },
        },
        medicalRecords: {
          orderBy: { date: "desc" },
          take: 5,
          include: {
            appointment: {
              select: {
                id: true,
                date: true,
                startTime: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!patient) throw new NotFoundError("Patient", id);
    return patient;
  }

  async update(id: number, data: UpdatePatientInput) {
    await this.findById(id);

    try {
      return await this.prisma.patient.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.includes("dni")) {
          throw new ConflictError(`Ya existe un paciente con DNI '${data.dni}'`);
        }
        throw new ConflictError("Conflicto al actualizar paciente");
      }
      throw error;
    }
  }

  async delete(id: number) {
    await this.findById(id);
    return this.prisma.patient.delete({ where: { id } });
  }
}
