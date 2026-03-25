import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SpecialtyService } from "./specialty.service";
import {
  createSpecialtySchema,
  updateSpecialtySchema,
  specialtyIdParamSchema,
} from "./specialty.schema";
import { paginationQuerySchema } from "../../utils/pagination";

export async function specialtyPublicRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new SpecialtyService(app.prisma);

  router.get(
    "/",
    { schema: { querystring: paginationQuerySchema } },
    async (request, reply) => {
      const result = await service.findAll(request.query);
      return reply.send({ success: true, ...result });
    },
  );

  router.get(
    "/:id",
    { schema: { params: specialtyIdParamSchema } },
    async (request, reply) => {
      const specialty = await service.findById(request.params.id);
      return reply.send({ success: true, data: specialty });
    },
  );
}

export async function specialtyAdminRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new SpecialtyService(app.prisma);

  router.post(
    "/",
    { schema: { body: createSpecialtySchema } },
    async (request, reply) => {
      const specialty = await service.create(request.body);
      return reply.status(201).send({ success: true, data: specialty });
    },
  );

  router.put(
    "/:id",
    { schema: { params: specialtyIdParamSchema, body: updateSpecialtySchema } },
    async (request, reply) => {
      const specialty = await service.update(request.params.id, request.body);
      return reply.send({ success: true, data: specialty });
    },
  );

  router.delete(
    "/:id",
    { schema: { params: specialtyIdParamSchema } },
    async (request, reply) => {
      await service.delete(request.params.id);
      return reply.status(204).send();
    },
  );
}
