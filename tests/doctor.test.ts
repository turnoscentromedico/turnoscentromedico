import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

vi.mock("../src/queue/index", () => ({
  redisOptions: { host: "localhost", port: 6379, maxRetriesPerRequest: null },
}));
vi.mock("../src/queue/appointment.queue", () => ({
  APPOINTMENT_QUEUE_NAME: "test",
  appointmentQueue: { add: vi.fn(), getJob: vi.fn(), close: vi.fn() },
  enqueueAppointmentJobs: vi.fn(),
  removeAppointmentJobs: vi.fn(),
}));
vi.mock("../src/plugins/bull-board", () => ({
  default: async () => {},
}));

import { buildApp } from "../src/app";
import type { FastifyInstance } from "fastify";
import {
  cleanDatabase,
  seedAdminUser,
  seedClinic,
  seedSpecialty,
  injectPost,
  injectGet,
  injectPut,
  injectDelete,
} from "./helpers";

const DOCTOR_DATA = {
  firstName: "Carlos",
  lastName: "López",
  dni: "12345678",
  licenseNumber: "MP-1234",
};

describe("Doctor routes", () => {
  let app: FastifyInstance;
  let clinicId: number;
  let specialtyId: number;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await seedAdminUser();
    const clinic = await seedClinic();
    const specialty = await seedSpecialty();
    clinicId = clinic.id;
    specialtyId = specialty.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  describe("Public (GET)", () => {
    it("GET /api/doctors — should list doctors without auth", async () => {
      await injectPost(app, "/api/doctors", {
        ...DOCTOR_DATA,
        specialtyId,
        clinicId,
      });

      const res = await injectGet(app, "/api/doctors");

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
      expect(res.json().data[0].specialty).toBeDefined();
      expect(res.json().data[0].clinic).toBeDefined();
    });

    it("GET /api/doctors?specialtyId=X — should filter by specialty", async () => {
      await injectPost(app, "/api/doctors", {
        ...DOCTOR_DATA,
        specialtyId,
        clinicId,
      });

      const res = await injectGet(app, `/api/doctors?specialtyId=${specialtyId}`);
      expect(res.json().data).toHaveLength(1);

      const res2 = await injectGet(app, "/api/doctors?specialtyId=9999");
      expect(res2.json().data).toHaveLength(0);
    });

    it("GET /api/doctors/:id — should return one doctor without auth", async () => {
      const created = await injectPost(app, "/api/doctors", {
        ...DOCTOR_DATA,
        specialtyId,
        clinicId,
      });
      const id = created.json().data.id;

      const res = await injectGet(app, `/api/doctors/${id}`);

      expect(res.statusCode).toBe(200);
      expect(res.json().data.firstName).toBe("Carlos");
      expect(res.json().data.lastName).toBe("López");
    });
  });

  describe("Protected (write)", () => {
    it("POST /api/doctors — should create a doctor with auth", async () => {
      const res = await injectPost(app, "/api/doctors", {
        ...DOCTOR_DATA,
        specialtyId,
        clinicId,
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().data.firstName).toBe("Carlos");
      expect(res.json().data.dni).toBe("12345678");
      expect(res.json().data.licenseNumber).toBe("MP-1234");
    });

    it("POST /api/doctors — should reject without auth", async () => {
      const res = await injectPost(
        app,
        "/api/doctors",
        { ...DOCTOR_DATA, specialtyId, clinicId },
        false,
      );

      expect(res.statusCode).toBe(401);
    });

    it("POST /api/doctors — should fail with invalid specialtyId", async () => {
      const res = await injectPost(app, "/api/doctors", {
        ...DOCTOR_DATA,
        specialtyId: 9999,
        clinicId,
      });

      expect(res.statusCode).toBe(404);
    });

    it("POST /api/doctors — should reject duplicate DNI", async () => {
      await injectPost(app, "/api/doctors", {
        ...DOCTOR_DATA,
        specialtyId,
        clinicId,
      });

      const res = await injectPost(app, "/api/doctors", {
        ...DOCTOR_DATA,
        licenseNumber: "MP-9999",
        specialtyId,
        clinicId,
      });

      expect(res.statusCode).toBe(409);
    });

    it("POST /api/doctors — should reject duplicate licenseNumber", async () => {
      await injectPost(app, "/api/doctors", {
        ...DOCTOR_DATA,
        specialtyId,
        clinicId,
      });

      const res = await injectPost(app, "/api/doctors", {
        ...DOCTOR_DATA,
        dni: "99999999",
        specialtyId,
        clinicId,
      });

      expect(res.statusCode).toBe(409);
    });

    it("PUT /api/doctors/:id — should update a doctor", async () => {
      const created = await injectPost(app, "/api/doctors", {
        ...DOCTOR_DATA,
        specialtyId,
        clinicId,
      });
      const id = created.json().data.id;

      const res = await injectPut(app, `/api/doctors/${id}`, {
        firstName: "Roberto",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.firstName).toBe("Roberto");
    });

    it("DELETE /api/doctors/:id — should delete a doctor", async () => {
      const created = await injectPost(app, "/api/doctors", {
        ...DOCTOR_DATA,
        specialtyId,
        clinicId,
      });
      const id = created.json().data.id;

      const res = await injectDelete(app, `/api/doctors/${id}`);
      expect(res.statusCode).toBe(204);
    });
  });
});
