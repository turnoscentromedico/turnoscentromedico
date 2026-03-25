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

describe("Clinic CRUD (protected)", () => {
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

  it("POST /api/clinics — should create a clinic", async () => {
    const res = await injectPost(app, "/api/clinics", {
      name: "Clínica Norte",
      address: "Calle Falsa 123",
      phone: "011-4444-0000",
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("Clínica Norte");
  });

  it("POST /api/clinics — should reject without auth", async () => {
    const res = await injectPost(
      app,
      "/api/clinics",
      { name: "Clínica Sin Auth" },
      false,
    );

    expect(res.statusCode).toBe(401);
  });

  it("GET /api/clinics — should list clinics", async () => {
    await injectPost(app, "/api/clinics", { name: "Clínica A" });
    await injectPost(app, "/api/clinics", { name: "Clínica B" });

    const res = await injectGet(app, "/api/clinics", true);

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
  });

  it("GET /api/clinics/:id — should return a clinic with counts", async () => {
    const created = await injectPost(app, "/api/clinics", { name: "Clínica X" });
    const id = created.json().data.id;

    const res = await injectGet(app, `/api/clinics/${id}`, true);

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("Clínica X");
    expect(res.json().data._count).toBeDefined();
  });

  it("PUT /api/clinics/:id — should update a clinic", async () => {
    const created = await injectPost(app, "/api/clinics", { name: "Old Name" });
    const id = created.json().data.id;

    const res = await injectPut(app, `/api/clinics/${id}`, {
      name: "New Name",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("New Name");
  });

  it("DELETE /api/clinics/:id — should delete a clinic", async () => {
    const created = await injectPost(app, "/api/clinics", { name: "To Delete" });
    const id = created.json().data.id;

    const res = await injectDelete(app, `/api/clinics/${id}`);
    expect(res.statusCode).toBe(204);

    const check = await injectGet(app, `/api/clinics/${id}`, true);
    expect(check.statusCode).toBe(404);
  });

  it("GET /api/clinics/:id — should 404 for unknown id", async () => {
    const res = await injectGet(app, "/api/clinics/9999", true);
    expect(res.statusCode).toBe(404);
  });
});
