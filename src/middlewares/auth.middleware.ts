import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@prisma/client";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { config } from "../utils/config";
import { logger } from "../utils/logger";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userRole?: UserRole;
    systemUserId?: number;
    userClinicIds?: number[];
  }
}

async function autoProvisionUser(
  prisma: FastifyRequest["server"]["prisma"],
  clerkUserId: string,
) {
  const userCount = await prisma.user.count();
  const isFirstUser = userCount === 0;

  let name = isFirstUser ? "Administrador" : "Usuario";
  let email = isFirstUser ? "admin@system.local" : `user-${clerkUserId.substring(0, 8)}@system.local`;

  if (config.CLERK_SECRET_KEY) {
    try {
      const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY });
      const clerkUser = await clerk.users.getUser(clerkUserId);
      name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || name;
      email = clerkUser.emailAddresses[0]?.emailAddress || email;
    } catch {
      logger.warn("Could not fetch Clerk user details for auto-provisioning");
    }
  }

  const user = await prisma.user.create({
    data: {
      clerkUserId,
      name,
      email,
      role: isFirstUser ? "ADMIN" : "STANDARD",
    },
    include: { clinics: { select: { id: true } } },
  });

  logger.info(
    { userId: user.id, email: user.email, role: user.role },
    isFirstUser ? "First user auto-provisioned as ADMIN" : "New user auto-provisioned as STANDARD",
  );
  return user;
}

function setUserOnRequest(
  request: FastifyRequest,
  user: { id: number; role: UserRole; clinics?: { id: number }[] },
) {
  request.userRole = user.role;
  request.systemUserId = user.id;
  request.userClinicIds = user.clinics?.map((c) => c.id) ?? [];
}

export async function verifyAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.status(401).send({
      success: false,
      error: "UNAUTHORIZED",
      message: "Missing or invalid Authorization header",
      statusCode: 401,
    });
  }

  const token = authHeader.slice(7);
  const { prisma } = request.server;

  if (!config.CLERK_SECRET_KEY) {
    logger.warn("CLERK_SECRET_KEY not set — running in dev auth mode");
    request.userId = `dev-${token.substring(0, 8)}`;

    const devUser = await prisma.user.findUnique({
      where: { clerkUserId: request.userId },
      include: { clinics: { select: { id: true } } },
    }).catch(() => null);

    if (devUser) {
      setUserOnRequest(request, devUser);
    }
    return;
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: config.CLERK_SECRET_KEY,
    });
    request.userId = payload.sub;

    let user = await prisma.user.findUnique({
      where: { clerkUserId: payload.sub },
      include: { clinics: { select: { id: true } } },
    });

    if (!user) {
      user = await autoProvisionUser(prisma, payload.sub);
    }

    if (!user?.active) {
      return reply.status(403).send({
        success: false,
        error: "FORBIDDEN",
        message: "Your account has been deactivated. Contact an administrator.",
        statusCode: 403,
      });
    }

    setUserOnRequest(request, user);
  } catch (err) {
    logger.debug({ err }, "Clerk token verification failed");
    return reply.status(401).send({
      success: false,
      error: "UNAUTHORIZED",
      message: "Invalid or expired token",
      statusCode: 401,
    });
  }
}
