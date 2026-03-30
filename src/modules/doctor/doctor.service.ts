import { type PrismaClient, Prisma, AppointmentStatus } from "@prisma/client";
import { format } from "date-fns";
import { ConflictError, NotFoundError } from "../../utils/errors";
import { type PaginationQuery, paginationArgs, buildOrderBy } from "../../utils/pagination";
import { logger } from "../../utils/logger";
import {
  enqueueCancelledNotification,
  removeAppointmentJobs,
} from "../../queue/appointment.queue";
import { MedicalRecordService } from "../medical-record/medical-record.service";

const SORTABLE_FIELDS = [
  "firstName", "lastName", "dni", "licenseNumber",
  "clinic.name", "createdAt",
];
import type {
  CreateDoctorInput,
  UpdateDoctorInput,
  DoctorQuery,
} from "./doctor.schema";

const DOCTOR_INCLUDE = { specialties: true, clinic: true } as const;

export class DoctorService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateDoctorInput) {
    const { specialtyIds, ...rest } = data;
    await this.validateRelations(specialtyIds, rest.clinicId);
    try {
      return await this.prisma.doctor.create({
        data: {
          ...rest,
          specialties: { connect: specialtyIds.map((id) => ({ id })) },
        },
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
    if (query.specialtyId) where.specialties = { some: { id: query.specialtyId } };
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
    const { specialtyIds, ...rest } = data;
    if (specialtyIds || rest.clinicId) {
      await this.validateRelations(specialtyIds, rest.clinicId);
    }
    try {
      return await this.prisma.doctor.update({
        where: { id },
        data: {
          ...rest,
          ...(specialtyIds && {
            specialties: { set: specialtyIds.map((sid) => ({ id: sid })) },
          }),
        },
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
    const doctor = await this.findById(id);

    const activeAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId: id,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        specialty: { select: { name: true } },
        clinic: { select: { name: true } },
      },
    });

    const mrService = new MedicalRecordService(this.prisma);
    const doctorName = `${doctor.firstName} ${doctor.lastName}`;

    for (const appt of activeAppointments) {
      await this.prisma.appointment.update({
        where: { id: appt.id },
        data: { status: AppointmentStatus.CANCELLED },
      });

      try {
        await removeAppointmentJobs(appt.id);
      } catch (err) {
        logger.error({ err, appointmentId: appt.id }, "Failed to remove reminder jobs on doctor delete");
      }

      try {
        await enqueueCancelledNotification({
          appointmentId: appt.id,
          patientName: `${appt.patient.firstName} ${appt.patient.lastName}`,
          patientEmail: appt.patient.email ?? undefined,
          patientPhone: appt.patient.phone,
          doctorName,
          specialtyName: appt.specialty.name,
          clinicName: appt.clinic.name,
          date: format(appt.date, "yyyy-MM-dd"),
          startTime: appt.startTime ?? format(appt.date, "HH:mm"),
        });
      } catch (err) {
        logger.error({ err, appointmentId: appt.id }, "Failed to enqueue cancelled notification on doctor delete");
      }

      try {
        await mrService.createAutoEntry(
          appt.patient.id,
          appt.id,
          "auto_cancelled",
          `Turno cancelado — Doctor ${doctorName} eliminado del sistema`,
          appt.date,
        );
      } catch (err) {
        logger.error({ err, appointmentId: appt.id }, "Failed to create auto medical record on doctor delete");
      }
    }

    return this.prisma.doctor.delete({ where: { id } });
  }

  private async validateRelations(specialtyIds?: number[], clinicId?: number) {
    if (specialtyIds?.length) {
      const count = await this.prisma.specialty.count({
        where: { id: { in: specialtyIds } },
      });
      if (count !== specialtyIds.length) {
        throw new NotFoundError("Specialty", specialtyIds.join(", "));
      }
    }
    if (clinicId) {
      const clinic = await this.prisma.clinic.findUnique({
        where: { id: clinicId },
      });
      if (!clinic) throw new NotFoundError("Clinic", clinicId);
    }
  }
}
