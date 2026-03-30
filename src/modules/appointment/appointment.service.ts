import {
  type PrismaClient,
  Prisma,
  AppointmentStatus,
} from "@prisma/client";
import {
  parseISO,
  getDay,
  addMinutes,
  format,
  set,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
} from "date-fns";
import { AppError, ConflictError, NotFoundError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import {
  enqueueAppointmentJobs,
  enqueueConfirmedNotification,
  enqueueCancelledNotification,
  enqueueResendConfirmation,
  removeAppointmentJobs,
} from "../../queue/appointment.queue";
import { type PaginationQuery, paginationArgs, buildOrderBy } from "../../utils/pagination";

const SORTABLE_FIELDS = [
  "date", "startTime", "status", "createdAt",
  "patient.lastName", "doctor.lastName", "clinic.name", "specialty.name",
];
import { ActionTokenService } from "../../services/action-token.service";
import { MedicalRecordService } from "../medical-record/medical-record.service";
import type {
  AvailableSlotsQuery,
  AvailableBySpecialtyQuery,
  AvailableRangeQuery,
  BookAppointmentInput,
  ListAppointmentsQuery,
} from "./appointment.schema";

interface AvailableSlot {
  doctorId: number;
  doctorName: string;
  specialtyId: number;
  specialtyName: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface GetSlotsParams {
  clinicId: number;
  doctorId?: number;
  specialtyId?: number;
  date: string;
}

function generateTimeSlots(
  scheduleStart: string,
  scheduleEnd: string,
  durationMinutes: number,
  lunchStart?: string | null,
  lunchEnd?: string | null,
): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  const [startH, startM] = scheduleStart.split(":").map(Number);
  const [endH, endM] = scheduleEnd.split(":").map(Number);

  const ref = new Date(2000, 0, 1);
  let cursor = set(ref, { hours: startH, minutes: startM, seconds: 0, milliseconds: 0 });
  const limit = set(ref, { hours: endH, minutes: endM, seconds: 0, milliseconds: 0 });

  const hasLunch = lunchStart && lunchEnd;
  const lunchStartMin = hasLunch ? toMinutes(lunchStart) : -1;
  const lunchEndMin = hasLunch ? toMinutes(lunchEnd) : -1;

  while (cursor < limit) {
    const slotEnd = addMinutes(cursor, durationMinutes);
    if (slotEnd > limit) break;

    const slotStartStr = format(cursor, "HH:mm");
    const slotStartMin = toMinutes(slotStartStr);

    if (hasLunch && slotStartMin >= lunchStartMin && slotStartMin < lunchEndMin) {
      cursor = slotEnd;
      continue;
    }

    slots.push({ start: slotStartStr, end: format(slotEnd, "HH:mm") });
    cursor = slotEnd;
  }

  return slots;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isValidSlotTime(
  time: string,
  scheduleStart: string,
  slotDuration: number,
): boolean {
  const [tH, tM] = time.split(":").map(Number);
  const [sH, sM] = scheduleStart.split(":").map(Number);
  return ((tH * 60 + tM) - (sH * 60 + sM)) % slotDuration === 0;
}

const APPOINTMENT_INCLUDE = {
  doctor: { include: { specialties: true } },
  patient: true,
  clinic: true,
  specialty: true,
} as const;

export class AppointmentService {
  constructor(private readonly prisma: PrismaClient) {}

  async getAvailableSlots(
    params: AvailableSlotsQuery | AvailableBySpecialtyQuery,
  ): Promise<AvailableSlot[]> {
    const p: GetSlotsParams = {
      clinicId: params.clinicId,
      date: params.date,
      doctorId: "doctorId" in params ? params.doctorId : undefined,
      specialtyId: "specialtyId" in params ? params.specialtyId : undefined,
    };
    return this.computeAvailableSlots(p);
  }

  async getAvailableSlotsRange(
    params: AvailableRangeQuery,
  ): Promise<AvailableSlot[]> {
    const rangeStart = parseISO(params.startDate);
    const rangeEnd = parseISO(params.endDate);
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd }).slice(0, 31);
    if (days.length === 0) return [];

    const doctorWhere: Record<string, unknown> = {
      clinicId: params.clinicId,
    };
    if (params.doctorId) doctorWhere.id = params.doctorId;
    if (params.specialtyId) doctorWhere.specialties = { some: { id: params.specialtyId } };

    const daysOfWeek = [...new Set(days.map((d) => getDay(d)))];

    const [doctors, existingAppointments, unavailabilities] = await Promise.all([
      this.prisma.doctor.findMany({
        where: doctorWhere,
        include: {
          specialties: true,
          schedule: { where: { dayOfWeek: { in: daysOfWeek }, active: true } },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          clinicId: params.clinicId,
          ...(params.doctorId ? { doctorId: params.doctorId } : {}),
          ...(params.specialtyId
            ? { doctor: { specialties: { some: { id: params.specialtyId } } } }
            : {}),
          date: { gte: startOfDay(rangeStart), lte: endOfDay(rangeEnd) },
          status: { not: AppointmentStatus.CANCELLED },
        },
      }),
      this.prisma.doctorUnavailability.findMany({
        where: {
          ...(params.doctorId
            ? { doctorId: params.doctorId }
            : params.specialtyId
              ? { doctor: { specialties: { some: { id: params.specialtyId } }, clinicId: params.clinicId } }
              : {}),
          date: { gte: startOfDay(rangeStart), lte: endOfDay(rangeEnd) },
        },
      }),
    ]);

    if (doctors.length === 0) return [];

    const bookedSet = new Set(
      existingAppointments.map(
        (a) => `${a.doctorId}-${format(a.date, "yyyy-MM-dd-HH:mm")}`,
      ),
    );

    const unavailByDoctorDate = new Map<string, typeof unavailabilities>();
    for (const u of unavailabilities) {
      const key = `${u.doctorId}-${format(u.date, "yyyy-MM-dd")}`;
      const list = unavailByDoctorDate.get(key) ?? [];
      list.push(u);
      unavailByDoctorDate.set(key, list);
    }

    const scheduleByDoctorDay = new Map<string, typeof doctors[0]["schedule"]>();
    for (const doctor of doctors) {
      for (const sched of doctor.schedule) {
        const key = `${doctor.id}-${sched.dayOfWeek}`;
        const list = scheduleByDoctorDay.get(key) ?? [];
        list.push(sched);
        scheduleByDoctorDay.set(key, list);
      }
    }

    function isUnavailable(
      doctorId: number,
      dateStr: string,
      slotStart: string,
    ): boolean {
      const blocks = unavailByDoctorDate.get(`${doctorId}-${dateStr}`);
      if (!blocks) return false;
      for (const block of blocks) {
        if (!block.startTime || !block.endTime) return true;
        if (slotStart >= block.startTime && slotStart < block.endTime)
          return true;
      }
      return false;
    }

    const filterSpecialtyId = params.specialtyId;
    const slots: AvailableSlot[] = [];

    for (const day of days) {
      const dayOfWeek = getDay(day);
      const dateStr = format(day, "yyyy-MM-dd");

      for (const doctor of doctors) {
        const schedules =
          scheduleByDoctorDay.get(`${doctor.id}-${dayOfWeek}`) ?? [];

        const slotSpecialty = filterSpecialtyId
          ? doctor.specialties.find((s) => s.id === filterSpecialtyId)
          : doctor.specialties[0];

        if (!slotSpecialty) continue;

        for (const schedule of schedules) {
          const timeSlots = generateTimeSlots(
            schedule.startTime,
            schedule.endTime,
            schedule.slotDuration,
            schedule.lunchBreakStart,
            schedule.lunchBreakEnd,
          );
          for (const { start, end } of timeSlots) {
            if (
              !bookedSet.has(`${doctor.id}-${dateStr}-${start}`) &&
              !isUnavailable(doctor.id, dateStr, start)
            ) {
              slots.push({
                doctorId: doctor.id,
                doctorName: `${doctor.firstName} ${doctor.lastName}`,
                specialtyId: slotSpecialty.id,
                specialtyName: slotSpecialty.name,
                date: dateStr,
                startTime: start,
                endTime: end,
              });
            }
          }
        }
      }
    }

    return slots;
  }

  async bookAppointment(data: BookAppointmentInput) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: data.doctorId },
      include: { specialties: true },
    });
    if (!doctor) throw new NotFoundError("Doctor", data.doctorId);
    if (doctor.clinicId !== data.clinicId) {
      throw new AppError(
        400,
        "Doctor does not belong to this clinic",
        "DOCTOR_CLINIC_MISMATCH",
      );
    }

    const hasSpecialty = doctor.specialties.some((s) => s.id === data.specialtyId);
    if (!hasSpecialty) {
      throw new AppError(
        400,
        "El doctor no tiene asignada esta especialidad",
        "DOCTOR_SPECIALTY_MISMATCH",
      );
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: data.patientId },
    });
    if (!patient) throw new NotFoundError("Patient", data.patientId);

    const targetDate = parseISO(data.date);

    const [h, m] = data.startTime.split(":").map(Number);
    const requestedDateTime = set(targetDate, { hours: h, minutes: m, seconds: 0, milliseconds: 0 });
    if (requestedDateTime <= new Date()) {
      throw new AppError(
        400,
        "No se pueden crear turnos en el pasado",
        "APPOINTMENT_IN_PAST",
      );
    }

    const dayOfWeek = getDay(targetDate);

    const schedule = await this.prisma.doctorSchedule.findFirst({
      where: { doctorId: data.doctorId, dayOfWeek, active: true },
    });
    if (!schedule) {
      throw new AppError(
        400,
        "Doctor does not have a schedule for this day",
        "NO_SCHEDULE",
      );
    }

    if (data.startTime < schedule.startTime || data.startTime >= schedule.endTime) {
      throw new AppError(
        400,
        "Requested time is outside doctor's schedule",
        "OUTSIDE_SCHEDULE",
      );
    }

    if (schedule.lunchBreakStart && schedule.lunchBreakEnd) {
      const reqMin = toMinutes(data.startTime);
      if (reqMin >= toMinutes(schedule.lunchBreakStart) && reqMin < toMinutes(schedule.lunchBreakEnd)) {
        throw new AppError(
          400,
          "Requested time falls within doctor's lunch break",
          "LUNCH_BREAK",
        );
      }
    }

    const unavailBlock = await this.prisma.doctorUnavailability.findFirst({
      where: {
        doctorId: data.doctorId,
        date: {
          gte: startOfDay(targetDate),
          lte: endOfDay(targetDate),
        },
      },
    });

    if (unavailBlock) {
      const wholeDay = !unavailBlock.startTime || !unavailBlock.endTime;
      if (wholeDay || (data.startTime >= unavailBlock.startTime! && data.startTime < unavailBlock.endTime!)) {
        throw new AppError(
          400,
          "Doctor is marked as unavailable for this time",
          "DOCTOR_UNAVAILABLE",
        );
      }
    }

    if (!isValidSlotTime(data.startTime, schedule.startTime, schedule.slotDuration)) {
      throw new AppError(
        400,
        `Start time must align with ${schedule.slotDuration}-minute slots from ${schedule.startTime}`,
        "INVALID_SLOT_TIME",
      );
    }

    const [hours, minutes] = data.startTime.split(":").map(Number);
    const appointmentDateTime = set(targetDate, {
      hours,
      minutes,
      seconds: 0,
      milliseconds: 0,
    });

    const endTotalMinutes = hours * 60 + minutes + schedule.slotDuration;
    const endTimeStr = `${String(Math.floor(endTotalMinutes / 60)).padStart(2, "0")}:${String(endTotalMinutes % 60).padStart(2, "0")}`;

    try {
      const appointment = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.appointment.findFirst({
          where: {
            doctorId: data.doctorId,
            date: appointmentDateTime,
            startTime: data.startTime,
          },
        });

        if (existing && existing.status !== AppointmentStatus.CANCELLED) {
          throw new ConflictError("This time slot is already booked");
        }

        if (existing && existing.status === AppointmentStatus.CANCELLED) {
          await tx.appointment.delete({ where: { id: existing.id } });
        }

        return tx.appointment.create({
          data: {
            clinicId: data.clinicId,
            doctorId: data.doctorId,
            patientId: data.patientId,
            specialtyId: data.specialtyId,
            date: appointmentDateTime,
            startTime: data.startTime,
            endTime: endTimeStr,
            notes: data.notes,
          },
          include: APPOINTMENT_INCLUDE,
        });
      });

      try {
        const tokenService = new ActionTokenService(this.prisma);
        const { confirmToken, cancelToken } = await tokenService.generateTokens(appointment.id);

        await enqueueAppointmentJobs({
          appointmentId: appointment.id,
          patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          patientEmail: appointment.patient.email ?? undefined,
          patientPhone: appointment.patient.phone,
          doctorName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
          specialtyName: appointment.specialty.name,
          clinicName: appointment.clinic.name,
          date: data.date,
          startTime: data.startTime,
          confirmToken,
          cancelToken,
        });
      } catch (err) {
        logger.error({ err, appointmentId: appointment.id }, "Failed to enqueue notification jobs");
      }

      try {
        const mrService = new MedicalRecordService(this.prisma);
        await mrService.createAutoEntry(
          appointment.patientId,
          appointment.id,
          "auto_created",
          `Turno creado — Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}, ${appointment.clinic.name}, ${appointment.specialty.name}`,
          appointment.date,
        );
      } catch (err) {
        logger.error({ err, appointmentId: appointment.id }, "Failed to create auto medical record entry");
      }

      return appointment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError("This time slot is already booked");
      }
      throw error;
    }
  }

  async confirmAppointment(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) throw new NotFoundError("Appointment", id);
    if (appointment.status === AppointmentStatus.CONFIRMED) {
      throw new AppError(400, "El turno ya está confirmado", "ALREADY_CONFIRMED");
    }
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new AppError(400, "No se puede confirmar un turno cancelado", "CANCELLED");
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED },
      include: APPOINTMENT_INCLUDE,
    });

    try {
      const tokenService = new ActionTokenService(this.prisma);
      const { cancelToken } = await tokenService.generateTokens(updated.id);

      await enqueueConfirmedNotification({
        appointmentId: updated.id,
        patientName: `${updated.patient.firstName} ${updated.patient.lastName}`,
        patientEmail: updated.patient.email ?? undefined,
        patientPhone: updated.patient.phone,
        doctorName: `${updated.doctor.firstName} ${updated.doctor.lastName}`,
        specialtyName: updated.specialty.name,
        clinicName: updated.clinic.name,
        date: format(updated.date, "yyyy-MM-dd"),
        startTime: updated.startTime ?? format(updated.date, "HH:mm"),
        cancelToken,
      });
    } catch (err) {
      logger.error({ err, appointmentId: id }, "Failed to enqueue confirmed notification");
    }

    try {
      const mrService = new MedicalRecordService(this.prisma);
      await mrService.createAutoEntry(
        updated.patientId,
        updated.id,
        "auto_confirmed",
        `Turno confirmado — Dr. ${updated.doctor.firstName} ${updated.doctor.lastName}, ${updated.clinic.name}`,
        updated.date,
      );
    } catch (err) {
      logger.error({ err, appointmentId: id }, "Failed to create auto medical record entry");
    }

    return updated;
  }

  async cancelAppointment(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new NotFoundError("Appointment", id);
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new AppError(
        400,
        "Appointment is already cancelled",
        "ALREADY_CANCELLED",
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
      include: APPOINTMENT_INCLUDE,
    });

    try {
      await removeAppointmentJobs(id);
    } catch (err) {
      logger.error({ err, appointmentId: id }, "Failed to remove scheduled reminder jobs");
    }

    try {
      await enqueueCancelledNotification({
        appointmentId: updated.id,
        patientName: `${updated.patient.firstName} ${updated.patient.lastName}`,
        patientEmail: updated.patient.email ?? undefined,
        patientPhone: updated.patient.phone,
        doctorName: `${updated.doctor.firstName} ${updated.doctor.lastName}`,
        specialtyName: updated.specialty.name,
        clinicName: updated.clinic.name,
        date: format(updated.date, "yyyy-MM-dd"),
        startTime: updated.startTime ?? format(updated.date, "HH:mm"),
      });
    } catch (err) {
      logger.error({ err, appointmentId: id }, "Failed to enqueue cancelled notification");
    }

    try {
      const mrService = new MedicalRecordService(this.prisma);
      await mrService.createAutoEntry(
        updated.patientId,
        updated.id,
        "auto_cancelled",
        `Turno cancelado — Dr. ${updated.doctor.firstName} ${updated.doctor.lastName}, ${updated.clinic.name}`,
        updated.date,
      );
    } catch (err) {
      logger.error({ err, appointmentId: id }, "Failed to create auto medical record entry");
    }

    return updated;
  }

  async resendConfirmation(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) throw new NotFoundError("Appointment", id);
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new AppError(400, "No se puede reenviar para un turno cancelado", "CANCELLED");
    }
    if (!appointment.patient.email) {
      throw new AppError(400, "El paciente no tiene email registrado", "NO_EMAIL");
    }

    const tokenService = new ActionTokenService(this.prisma);
    const { confirmToken, cancelToken } = await tokenService.generateTokens(appointment.id);

    await enqueueResendConfirmation({
      appointmentId: appointment.id,
      patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      patientEmail: appointment.patient.email,
      patientPhone: appointment.patient.phone,
      doctorName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
      specialtyName: appointment.specialty.name,
      clinicName: appointment.clinic.name,
      date: format(appointment.date, "yyyy-MM-dd"),
      startTime: appointment.startTime ?? format(appointment.date, "HH:mm"),
      confirmToken,
      cancelToken,
    });

    return appointment;
  }

  async findAll(query: ListAppointmentsQuery & PaginationQuery) {
    const where: Record<string, unknown> = {};
    if (query.clinicId) where.clinicId = query.clinicId;
    if (query.doctorId) where.doctorId = query.doctorId;
    if (query.patientId) where.patientId = query.patientId;
    if (query.date) {
      const d = parseISO(query.date);
      where.date = { gte: startOfDay(d), lte: endOfDay(d) };
    }

    const orderBy = buildOrderBy(query, SORTABLE_FIELDS, { date: "asc" });
    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: APPOINTMENT_INCLUDE,
        orderBy,
        ...paginationArgs(query),
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) throw new NotFoundError("Appointment", id);
    return appointment;
  }

  // ── private ───────────────────────────────────────────────

  private async computeAvailableSlots(
    params: GetSlotsParams,
  ): Promise<AvailableSlot[]> {
    const targetDate = parseISO(params.date);
    const dayOfWeek = getDay(targetDate);

    const doctorWhere: Record<string, unknown> = {
      clinicId: params.clinicId,
    };
    if (params.doctorId) doctorWhere.id = params.doctorId;
    if (params.specialtyId) doctorWhere.specialties = { some: { id: params.specialtyId } };

    const doctors = await this.prisma.doctor.findMany({
      where: doctorWhere,
      include: {
        specialties: true,
        schedule: { where: { dayOfWeek, active: true } },
      },
    });

    if (params.doctorId && doctors.length === 0) {
      throw new AppError(
        400,
        "Doctor not found or does not belong to this clinic",
        "DOCTOR_CLINIC_MISMATCH",
      );
    }

    const doctorIds = doctors.map((d) => d.id);
    if (doctorIds.length === 0) return [];

    const [existingAppointments, unavailabilities] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          doctorId: { in: doctorIds },
          date: {
            gte: startOfDay(targetDate),
            lte: endOfDay(targetDate),
          },
          status: { not: AppointmentStatus.CANCELLED },
        },
      }),
      this.prisma.doctorUnavailability.findMany({
        where: {
          doctorId: { in: doctorIds },
          date: {
            gte: startOfDay(targetDate),
            lte: endOfDay(targetDate),
          },
        },
      }),
    ]);

    const bookedSet = new Set(
      existingAppointments.map(
        (a) => `${a.doctorId}-${format(a.date, "HH:mm")}`,
      ),
    );

    const unavailMap = new Map<number, typeof unavailabilities>();
    for (const u of unavailabilities) {
      const list = unavailMap.get(u.doctorId) ?? [];
      list.push(u);
      unavailMap.set(u.doctorId, list);
    }

    function isUnavailable(doctorId: number, slotStart: string): boolean {
      const blocks = unavailMap.get(doctorId);
      if (!blocks) return false;
      for (const block of blocks) {
        if (!block.startTime || !block.endTime) return true;
        if (slotStart >= block.startTime && slotStart < block.endTime) return true;
      }
      return false;
    }

    const filterSpecialtyId = params.specialtyId;
    const slots: AvailableSlot[] = [];

    for (const doctor of doctors) {
      const slotSpecialty = filterSpecialtyId
        ? doctor.specialties.find((s) => s.id === filterSpecialtyId)
        : doctor.specialties[0];

      if (!slotSpecialty) continue;

      for (const schedule of doctor.schedule) {
        const timeSlots = generateTimeSlots(
          schedule.startTime,
          schedule.endTime,
          schedule.slotDuration,
          schedule.lunchBreakStart,
          schedule.lunchBreakEnd,
        );
        for (const { start, end } of timeSlots) {
          if (
            !bookedSet.has(`${doctor.id}-${start}`) &&
            !isUnavailable(doctor.id, start)
          ) {
            slots.push({
              doctorId: doctor.id,
              doctorName: `${doctor.firstName} ${doctor.lastName}`,
              specialtyId: slotSpecialty.id,
              specialtyName: slotSpecialty.name,
              date: params.date,
              startTime: start,
              endTime: end,
            });
          }
        }
      }
    }

    return slots;
  }
}
