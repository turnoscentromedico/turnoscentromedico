import type { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../../utils/errors";
import {
  type PaginationQuery,
  paginationArgs,
  buildOrderBy,
} from "../../utils/pagination";
import type {
  CreateMedicalRecordInput,
  UpdateMedicalRecordInput,
  MedicalRecordQuery,
} from "./medical-record.schema";

const SORTABLE_FIELDS = ["date", "entryType", "createdAt"];

const INCLUDE = {
  appointment: {
    select: {
      id: true,
      date: true,
      startTime: true,
      status: true,
      doctor: { select: { id: true, firstName: true, lastName: true } },
      clinic: { select: { id: true, name: true } },
      specialty: { select: { id: true, name: true } },
    },
  },
};

export class MedicalRecordService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    patientId: number,
    data: CreateMedicalRecordInput,
    createdBy?: number,
  ) {
    await this.ensurePatientExists(patientId);
    return this.prisma.medicalRecord.create({
      data: {
        ...data,
        patientId,
        entryType: "manual",
        createdBy: createdBy ?? null,
      },
      include: INCLUDE,
    });
  }

  async createAutoEntry(
    patientId: number,
    appointmentId: number,
    entryType: string,
    observations: string,
    date: Date,
  ) {
    return this.prisma.medicalRecord.create({
      data: {
        patientId,
        appointmentId,
        entryType,
        date,
        observations,
      },
    });
  }

  async findAllByPatient(patientId: number, query: MedicalRecordQuery) {
    const where: Record<string, unknown> = { patientId };
    if (query.entryType) {
      where.entryType = query.entryType;
    }

    const orderBy = buildOrderBy(query, SORTABLE_FIELDS, {
      date: "desc",
    });

    const [data, total] = await Promise.all([
      this.prisma.medicalRecord.findMany({
        where,
        include: INCLUDE,
        orderBy,
        ...paginationArgs(query),
      }),
      this.prisma.medicalRecord.count({ where }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: number) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        ...INCLUDE,
        patient: {
          select: { id: true, firstName: true, lastName: true, dni: true },
        },
      },
    });
    if (!record) throw new NotFoundError("MedicalRecord", id);
    return record;
  }

  async update(id: number, data: UpdateMedicalRecordInput) {
    const existing = await this.findById(id);
    if (existing.entryType !== "manual") {
      throw new Error("Solo se pueden editar entradas manuales");
    }
    return this.prisma.medicalRecord.update({
      where: { id },
      data,
      include: INCLUDE,
    });
  }

  async delete(id: number) {
    const existing = await this.findById(id);
    if (existing.entryType !== "manual") {
      throw new Error("Solo se pueden eliminar entradas manuales");
    }
    return this.prisma.medicalRecord.delete({ where: { id } });
  }

  private async ensurePatientExists(patientId: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) throw new NotFoundError("Patient", patientId);
  }
}
