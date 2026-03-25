import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { logger } from "../utils/logger";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(
  async (fastify: FastifyInstance) => {
    const prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? [
              { emit: "event", level: "query" },
              { emit: "stdout", level: "info" },
              { emit: "stdout", level: "warn" },
              { emit: "stdout", level: "error" },
            ]
          : [{ emit: "stdout", level: "error" }],
    });

    await prisma.$connect();
    logger.info("Prisma connected to database");

    fastify.decorate("prisma", prisma);

    fastify.addHook("onClose", async () => {
      await prisma.$disconnect();
      logger.info("Prisma disconnected from database");
    });
  },
  { name: "prisma" },
);
