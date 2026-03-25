import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UnavailabilityService } from "./unavailability.service";
import {
  createUnavailabilitySchema,
  unavailabilityIdParamSchema,
  unavailabilityByDoctorSchema,
} from "./unavailability.schema";

export async function unavailabilityRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new UnavailabilityService(app.prisma);

  router.post(
    "/",
    { schema: { body: createUnavailabilitySchema } },
    async (request, reply) => {
      const item = await service.create(request.body);
      return reply.status(201).send({ success: true, data: item });
    },
  );

  router.get(
    "/doctor/:doctorId",
    { schema: { params: unavailabilityByDoctorSchema } },
    async (request, reply) => {
      const items = await service.findByDoctor(request.params.doctorId);
      return reply.send({ success: true, data: items });
    },
  );

  router.delete(
    "/:id",
    { schema: { params: unavailabilityIdParamSchema } },
    async (request, reply) => {
      await service.delete(request.params.id);
      return reply.status(204).send();
    },
  );
}
