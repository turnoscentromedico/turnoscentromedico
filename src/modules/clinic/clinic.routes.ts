import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ClinicService } from "./clinic.service";
import {
  createClinicSchema,
  updateClinicSchema,
  clinicIdParamSchema,
} from "./clinic.schema";
import { paginationQuerySchema } from "../../utils/pagination";

export async function clinicPublicRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new ClinicService(app.prisma);

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
    { schema: { params: clinicIdParamSchema } },
    async (request, reply) => {
      const clinic = await service.findById(request.params.id);
      return reply.send({ success: true, data: clinic });
    },
  );
}

export async function clinicAdminRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new ClinicService(app.prisma);

  router.post(
    "/",
    { schema: { body: createClinicSchema } },
    async (request, reply) => {
      const clinic = await service.create(request.body);
      return reply.status(201).send({ success: true, data: clinic });
    },
  );

  router.put(
    "/:id",
    { schema: { params: clinicIdParamSchema, body: updateClinicSchema } },
    async (request, reply) => {
      const clinic = await service.update(request.params.id, request.body);
      return reply.send({ success: true, data: clinic });
    },
  );

  router.delete(
    "/:id",
    { schema: { params: clinicIdParamSchema } },
    async (request, reply) => {
      await service.delete(request.params.id);
      return reply.status(204).send();
    },
  );
}
