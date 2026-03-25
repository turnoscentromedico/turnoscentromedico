import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { logger } from "./logger";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const msg = id != null ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(404, msg, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, "CONFLICT");
  }
}

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code ?? "APP_ERROR",
      message: error.message,
      statusCode: error.statusCode,
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      issues: error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  if (error.validation) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: error.message,
      statusCode: 400,
    });
  }

  logger.error({ err: error }, "Unhandled error");

  return reply.status(500).send({
    error: "INTERNAL_SERVER_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
    statusCode: 500,
  });
}
