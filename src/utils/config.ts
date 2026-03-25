import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default("turnos@tuclinica.com"),

  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_RECIPIENT_PHONE: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "Invalid environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    process.exit(1);
  }

  return parsed.data;
}

export const config = loadConfig();
