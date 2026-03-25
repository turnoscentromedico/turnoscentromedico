import type { FastifyInstance } from "fastify";
import { UserPreferenceService } from "./user-preference.service";

export async function userPreferenceRoutes(app: FastifyInstance) {
  const service = new UserPreferenceService(app.prisma);

  app.get("/", async (request, reply) => {
    const userId = request.systemUserId;
    if (!userId) return reply.unauthorized();

    const data = await service.get(userId);
    return reply.send({ success: true, data });
  });

  app.put("/", async (request, reply) => {
    const userId = request.systemUserId;
    if (!userId) return reply.unauthorized();

    const body = request.body as Record<string, unknown>;
    const data = await service.set(userId, body);
    return reply.send({ success: true, data });
  });
}
