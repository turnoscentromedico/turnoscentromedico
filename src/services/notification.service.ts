import { Resend } from "resend";
import { config } from "../utils/config";
import { logger } from "../utils/logger";

type NotificationType =
  | "confirmation"
  | "confirmed"
  | "cancelled"
  | "reminder-24h"
  | "reminder-2h";

export interface NotificationPayload {
  type: NotificationType;
  appointmentId: number;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string | null;
  doctorName: string;
  specialtyName: string;
  clinicName: string;
  date: string;
  startTime: string;
  confirmToken?: string;
  cancelToken?: string;
}

const SUBJECTS: Record<NotificationType, (p: NotificationPayload) => string> = {
  confirmation: (p) =>
    `Solicitud de turno – ${p.specialtyName} con ${p.doctorName}`,
  confirmed: (p) =>
    `Turno confirmado – ${p.specialtyName} con ${p.doctorName}`,
  cancelled: (p) =>
    `Turno cancelado – ${p.specialtyName} con ${p.doctorName}`,
  "reminder-24h": (p) =>
    `Recordatorio: turno mañana – ${p.specialtyName}`,
  "reminder-2h": (p) =>
    `Tu turno es en 2 horas – ${p.specialtyName}`,
};

const WHATSAPP_MESSAGES: Record<NotificationType, (p: NotificationPayload) => string> = {
  confirmation: (p) =>
    `📋 *Solicitud de turno registrada*\n\nHola ${p.patientName}, tu solicitud de turno fue registrada:\n\n` +
    `👨‍⚕️ *Médico:* ${p.doctorName}\n` +
    `🏥 *Especialidad:* ${p.specialtyName}\n` +
    `🏢 *Clínica:* ${p.clinicName}\n` +
    `📅 *Fecha:* ${p.date}\n` +
    `🕐 *Hora:* ${p.startTime}\n\n` +
    `El turno se encuentra *pendiente de confirmación*. Te avisaremos cuando sea confirmado.`,
  confirmed: (p) =>
    `✅ *Turno confirmado*\n\nHola ${p.patientName}, tu turno fue confirmado:\n\n` +
    `👨‍⚕️ *Médico:* ${p.doctorName}\n` +
    `🏥 *Especialidad:* ${p.specialtyName}\n` +
    `🏢 *Clínica:* ${p.clinicName}\n` +
    `📅 *Fecha:* ${p.date}\n` +
    `🕐 *Hora:* ${p.startTime}`,
  cancelled: (p) =>
    `❌ *Turno cancelado*\n\nHola ${p.patientName}, lamentamos informarte que tu turno fue cancelado:\n\n` +
    `👨‍⚕️ *Médico:* ${p.doctorName}\n` +
    `🏥 *Especialidad:* ${p.specialtyName}\n` +
    `🏢 *Clínica:* ${p.clinicName}\n` +
    `📅 *Fecha:* ${p.date}\n` +
    `🕐 *Hora:* ${p.startTime}\n\n` +
    `Si necesitás reprogramar, contactá a la clínica.`,
  "reminder-24h": (p) =>
    `⏰ *Recordatorio de turno*\n\nHola ${p.patientName}, te recordamos que mañana tenés turno:\n\n` +
    `👨‍⚕️ *Médico:* ${p.doctorName}\n` +
    `🏥 *Especialidad:* ${p.specialtyName}\n` +
    `🏢 *Clínica:* ${p.clinicName}\n` +
    `📅 *Fecha:* ${p.date}\n` +
    `🕐 *Hora:* ${p.startTime}`,
  "reminder-2h": (p) =>
    `🔔 *¡Tu turno es pronto!*\n\nHola ${p.patientName}, tu turno es en 2 horas:\n\n` +
    `👨‍⚕️ *Médico:* ${p.doctorName}\n` +
    `🏥 *Especialidad:* ${p.specialtyName}\n` +
    `🏢 *Clínica:* ${p.clinicName}\n` +
    `🕐 *Hora:* ${p.startTime}\n\n` +
    `Te esperamos!`,
};

function buildActionUrl(token: string): string {
  const base = config.FRONTEND_URL || "http://localhost:3000";
  return `${base}/appointment-action?token=${token}`;
}

