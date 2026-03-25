import { type PrismaClient, Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../utils/errors";
import type {
  CreateScheduleInput,
  UpdateScheduleInput,
  BulkScheduleInput,
} from "./schedule.schema";

export class ScheduleService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateScheduleInput) {
    const doctor = await this.prisma.doctor.findUnique({ where: { id: data.doctorId } });
    if (!doctor) throw new NotFoundError("Doctor", data.doctorId);

    try {
      return await this.prisma.doctorSchedule.create({
        data,
        include: { doctor: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError(
          `Doctor already has a schedule for day ${data.dayOfWeek}`,
        );
      }
      throw error;
    }
  }

  async bulkReplace(doctorId: number, input: BulkScheduleInput) {
    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundError("Doctor", doctorId);

    return this.prisma.$transaction(async (tx) => {
      await tx.doctorSchedule.deleteMany({ where: { doctorId } });

      if (input.schedules.length === 0) return [];

      await tx.doctorSchedule.createMany({
        data: input.schedules.map((s) => ({ ...s, doctorId })),
      });

      return tx.doctorSchedule.findMany({
        where: { doctorId },
        orderBy: { dayOfWeek: "asc" },
      });
    });
  }

  async findByDoctor(doctorId: number) {
    return this.prisma.doctorSchedule.findMany({
      where: { doctorId },
      orderBy: { dayOfWeek: "asc" },
    });
  }

  async findById(id: number) {
    const schedule = await this.prisma.doctorSchedule.findUnique({
      where: { id },
      include: { doctor: true },
    });
    if (!schedule) throw new NotFoundError("Schedule", id);
    return schedule;
  }

  async update(id: number, data: UpdateScheduleInput) {
    await this.findById(id);
    return this.prisma.doctorSchedule.update({
      where: { id },
      data,
      include: { doctor: true },
    });
  }

  async delete(id: number) {
    await this.findById(id);
    return this.prisma.doctorSchedule.delete({ where: { id } });
  }
}
