import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { addDays, getDay, format, parseISO } from "date-fns";

const mocks = vi.hoisted(() => ({
  enqueueAppointmentJobs: vi.fn().mockResolvedValue(undefined),
  removeAppointmentJobs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/queue/index", () => ({
  redisOptions: { host: "localhost", port: 6379, maxRetriesPerRequest: null },
}));
vi.mock("../src/queue/appointment.queue", () => ({
  APPOINTMENT_QUEUE_NAME: "test",
  appointmentQueue: { add: vi.fn(), getJob: vi.fn(), close: vi.fn() },
  ...mocks,
}));
vi.mock("../src/plugins/bull-board", () => ({
  default: async () => {},
}));

import { buildApp } from "../src/app";
import type { FastifyInstance } from "fastify";
import {
  cleanDatabase,
  prisma,
  seedAdminUser,
  seedClinic,
  seedSpecialty,
  seedDoctor,
  seedPatient,
  seedSchedule,
  injectGet,
  injectPost,
  injectPatch,
} from "./helpers";

function getNextMonday(): string {
  let d = new Date();
  while (getDay(d) !== 1) d = addDays(d, 1);
  return format(d, "yyyy-MM-dd");
}

describe("Appointment module", () => {
  let app: FastifyInstance;
  let clinicId: number;
  let specialtyId: number;
  let doctorId: number;
  let patientId: number;
  let mondayDate: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    mondayDate = getNextMonday();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await seedAdminUser();
    mocks.enqueueAppointmentJobs.mockClear();
    mocks.removeAppointmentJobs.mockClear();

    const clinic = await seedClinic();
    const specialty = await seedSpecialty();
    const doctor = await seedDoctor(specialty.id, clinic.id);
    const patient = await seedPatient();
    await seedSchedule(doctor.id, 1); // Monday

    clinicId = clinic.id;
    specialtyId = specialty.id;
    doctorId = doctor.id;
    patientId = patient.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  describe("GET /api/appointments/available", () => {
    it("should return available slots for a doctor", async () => {
      const res = await injectGet(
        app,
        `/api/appointments/available?clinicId=${clinicId}&doctorId=${doctorId}&date=${mondayDate}`,
      );

      expect(res.statusCode).toBe(200);
      const slots = res.json().data;
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toMatchObject({
        doctorId,
        doctorName: "Carlos García",
        specialtyId,
        date: mondayDate,
        startTime: "09:00",
        endTime: "09:30",
      });
    });

    it("should return slots by specialty", async () => {
      const res = await injectGet(
        app,
        `/api/appointments/available-by-specialty?clinicId=${clinicId}&specialtyId=${specialtyId}&date=${mondayDate}`,
      );

      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBeGreaterThan(0);
    });

    it("should return empty for a day without schedule", async () => {
      const tuesday = format(addDays(parseISO(mondayDate), 1), "yyyy-MM-dd");
      const res = await injectGet(
        app,
        `/api/appointments/available?clinicId=${clinicId}&doctorId=${doctorId}&date=${tuesday}`,
      );

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(0);
    });

    it("should not require auth (public route)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/appointments/available?clinicId=${clinicId}&doctorId=${doctorId}&date=${mondayDate}`,
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/appointments (booking)", () => {
    it("should book an appointment successfully", async () => {
      const res = await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "09:00",
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.doctor).toBeDefined();
      expect(body.data.patient).toBeDefined();
      expect(body.data.clinic).toBeDefined();
      expect(body.data.specialty).toBeDefined();
      expect(body.data.status).toBe("PENDING");
    });

    it("should enqueue 3 notification jobs after booking", async () => {
      await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "10:00",
      });

      expect(mocks.enqueueAppointmentJobs).toHaveBeenCalledTimes(1);
      const callArgs = mocks.enqueueAppointmentJobs.mock.calls[0][0];
      expect(callArgs).toMatchObject({
        patientName: "Juan Pérez",
        patientEmail: "test@example.com",
        doctorName: "Carlos García",
        clinicName: "Clínica Central",
        date: mondayDate,
        startTime: "10:00",
      });
    });

    it("should reject double-booking the same slot", async () => {
      await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "11:00",
      });

      const patient2 = await seedPatient("otro@test.com");
      const res = await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId: patient2.id,
        date: mondayDate,
        startTime: "11:00",
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe("CONFLICT");
    });

    it("should reject booking outside schedule hours", async () => {
      const res = await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "07:00",
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("OUTSIDE_SCHEDULE");
    });

    it("should reject unaligned slot times", async () => {
      const res = await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "09:15",
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("INVALID_SLOT_TIME");
    });

    it("should reject if doctor does not belong to clinic", async () => {
      const otherClinic = await seedClinic("Otra Clínica");
      const res = await injectPost(app, "/api/appointments", {
        clinicId: otherClinic.id,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "09:00",
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("DOCTOR_CLINIC_MISMATCH");
    });

    it("should reject without auth", async () => {
      const res = await injectPost(
        app,
        "/api/appointments",
        { clinicId, doctorId, patientId, date: mondayDate, startTime: "09:00" },
        false,
      );

      expect(res.statusCode).toBe(401);
    });

    it("should remove booked slot from available list", async () => {
      await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "09:00",
      });

      const res = await injectGet(
        app,
        `/api/appointments/available?clinicId=${clinicId}&doctorId=${doctorId}&date=${mondayDate}`,
      );

      const slots = res.json().data;
      const bookedSlot = slots.find(
        (s: { startTime: string }) => s.startTime === "09:00",
      );
      expect(bookedSlot).toBeUndefined();
    });
  });

  describe("PATCH /api/appointments/:id/cancel", () => {
    it("should cancel an appointment", async () => {
      const booking = await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "14:00",
      });
      const id = booking.json().data.id;

      const res = await injectPatch(app, `/api/appointments/${id}/cancel`);

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe("CANCELLED");
    });

    it("should call removeAppointmentJobs on cancel", async () => {
      const booking = await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "15:00",
      });
      const id = booking.json().data.id;
      mocks.removeAppointmentJobs.mockClear();

      await injectPatch(app, `/api/appointments/${id}/cancel`);

      expect(mocks.removeAppointmentJobs).toHaveBeenCalledWith(id);
    });

    it("should reject cancelling an already cancelled appointment", async () => {
      const booking = await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "16:00",
      });
      const id = booking.json().data.id;

      await injectPatch(app, `/api/appointments/${id}/cancel`);
      const res = await injectPatch(app, `/api/appointments/${id}/cancel`);

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("ALREADY_CANCELLED");
    });

    it("should 404 for unknown appointment", async () => {
      const res = await injectPatch(app, "/api/appointments/9999/cancel");
      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /api/appointments", () => {
    it("should list appointments with filters", async () => {
      await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "09:00",
      });

      const all = await injectGet(app, "/api/appointments", true);
      expect(all.json().data).toHaveLength(1);

      const byClinic = await injectGet(
        app,
        `/api/appointments?clinicId=${clinicId}`,
        true,
      );
      expect(byClinic.json().data).toHaveLength(1);

      const byOther = await injectGet(
        app,
        "/api/appointments?clinicId=9999",
        true,
      );
      expect(byOther.json().data).toHaveLength(0);
    });

    it("GET /api/appointments/:id — should return appointment detail", async () => {
      const booking = await injectPost(app, "/api/appointments", {
        clinicId,
        doctorId,
        patientId,
        date: mondayDate,
        startTime: "12:00",
      });
      const id = booking.json().data.id;

      const res = await injectGet(app, `/api/appointments/${id}`, true);

      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(id);
      expect(res.json().data.doctor.firstName).toBe("Carlos");
      expect(res.json().data.doctor.lastName).toBe("García");
    });
  });
});
