import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { PatientService } from "./patient.service";
import {
  createPatientSchema,
  updatePatientSchema,
  patientIdParamSchema,
} from "./patient.schema";
import { paginationQuerySchema } from "../../utils/pagination";

export async function patientReadRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new PatientService(app.prisma);

  router.get(
    "/",
    {
      schema: {
        querystring: paginationQuerySchema,
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
        params: patientIdParamSchema,
      },
    },
    async (request, reply) => {
      const patient = await service.findById(request.params.id);
      return reply.send({ success: true, data: patient });
    },
  );
}

export async function patientWriteRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new PatientService(app.prisma);

  router.post(
    "/",
    {
      schema: {
        body: createPatientSchema,
      },
    },
    async (request, reply) => {
      const patient = await service.create(request.body);
      return reply.status(201).send({ success: true, data: patient });
    },
  );

  router.put(
    "/:id",
    {
      schema: {
        params: patientIdParamSchema,
        body: updatePatientSchema,
      },
    },
    async (request, reply) => {
      const patient = await service.update(request.params.id, request.body);
      return reply.send({ success: true, data: patient });
    },
  );

  router.delete(
    "/:id",
    {
      schema: {
        params: patientIdParamSchema,
      },
    },
    async (request, reply) => {
      await service.delete(request.params.id);
      return reply.status(204).send();
    },
  );
}
