import { Worker, type Job } from "bullmq";
import { redisOptions } from "./index";
import {
  APPOINTMENT_QUEUE_NAME,
  type AppointmentJobData,
} from "./appointment.queue";
import {
  NotificationService,
  type NotificationPayload,
} from "../services/notification.service";
import { SettingsService } from "../modules/settings/settings.service";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

const notifications = new NotificationService();
const settingsService = new SettingsService(prisma);

async function processJob(job: Job<AppointmentJobData>) {
  const type = job.name as NotificationPayload["type"];

  logger.info(
    { appointmentId: job.data.appointmentId, type },
    `Processing ${type} for ${job.data.patientName} – ${job.data.date} ${job.data.startTime}`,
  );

  const settings = await settingsService.getAll();
  const emailEnabled = settings["notifications.emailEnabled"] !== "false";
  const whatsappEnabled = settings["notifications.whatsappEnabled"] !== "false";

  await notifications.notify({ ...job.data, type }, { email: emailEnabled, whatsapp: whatsappEnabled });
}

export function createAppointmentWorker() {
  const worker = new Worker<AppointmentJobData>(
    APPOINTMENT_QUEUE_NAME,
    processJob,
    { connection: redisOptions },
  );

  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id, name: job.name }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, name: job?.name, err },
      "Job failed",
    );
  });

  logger.info("Appointment notification worker started");

  return worker;
}
