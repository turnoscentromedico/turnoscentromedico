import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { config } from "./utils/config";
import { errorHandler } from "./utils/errors";
import prismaPlugin from "./plugins/prisma";
import bullBoardPlugin from "./plugins/bull-board";
import { verifyAuth } from "./middlewares/auth.middleware";
import { requireAdmin, requireOperatorOrAdmin } from "./middlewares/role.middleware";
import {
  clinicPublicRoutes,
  clinicAdminRoutes,
} from "./modules/clinic/clinic.routes";
import {
  specialtyPublicRoutes,
  specialtyAdminRoutes,
} from "./modules/specialty/specialty.routes";
import {
  doctorPublicRoutes,
  doctorProtectedRoutes,
} from "./modules/doctor/doctor.routes";
import { patientRoutes } from "./modules/patient/patient.routes";
import {
  appointmentPublicRoutes,
  appointmentProtectedRoutes,
} from "./modules/appointment/appointment.routes";
import { userRoutes } from "./modules/user/user.routes";
import { scheduleRoutes } from "./modules/schedule/schedule.routes";
import { unavailabilityRoutes } from "./modules/unavailability/unavailability.routes";
import {
  settingsPublicRoutes,
  settingsAdminRoutes,
} from "./modules/settings/settings.routes";
import { appointmentActionRoutes } from "./modules/appointment/appointment-action.routes";
import { notificationRoutes } from "./modules/notification/notification.routes";
import { userPreferenceRoutes } from "./modules/user-preference/user-preference.routes";

export async function buildApp() {
  const app = Fastify({
    logger: false,
    ajv: {
      customOptions: {
        removeAdditional: "all",
        coerceTypes: true,
        useDefaults: true,
      },
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler(errorHandler);

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(sensible);
  await app.register(prismaPlugin);
  await app.register(bullBoardPlugin);

  // ── Health check ──────────────────────────────────────────
  app.get("/health", async () => {
    let dbOk = false;
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch { /* db unreachable */ }

    return {
      status: dbOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      services: {
        database: dbOk ? "connected" : "unreachable",
        redis: "configured",
        clerk: config.CLERK_SECRET_KEY ? "configured" : "dev-mode",
        resend: config.RESEND_API_KEY ? "configured" : "disabled",
        whatsapp: config.WHATSAPP_ACCESS_TOKEN ? "configured" : "disabled",
      },
    };
  });

  // ── Setup status (public — frontend checks before login) ─
  app.get("/api/auth/setup-status", async () => {
    const adminCount = await app.prisma.user.count({ where: { role: "ADMIN", active: true } });
    const userCount = await app.prisma.user.count();
    return {
      success: true,
      data: {
        hasAdmin: adminCount > 0,
        needsSetup: userCount === 0,
        userCount,
      },
    };
  });

  // ── Public routes (no auth) ───────────────────────────────
  await app.register(clinicPublicRoutes, { prefix: "/api/clinics" });
  await app.register(specialtyPublicRoutes, { prefix: "/api/specialties" });
  await app.register(doctorPublicRoutes, { prefix: "/api/doctors" });
  await app.register(appointmentPublicRoutes, { prefix: "/api/appointments" });
  await app.register(appointmentActionRoutes, { prefix: "/api/appointments" });
  await app.register(settingsPublicRoutes, { prefix: "/api/settings" });

  // ── Authenticated routes ──────────────────────────────────
  await app.register(async function authScope(scope) {
    scope.addHook("preHandler", verifyAuth);

    // ── User preferences (any authenticated user) ───────
    await scope.register(userPreferenceRoutes, { prefix: "/api/user-preferences" });

    // GET /api/me — current authenticated user + role + assigned clinics
    scope.get("/api/me", async (request, reply) => {
      return reply.send({
        success: true,
        data: {
          userId: request.userId,
          systemUserId: request.systemUserId,
          role: request.userRole,
          clinicIds: request.userClinicIds ?? [],
        },
      });
    });

    // ── Operator + Admin routes ───────────────────────────
    await scope.register(async function operatorScope(opScope) {
      opScope.addHook("preHandler", requireOperatorOrAdmin);

      await opScope.register(patientRoutes, { prefix: "/api/patients" });
      await opScope.register(appointmentProtectedRoutes, {
        prefix: "/api/appointments",
      });
      await opScope.register(specialtyAdminRoutes, { prefix: "/api/specialties" });
      await opScope.register(doctorProtectedRoutes, { prefix: "/api/doctors" });
      await opScope.register(scheduleRoutes, { prefix: "/api/schedules" });
      await opScope.register(unavailabilityRoutes, { prefix: "/api/unavailabilities" });
      await opScope.register(notificationRoutes, { prefix: "/api/notifications" });

      // GET /api/dashboard/stats
      opScope.get("/api/dashboard/stats", async () => {
        const [clinics, doctors, patients, specialties, users, appointments] =
          await Promise.all([
            app.prisma.clinic.count(),
            app.prisma.doctor.count(),
            app.prisma.patient.count(),
            app.prisma.specialty.count(),
            app.prisma.user.count({ where: { active: true } }),
            app.prisma.appointment.groupBy({
              by: ["status"],
              _count: true,
            }),
          ]);

        const appointmentsByStatus = Object.fromEntries(
          appointments.map((a) => [a.status, a._count]),
        );

        return {
          success: true,
          data: {
            clinics,
            doctors,
            patients,
            specialties,
            users,
            appointments: {
              total: appointments.reduce((sum, a) => sum + a._count, 0),
              byStatus: appointmentsByStatus,
            },
          },
        };
      });
    });

    // ── Admin-only routes ─────────────────────────────────
    await scope.register(async function adminScope(adScope) {
      adScope.addHook("preHandler", requireAdmin);

      await adScope.register(clinicAdminRoutes, { prefix: "/api/clinics" });
      await adScope.register(userRoutes, { prefix: "/api/users" });
      await adScope.register(settingsAdminRoutes, { prefix: "/api/settings" });
    });
  });

  return app;
}
