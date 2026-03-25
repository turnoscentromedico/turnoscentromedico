import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

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
import { AUTH_HEADER, cleanDatabase, seedAdminUser } from "./helpers";

describe("Auth middleware", () => {
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
    await app.close();
  });

  it("should return 401 on protected route without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/clinics" });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("UNAUTHORIZED");
  });

  it("should return 401 with malformed Authorization header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/clinics",
      headers: { authorization: "InvalidFormat" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("should pass with valid Bearer token when user is registered (dev mode)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/clinics",
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(200);
  });

  it("should return 403 when authenticated but user is not registered in DB", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/clinics",
      headers: {
        authorization: "Bearer unknown-user-token-not-in-db-xyz",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("FORBIDDEN");
  });

  it("should allow public routes without token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/specialties",
    });

    expect(res.statusCode).toBe(200);
  });

  it("should return user data and role on GET /api/me with token (dev mode)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: AUTH_HEADER,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe("dev-test-tok");
    expect(body.data.role).toBe("ADMIN");
    expect(body.data.systemUserId).toBeDefined();
  });

  it("should return 401 on GET /api/me without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/me" });

    expect(res.statusCode).toBe(401);
  });
});
