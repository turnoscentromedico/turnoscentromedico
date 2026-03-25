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
  injectPost,
  injectGet,
  injectPut,
  injectDelete,
} from "./helpers";

describe("Patient CRUD (protected)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await seedAdminUser();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  it("POST /api/patients — should create a patient", async () => {
    const res = await injectPost(app, "/api/patients", {
      firstName: "Ana",
      lastName: "Martínez",
      email: "ana@test.com",
      phone: "5491100001111",
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.firstName).toBe("Ana");
    expect(body.data.email).toBe("ana@test.com");
  });

  it("POST /api/patients — should reject without auth", async () => {
    const res = await injectPost(
      app,
      "/api/patients",
      { firstName: "X", lastName: "Y", email: "x@y.com" },
      false,
    );

    expect(res.statusCode).toBe(401);
  });

  it("POST /api/patients — should reject duplicate email", async () => {
    await injectPost(app, "/api/patients", {
      firstName: "A",
      lastName: "B",
      email: "dup@test.com",
    });
    const res = await injectPost(app, "/api/patients", {
      firstName: "C",
      lastName: "D",
      email: "dup@test.com",
    });

    expect(res.statusCode).toBe(409);
  });

  it("GET /api/patients — should list patients", async () => {
    await injectPost(app, "/api/patients", {
      firstName: "P1",
      lastName: "L1",
      email: "p1@test.com",
    });
    await injectPost(app, "/api/patients", {
      firstName: "P2",
      lastName: "L2",
      email: "p2@test.com",
    });

    const res = await injectGet(app, "/api/patients", true);

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
  });

  it("GET /api/patients/:id — should return one patient", async () => {
    const created = await injectPost(app, "/api/patients", {
      firstName: "Solo",
      lastName: "Patient",
      email: "solo@test.com",
    });
    const id = created.json().data.id;

    const res = await injectGet(app, `/api/patients/${id}`, true);

    expect(res.statusCode).toBe(200);
    expect(res.json().data.firstName).toBe("Solo");
    expect(res.json().data._count).toBeDefined();
  });

  it("PUT /api/patients/:id — should update a patient", async () => {
    const created = await injectPost(app, "/api/patients", {
      firstName: "Old",
      lastName: "Name",
      email: "old@test.com",
    });
    const id = created.json().data.id;

    const res = await injectPut(app, `/api/patients/${id}`, {
      firstName: "New",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.firstName).toBe("New");
  });

  it("DELETE /api/patients/:id — should delete a patient", async () => {
    const created = await injectPost(app, "/api/patients", {
      firstName: "Del",
      lastName: "Me",
      email: "del@test.com",
    });
    const id = created.json().data.id;

    const res = await injectDelete(app, `/api/patients/${id}`);
    expect(res.statusCode).toBe(204);
  });

  it("POST /api/patients — should validate required fields", async () => {
    const res = await injectPost(app, "/api/patients", { firstName: "X" });

    expect(res.statusCode).toBe(400);
  });
});
