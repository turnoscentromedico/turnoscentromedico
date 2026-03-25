import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SettingsService } from "./settings.service";
import { updateSettingsSchema } from "./settings.schema";

export async function settingsPublicRoutes(app: FastifyInstance) {
  const service = new SettingsService(app.prisma);

  app.get("/", async (_request, reply) => {
    const settings = await service.getAll();
    return reply.send({ success: true, data: settings });
  });
}

export async function settingsAdminRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new SettingsService(app.prisma);

  router.put(
    "/",
    { schema: { body: updateSettingsSchema } },
    async (request, reply) => {
      await service.bulkSet(request.body as Record<string, string>);
      const settings = await service.getAll();
      return reply.send({ success: true, data: settings });
    },
  );
}
