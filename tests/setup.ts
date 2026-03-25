import { afterAll } from "vitest";
import { prisma } from "./helpers";

afterAll(async () => {
  await prisma.$disconnect();
});