function buildActionButtons(payload: NotificationPayload): string {
  const buttons: string[] = [];
  const { type, confirmToken, cancelToken } = payload;

  const showConfirm = type !== "confirmed" && confirmToken;
  const showCancel = cancelToken;

  if (showConfirm) {
    buttons.push(
      `<a href="${buildActionUrl(confirmToken)}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin-right:8px">✓ Confirmar turno</a>`,
    );
  }
  if (showCancel) {
    buttons.push(
      `<a href="${buildActionUrl(cancelToken)}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">✕ Cancelar turno</a>`,
    );
  }

  if (buttons.length === 0) return "";
  return `<div style="text-align:center;margin:24px 0 8px">${buttons.join("")}</div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:4px 0 0">Estos enlaces son de uso único y expiran en 72 horas.</p>`;
}

function buildEmailHtml(payload: NotificationPayload): string {
  const { type } = payload;

  const headerColor =
    type === "confirmed" ? "#16a34a" : type === "cancelled" ? "#dc2626" : "#0066ff";

  const title =
    type === "confirmation"
      ? "Solicitud de turno registrada"
      : type === "confirmed"
        ? "Turno confirmado"
        : type === "cancelled"
          ? "Turno cancelado"
          : type === "reminder-24h"
            ? "Recordatorio de turno"
            : "¡Tu turno es pronto!";

  const intro =
    type === "confirmation"
      ? `Hola ${payload.patientName}, tu solicitud de turno fue registrada exitosamente. El turno se encuentra <strong>pendiente de confirmación</strong>.`
      : type === "confirmed"
        ? `Hola ${payload.patientName}, tu turno fue <strong>confirmado</strong>.`
        : type === "cancelled"
          ? `Hola ${payload.patientName}, lamentamos informarte que tu turno fue <strong>cancelado</strong>. Si necesitás reprogramar, contactá a la clínica.`
          : type === "reminder-24h"
            ? `Hola ${payload.patientName}, te recordamos que mañana tenés turno.`
            : `Hola ${payload.patientName}, tu turno es en 2 horas.`;

  const statusBadge =
    type === "confirmation"
      ? `<div style="display:inline-block;background:#fef3c7;color:#92400e;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;margin:12px 0">⏳ Pendiente de confirmación</div>`
      : type === "confirmed"
        ? `<div style="display:inline-block;background:#dcfce7;color:#166534;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;margin:12px 0">✅ Confirmado</div>`
        : type === "cancelled"
          ? `<div style="display:inline-block;background:#fee2e2;color:#991b1b;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;margin:12px 0">❌ Cancelado</div>`
          : "";

  const actionButtons = buildActionButtons(payload);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <div style="background:${headerColor};color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:22px">${title}</h1>
  </div>
  <div style="border:1px solid #e5e5e5;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <p style="margin-top:0">${intro}</p>
    ${statusBadge}
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;color:#666;width:120px">Médico</td><td style="padding:8px 0;font-weight:600">${payload.doctorName}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Especialidad</td><td style="padding:8px 0;font-weight:600">${payload.specialtyName}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Clínica</td><td style="padding:8px 0;font-weight:600">${payload.clinicName}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Fecha</td><td style="padding:8px 0;font-weight:600">${payload.date}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Hora</td><td style="padding:8px 0;font-weight:600">${payload.startTime} hs</td></tr>
    </table>
    ${actionButtons}
    <p style="color:#666;font-size:13px;margin-bottom:0">Si necesitás cancelar o reprogramar, contactanos con anticipación.</p>
  </div>
</body>
</html>`.trim();
}

export class NotificationService {
  private resend: Resend | null;

  constructor() {
    this.resend = config.RESEND_API_KEY
      ? new Resend(config.RESEND_API_KEY)
      : null;
  }

  async sendEmail(payload: NotificationPayload): Promise<boolean> {
    if (!this.resend) {
      logger.warn(
        { appointmentId: payload.appointmentId },
        "RESEND_API_KEY not configured — skipping email",
      );
      return false;
    }

    if (!payload.patientEmail) {
      logger.info({ appointmentId: payload.appointmentId }, "No patient email — skipping");
      return false;
    }

    try {
      const fromName = `Turno ${payload.clinicName}`;
      const { error } = await this.resend.emails.send({
        from: `${fromName} <${config.RESEND_FROM_EMAIL}>`,
        to: payload.patientEmail,
        subject: SUBJECTS[payload.type](payload),
        html: buildEmailHtml(payload),
      });

      if (error) {
        logger.error(
          { err: error, appointmentId: payload.appointmentId, to: payload.patientEmail },
          `Resend API error — ${error.message}`,
        );
        return false;
      }

      logger.info(
        { appointmentId: payload.appointmentId, type: payload.type, to: payload.patientEmail },
        `Email "${payload.type}" sent to ${payload.patientEmail}`,
      );
      return true;
    } catch (err) {
      logger.error(
        { err, appointmentId: payload.appointmentId },
        "Failed to send email",
      );
      return false;
    }
  }

  private get whatsappUrl() {
    return `https://graph.facebook.com/v22.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  }

  private get whatsappHeaders() {
    return {
      Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    };
  }

  private async whatsAppRequest(body: Record<string, unknown>): Promise<Response> {
    return fetch(this.whatsappUrl, {
      method: "POST",
      headers: this.whatsappHeaders,
      body: JSON.stringify(body),
    });
  }

  private async sendWhatsAppCta(
    phone: string,
    bodyText: string,
    buttonLabel: string,
    url: string,
  ): Promise<Response> {
    return this.whatsAppRequest({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: { text: bodyText },
        action: {
          name: "cta_url",
          parameters: { display_text: buttonLabel, url },
        },
      },
    });
  }

  private async sendWhatsAppText(phone: string, text: string): Promise<Response> {
    return this.whatsAppRequest({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { preview_url: false, body: text },
    });
  }

  async sendWhatsApp(payload: NotificationPayload): Promise<boolean> {
    if (!config.WHATSAPP_ACCESS_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID) {
      logger.warn(
        { appointmentId: payload.appointmentId },
        "WhatsApp not configured — skipping",
      );
      return false;
    }

    const rawPhone = payload.patientPhone;
    if (!rawPhone) {
      logger.debug(
        { appointmentId: payload.appointmentId },
        "Patient has no phone — skipping WhatsApp",
      );
      return false;
    }

    const phone = rawPhone.replace(/\D/g, "");
    const messageText = WHATSAPP_MESSAGES[payload.type](payload);
    const { type, confirmToken, cancelToken } = payload;

    const showConfirmBtn = type !== "confirmed" && type !== "cancelled" && !!confirmToken;
    const showCancelBtn = type !== "cancelled" && !!cancelToken;

    try {
      if (showConfirmBtn) {
        const res = await this.sendWhatsAppCta(
          phone,
          messageText,
          "Confirmar turno",
          buildActionUrl(confirmToken!),
        );
        if (!res.ok) {
          const body = await res.text();
          logger.warn({ appointmentId: payload.appointmentId, status: res.status, body }, "WhatsApp CTA confirm failed — falling back to text");
          const fallback = await this.sendWhatsAppText(phone, messageText);
          if (!fallback.ok) {
            logger.error({ appointmentId: payload.appointmentId, body: await fallback.text() }, "WhatsApp text fallback also failed");
            return false;
          }
        } else {
          logger.info({ appointmentId: payload.appointmentId, type, to: phone }, "WhatsApp CTA confirm sent");
        }
      } else {
        const res = await this.sendWhatsAppText(phone, messageText);
        if (!res.ok) {
          const body = await res.text();
          logger.error({ appointmentId: payload.appointmentId, status: res.status, body }, "WhatsApp text message failed");
          return false;
        }
        logger.info({ appointmentId: payload.appointmentId, type, to: phone }, "WhatsApp text message sent");
      }

      if (showCancelBtn) {
        const res = await this.sendWhatsAppCta(
          phone,
          "Si necesitás cancelar el turno, tocá el botón:",
          "Cancelar turno",
          buildActionUrl(cancelToken!),
        );
        if (!res.ok) {
          const body = await res.text();
          logger.warn({ appointmentId: payload.appointmentId, status: res.status, body }, "WhatsApp CTA cancel failed");
        } else {
          logger.info({ appointmentId: payload.appointmentId, type, to: phone }, "WhatsApp CTA cancel sent");
        }
      }

      return true;
    } catch (err) {
      logger.error(
        { err, appointmentId: payload.appointmentId },
        "Failed to send WhatsApp message",
      );
      return false;
    }
  }

  async notify(
    payload: NotificationPayload,
    channels: { email?: boolean; whatsapp?: boolean } = { email: true, whatsapp: true },
  ): Promise<void> {
    const tasks: Promise<boolean>[] = [];
    if (channels.email !== false) tasks.push(this.sendEmail(payload));
    if (channels.whatsapp !== false) tasks.push(this.sendWhatsApp(payload));
    await Promise.allSettled(tasks);
  }
}
