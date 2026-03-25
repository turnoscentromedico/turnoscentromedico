import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { AppointmentService } from "./appointment.service";
import {
  availableSlotsQuerySchema,
  availableBySpecialtyQuerySchema,
  availableRangeQuerySchema,
  bookAppointmentSchema,
  listAppointmentsQuerySchema,
  appointmentIdParamSchema,
} from "./appointment.schema";

export async function appointmentPublicRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new AppointmentService(app.prisma);

  router.get(
    "/available",
    {
      schema: {
        querystring: availableSlotsQuerySchema,
      },
    },
    async (request, reply) => {
      const slots = await service.getAvailableSlots(request.query);
      return reply.send({ success: true, data: slots });
    },
  );

  router.get(
    "/available-by-specialty",
    {
      schema: {
        querystring: availableBySpecialtyQuerySchema,
      },
    },
    async (request, reply) => {
      const slots = await service.getAvailableSlots(request.query);
      return reply.send({ success: true, data: slots });
    },
  );

  router.get(
    "/available-range",
    {
      schema: {
        querystring: availableRangeQuerySchema,
      },
    },
    async (request, reply) => {
      const slots = await service.getAvailableSlotsRange(request.query);
      return reply.send({ success: true, data: slots });
    },
  );
}

export async function appointmentProtectedRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new AppointmentService(app.prisma);

  router.post(
    "/",
    {
      schema: {
        body: bookAppointmentSchema,
      },
    },
    async (request, reply) => {
      const appointment = await service.bookAppointment(request.body);
      return reply.status(201).send({ success: true, data: appointment });
    },
  );

  router.get(
    "/",
    {
      schema: {
        querystring: listAppointmentsQuerySchema,
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
        params: appointmentIdParamSchema,
      },
    },
    async (request, reply) => {
      const appointment = await service.findById(request.params.id);
      return reply.send({ success: true, data: appointment });
    },
  );

  router.patch(
    "/:id/confirm",
    {
      schema: {
        params: appointmentIdParamSchema,
      },
    },
    async (request, reply) => {
      const appointment = await service.confirmAppointment(request.params.id);
      return reply.send({ success: true, data: appointment });
    },
  );

  router.patch(
    "/:id/cancel",
    {
      schema: {
        params: appointmentIdParamSchema,
      },
    },
    async (request, reply) => {
      const appointment = await service.cancelAppointment(request.params.id);
      return reply.send({ success: true, data: appointment });
    },
  );

  router.patch(
    "/:id/resend-confirmation",
    {
      schema: {
        params: appointmentIdParamSchema,
      },
    },
    async (request, reply) => {
      const appointment = await service.resendConfirmation(request.params.id);
      return reply.send({ success: true, data: appointment });
    },
  );
}
