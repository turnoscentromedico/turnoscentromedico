import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { AppointmentStatus, type PrismaClient } from "@prisma/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ActionTokenService } from "../../services/action-token.service";
import { InternalNotificationService } from "../../services/internal-notification.service";
import { logger } from "../../utils/logger";

function resultPage(title: string, message: string, success: boolean): string {
  const color = success ? "#16a34a" : "#dc2626";
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#1a1a1a}
  .card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:40px;max-width:480px;text-align:center}
  .icon{width:64px;height:64px;border-radius:50%;background:${color}15;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
  .icon svg{width:32px;height:32px;color:${color}}
  h1{font-size:22px;margin:0 0 8px;color:${color}}
  p{color:#64748b;line-height:1.6;margin:0}
</style></head>
<body><div class="card">
  <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${success ? '<path d="M20 6L9 17l-5-5"/>' : '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>'}
  </svg></div>
  <h1>${title}</h1>
  <p>${message}</p>
</div></body></html>`;
}

export async function appointmentActionRoutes(app: FastifyInstance) {
  const router = app.withTypeProvider<ZodTypeProvider>();
  const tokenService = new ActionTokenService(app.prisma);
  const notifService = new InternalNotificationService(app.prisma);

  router.get(
    "/action",
    { schema: { querystring: z.object({ token: z.string().min(1) }) } },
    async (request, reply) => {
      const { token } = request.query;
      const result = await tokenService.validateAndConsume(token);

      if (!result.valid) {
        return reply
          .type("text/html")
          .send(resultPage("Enlace no válido", result.error, false));
      }

      const { action, appointment } = result;
      const prisma: PrismaClient = app.prisma;

      if (action === "confirm") {
        if (appointment.status === AppointmentStatus.CONFIRMED) {
          return reply
            .type("text/html")
            .send(resultPage("Turno ya confirmado", "Este turno ya fue confirmado anteriormente.", true));
        }
        if (appointment.status === AppointmentStatus.CANCELLED) {
          return reply
            .type("text/html")
            .send(resultPage("No se puede confirmar", "Este turno fue cancelado y no se puede confirmar.", false));
        }

        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: AppointmentStatus.CONFIRMED },
        });

        const dateStr = format(appointment.date, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
        return reply
          .type("text/html")
          .send(resultPage(
            "Turno confirmado",
            `Tu turno del ${dateStr} a las ${appointment.startTime ?? ""} hs con Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} en ${appointment.clinic.name} fue confirmado exitosamente.`,
            true,
          ));
      }

      if (action === "cancel") {
        if (appointment.status === AppointmentStatus.CANCELLED) {
          return reply
            .type("text/html")
            .send(resultPage("Turno ya cancelado", "Este turno ya fue cancelado anteriormente.", false));
        }

        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: AppointmentStatus.CANCELLED },
        });

        const dateStr = format(appointment.date, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
        const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
        const doctorName = `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`;
        const timeStr = appointment.startTime ?? format(appointment.date, "HH:mm");

        try {
          await notifService.create({
            type: "appointment_cancelled_by_patient",
            title: "Turno cancelado por paciente",
            message: `${patientName} canceló su turno del ${dateStr} a las ${timeStr} hs con ${doctorName}.`,
            metadata: {
              appointmentId: appointment.id,
              patientId: appointment.patientId,
              patientName,
              doctorName,
              date: format(appointment.date, "yyyy-MM-dd"),
              startTime: timeStr,
            },
            clinicId: appointment.clinicId,
          });
        } catch (err) {
          logger.error({ err, appointmentId: appointment.id }, "Failed to create internal notification");
        }

        return reply
          .type("text/html")
          .send(resultPage(
            "Turno cancelado",
            `Tu turno del ${dateStr} a las ${timeStr} hs con ${doctorName} en ${appointment.clinic.name} fue cancelado. Si necesitás un nuevo turno, contactá a la clínica.`,
            true,
          ));
      }

      return reply
        .type("text/html")
        .send(resultPage("Acción no válida", "La acción solicitada no es válida.", false));
    },
  );
}
