import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UserService } from "./user.service";
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from "./user.schema";
import { paginationQuerySchema } from "../../utils/pagination";

export async function userRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const service = new UserService(app.prisma);

  router.post(
    "/",
    { schema: { body: createUserSchema } },
    async (request, reply) => {
      const user = await service.create(request.body);
      return reply.status(201).send({ success: true, data: user });
    },
  );

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
    { schema: { params: userIdParamSchema } },
    async (request, reply) => {
      const user = await service.findById(request.params.id);
      return reply.send({ success: true, data: user });
    },
  );

  router.put(
    "/:id",
    { schema: { params: userIdParamSchema, body: updateUserSchema } },
    async (request, reply) => {
      const user = await service.update(request.params.id, request.body);
      return reply.send({ success: true, data: user });
    },
  );

  router.delete(
    "/:id",
    { schema: { params: userIdParamSchema } },
    async (request, reply) => {
      await service.delete(request.params.id);
      return reply.status(204).send();
    },
  );
}
