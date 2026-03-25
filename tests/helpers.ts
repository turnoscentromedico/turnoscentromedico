import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

export const prisma = new PrismaClient();

export const AUTH_HEADER = {
  authorization: "Bearer test-token-abcdef1234567890",
};

export async function cleanDatabase() {
  const tables = [
    "appointments",
    "doctor_schedules",
    "doctors",
    "patients",
    "specialties",
    "users",
    "clinics",
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`,
    );
  }
}

export async function seedAdminUser() {
  return prisma.user.create({
    data: {
      clerkUserId: "dev-test-tok",
      name: "Test Admin",
      email: "admin@test.com",
      role: "ADMIN",
    },
  });
}

export async function seedOperatorUser(clinicId?: number) {
  return prisma.user.create({
    data: {
      clerkUserId: "dev-operator",
      name: "Test Operator",
      email: "operator@test.com",
      role: "OPERATOR",
      clinicId,
    },
  });
}

export const OPERATOR_AUTH_HEADER = {
  authorization: "Bearer operator-token-1234",
};

export async function seedClinic(name = "Clínica Central") {
  return prisma.clinic.create({
    data: { name, address: "Av. Corrientes 1234", phone: "011-5555-0000" },
  });
}

export async function seedSpecialty(name = "Cardiología") {
  return prisma.specialty.create({
    data: { name, description: `Especialidad de ${name}` },
  });
}

export async function seedDoctor(
  specialtyId: number,
  clinicId: number,
  firstName = "Carlos",
  lastName = "García",
) {
  return prisma.doctor.create({
    data: {
      firstName,
      lastName,
      dni: `${Date.now()}`,
      licenseNumber: `MP-${Date.now()}`,
      specialtyId,
      clinicId,
    },
  });
}

export async function seedPatient(email = "test@example.com") {
  return prisma.patient.create({
    data: {
      firstName: "Juan",
      lastName: "Pérez",
      email,
      phone: "5491155551234",
    },
  });
}

export async function seedSchedule(
  doctorId: number,
  dayOfWeek: number,
  startTime = "09:00",
  endTime = "17:00",
) {
  return prisma.doctorSchedule.create({
    data: { doctorId, dayOfWeek, startTime, endTime, slotDuration: 30 },
  });
}

export async function seedFullScenario() {
  const admin = await seedAdminUser();
  const clinic = await seedClinic();
  const specialty = await seedSpecialty();
  const doctor = await seedDoctor(specialty.id, clinic.id);
  const patient = await seedPatient();
  const schedule = await seedSchedule(doctor.id, 1);
  return { admin, clinic, specialty, doctor, patient, schedule };
}

export function injectGet(app: FastifyInstance, url: string, auth = false) {
  return app.inject({
    method: "GET",
    url,
    headers: auth ? AUTH_HEADER : {},
  });
}

export function injectPost(
  app: FastifyInstance,
  url: string,
  payload: unknown,
  auth = true,
) {
  return app.inject({
    method: "POST",
    url,
    payload,
    headers: auth ? AUTH_HEADER : {},
  });
}

export function injectPut(
  app: FastifyInstance,
  url: string,
  payload: unknown,
) {
  return app.inject({
    method: "PUT",
    url,
    payload,
    headers: AUTH_HEADER,
  });
}

export function injectDelete(app: FastifyInstance, url: string) {
  return app.inject({
    method: "DELETE",
    url,
    headers: AUTH_HEADER,
  });
}

export function injectPatch(app: FastifyInstance, url: string) {
  return app.inject({
    method: "PATCH",
    url,
    headers: AUTH_HEADER,
  });
}
