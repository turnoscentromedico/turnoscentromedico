import type { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../../utils/errors";
import type { CreateUnavailabilityInput } from "./unavailability.schema";

export class UnavailabilityService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateUnavailabilityInput) {
    const doctor = await this.prisma.doctor.findUnique({ where: { id: data.doctorId } });
    if (!doctor) throw new NotFoundError("Doctor", data.doctorId);

    return this.prisma.doctorUnavailability.create({ data });
  }

  async findByDoctor(doctorId: number) {
    return this.prisma.doctorUnavailability.findMany({
      where: { doctorId },
      orderBy: { date: "asc" },
    });
  }

  async delete(id: number) {
    const item = await this.prisma.doctorUnavailability.findUnique({ where: { id } });
    if (!item) throw new NotFoundError("DoctorUnavailability", id);
    return this.prisma.doctorUnavailability.delete({ where: { id } });
  }
}
