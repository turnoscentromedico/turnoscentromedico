import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { DoctorService } from "./doctor.service";
import {
  createDoctorSchema,
  updateDoctorSchema,
  doctorIdParamSchema,
  doctorQuerySchema,
} from "./doctor.schema";

export async function doctorPublicRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new DoctorService(app.prisma);

  router.get(
    "/",
    {
      schema: {
        querystring: doctorQuerySchema,
      },
    },
    async (request, reply) => {
      const result = await service.findAll(request.query);
      return reply.send({ success: true, ...result });
    },
  );

  router.get(
    "/:id",
    {
      schema: {
        params: doctorIdParamSchema,
      },
    },
    async (request, reply) => {
      const doctor = await service.findById(request.params.id);
      return reply.send({ success: true, data: doctor });
    },
  );
}

export async function doctorProtectedRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new DoctorService(app.prisma);

  router.post(
    "/",
    {
      schema: {
        body: createDoctorSchema,
      },
    },
    async (request, reply) => {
      const doctor = await service.create(request.body);
      return reply.status(201).send({ success: true, data: doctor });
    },
  );

  router.put(
    "/:id",
    {
      schema: {
        params: doctorIdParamSchema,
        body: updateDoctorSchema,
      },
    },
    async (request, reply) => {
      const doctor = await service.update(request.params.id, request.body);
      return reply.send({ success: true, data: doctor });
    },
  );

  router.delete(
    "/:id",
    {
      schema: {
        params: doctorIdParamSchema,
      },
    },
    async (request, reply) => {
      await service.delete(request.params.id);
      return reply.status(204).send();
    },
  );
}
