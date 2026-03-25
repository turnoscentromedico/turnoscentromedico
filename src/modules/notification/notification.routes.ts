import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { InternalNotificationService } from "../../services/internal-notification.service";
import { paginationQuerySchema } from "../../utils/pagination";

export async function notificationRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new InternalNotificationService(app.prisma);

  router.get(
    "/",
    { schema: { querystring: paginationQuerySchema } },
    async (request, reply) => {
      const isAdmin = request.userRole === "ADMIN";
      const clinicIds = isAdmin ? undefined : request.userClinicIds;
      const result = await service.findAll({ clinicIds, ...request.query });
      return reply.send({ success: true, ...result });
    },
  );

  router.get("/unread-count", async (request, reply) => {
    const isAdmin = request.userRole === "ADMIN";
    const clinicIds = isAdmin ? undefined : request.userClinicIds;
    const count = await service.unreadCount(clinicIds);
    return reply.send({ success: true, data: { count } });
  });

  router.patch(
    "/:id/read",
    { schema: { params: z.object({ id: z.coerce.number().int().positive() }) } },
    async (request, reply) => {
      const notif = await service.markAsRead(request.params.id);
      return reply.send({ success: true, data: notif });
    },
  );

  router.patch("/read-all", async (request, reply) => {
    const isAdmin = request.userRole === "ADMIN";
    const clinicIds = isAdmin ? undefined : request.userClinicIds;
    await service.markAllAsRead(clinicIds);
    return reply.send({ success: true });
  });
}
