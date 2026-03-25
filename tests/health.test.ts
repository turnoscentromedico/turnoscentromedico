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

describe("GET /health", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return status ok and service statuses", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.environment).toBe("test");
    expect(body.services).toBeDefined();
    expect(body.services.database).toBe("connected");
    expect(body.services.clerk).toBe("dev-mode");
  });

  it("should include a valid timestamp", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const body = res.json();
    const ts = new Date(body.timestamp);

    expect(ts.getTime()).not.toBeNaN();
  });
});
