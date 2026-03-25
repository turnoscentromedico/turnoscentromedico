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
import { cleanDatabase, seedAdminUser, injectPost, injectGet, injectPut, injectDelete } from "./helpers";

describe("Specialty CRUD", () => {
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

  it("POST /api/specialties — should create a specialty", async () => {
    const res = await injectPost(app, "/api/specialties", {
      name: "Neurología",
      description: "Sistema nervioso",
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe("Neurología");
    expect(body.data.id).toBeDefined();
  });

  it("POST /api/specialties — should reject duplicate name", async () => {
    await injectPost(app, "/api/specialties", { name: "Dermatología" });
    const res = await injectPost(app, "/api/specialties", { name: "Dermatología" });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("CONFLICT");
  });

  it("GET /api/specialties — should list all specialties", async () => {
    await injectPost(app, "/api/specialties", { name: "Pediatría" });
    await injectPost(app, "/api/specialties", { name: "Traumatología" });

    const res = await injectGet(app, "/api/specialties");

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
  });

  it("GET /api/specialties/:id — should return one specialty", async () => {
    const created = await injectPost(app, "/api/specialties", { name: "Urología" });
    const id = created.json().data.id;

    const res = await injectGet(app, `/api/specialties/${id}`);

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("Urología");
  });

  it("GET /api/specialties/:id — should return 404 for unknown id", async () => {
    const res = await injectGet(app, "/api/specialties/9999");

    expect(res.statusCode).toBe(404);
  });

  it("PUT /api/specialties/:id — should update a specialty", async () => {
    const created = await injectPost(app, "/api/specialties", { name: "Ginecología" });
    const id = created.json().data.id;

    const res = await injectPut(app, `/api/specialties/${id}`, {
      name: "Ginecología y Obstetricia",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("Ginecología y Obstetricia");
  });

  it("DELETE /api/specialties/:id — should delete a specialty", async () => {
    const created = await injectPost(app, "/api/specialties", { name: "Oftalmología" });
    const id = created.json().data.id;

    const res = await injectDelete(app, `/api/specialties/${id}`);

    expect(res.statusCode).toBe(204);

    const check = await injectGet(app, `/api/specialties/${id}`);
    expect(check.statusCode).toBe(404);
  });
});
