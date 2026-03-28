import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (request.userRole !== "ADMIN") {
    return reply.status(403).send({
      success: false,
      error: "FORBIDDEN",
      message: "Admin access required",
      statusCode: 403,
    });
  }
}

export async function requireOperatorOrAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (request.userRole !== "ADMIN" && request.userRole !== "OPERATOR") {
    return reply.status(403).send({
      success: false,
      error: "FORBIDDEN",
      message: "Operator or Admin access required",
      statusCode: 403,
    });
  }
}

export async function requireStaff(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const allowed: string[] = ["ADMIN", "OPERATOR", "DOCTOR"];
  if (!request.userRole || !allowed.includes(request.userRole)) {
    return reply.status(403).send({
      success: false,
      error: "FORBIDDEN",
      message: "Staff access required",
      statusCode: 403,
    });
  }
}
