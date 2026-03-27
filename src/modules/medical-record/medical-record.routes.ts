import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { MedicalRecordService } from "./medical-record.service";
import {
  createMedicalRecordSchema,
  updateMedicalRecordSchema,
  medicalRecordQuerySchema,
} from "./medical-record.schema";

const patientIdParam = z.object({ patientId: z.coerce.number().int().positive() });
const idParam = z.object({ id: z.coerce.number().int().positive() });

export async function medicalRecordRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new MedicalRecordService(app.prisma);

  router.get(
    "/patients/:patientId/medical-records",
    { schema: { params: patientIdParam, querystring: medicalRecordQuerySchema } },
    async (request, reply) => {
      const result = await service.findAllByPatient(
        request.params.patientId,
        request.query,
      );
      return reply.send({ success: true, ...result });
    },
  );

  router.post(
    "/patients/:patientId/medical-records",
    { schema: { params: patientIdParam, body: createMedicalRecordSchema } },
    async (request, reply) => {
      const record = await service.create(
        request.params.patientId,
        request.body,
        request.systemUserId ?? undefined,
      );
      return reply.status(201).send({ success: true, data: record });
    },
  );

  router.get(
    "/medical-records/:id",
    { schema: { params: idParam } },
    async (request, reply) => {
      const record = await service.findById(request.params.id);
      return reply.send({ success: true, data: record });
    },
  );

  router.put(
    "/medical-records/:id",
    { schema: { params: idParam, body: updateMedicalRecordSchema } },
    async (request, reply) => {
      const record = await service.update(request.params.id, request.body);
      return reply.send({ success: true, data: record });
    },
  );

  router.delete(
    "/medical-records/:id",
    { schema: { params: idParam } },
    async (request, reply) => {
      await service.delete(request.params.id);
      return reply.status(204).send();
    },
  );
}
