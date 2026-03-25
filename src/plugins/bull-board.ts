import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { appointmentQueue } from "../queue/appointment.queue";
import { verifyAuth } from "../middlewares/auth.middleware";

export default fp(
  async (fastify: FastifyInstance) => {
    const serverAdapter = new FastifyAdapter();
    serverAdapter.setBasePath("/admin/queues");

    createBullBoard({
      queues: [new BullMQAdapter(appointmentQueue)],
      serverAdapter,
    });

    await fastify.register(
      async function bullBoardScope(scope) {
        scope.addHook("preHandler", verifyAuth);

        await scope.register(serverAdapter.registerPlugin() as any, {
          basePath: "/",
          prefix: "/admin/queues",
        });
      },
    );
  },
  { name: "bull-board" },
);
