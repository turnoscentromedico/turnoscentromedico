import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ScheduleService } from "./schedule.service";
import {
  createScheduleSchema,
  updateScheduleSchema,
  bulkScheduleSchema,
  scheduleIdParamSchema,
  scheduleByDoctorSchema,
} from "./schedule.schema";

export async function scheduleRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new ScheduleService(app.prisma);

  router.post(
    "/",
    { schema: { body: createScheduleSchema } },
    async (request, reply) => {
      const schedule = await service.create(request.body);
      return reply.status(201).send({ success: true, data: schedule });
    },
  );

  router.put(
    "/doctor/:doctorId/bulk",
    { schema: { params: scheduleByDoctorSchema, body: bulkScheduleSchema } },
    async (request, reply) => {
      const schedules = await service.bulkReplace(
        request.params.doctorId,
        request.body,
      );
      return reply.send({ success: true, data: schedules });
    },
  );

  router.get(
    "/doctor/:doctorId",
    { schema: { params: scheduleByDoctorSchema } },
    async (request, reply) => {
      const schedules = await service.findByDoctor(request.params.doctorId);
      return reply.send({ success: true, data: schedules });
    },
  );

  router.get(
    "/:id",
    { schema: { params: scheduleIdParamSchema } },
    async (request, reply) => {
      const schedule = await service.findById(request.params.id);
      return reply.send({ success: true, data: schedule });
    },
  );

  router.put(
    "/:id",
    { schema: { params: scheduleIdParamSchema, body: updateScheduleSchema } },
    async (request, reply) => {
      const schedule = await service.update(request.params.id, request.body);
      return reply.send({ success: true, data: schedule });
    },
  );

  router.delete(
    "/:id",
    { schema: { params: scheduleIdParamSchema } },
    async (request, reply) => {
      await service.delete(request.params.id);
      return reply.status(204).send();
    },
  );
}
