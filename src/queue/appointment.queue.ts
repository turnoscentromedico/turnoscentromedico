import { Queue } from "bullmq";
import { subHours } from "date-fns";
import { redisOptions } from "./index";
import { logger } from "../utils/logger";

export const APPOINTMENT_QUEUE_NAME = "appointment-notifications";

export const appointmentQueue = new Queue(APPOINTMENT_QUEUE_NAME, {
  connection: redisOptions,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});

export interface AppointmentJobData {
  appointmentId: number;
  patientName: string;
  patientEmail?: string;
  patientPhone: string | null;
  doctorName: string;
  specialtyName: string;
  clinicName: string;
  date: string;
  startTime: string;
  confirmToken?: string;
  cancelToken?: string;
}

export async function enqueueAppointmentJobs(data: AppointmentJobData) {
  const appointmentDate = new Date(`${data.date}T${data.startTime}:00`);

  await appointmentQueue.add("confirmation", data, {
    jobId: `confirmation-${data.appointmentId}`,
  });

  const now = Date.now();

  const reminder24hTime = subHours(appointmentDate, 24).getTime();
  if (reminder24hTime > now) {
    await appointmentQueue.add("reminder-24h", data, {
      jobId: `reminder-24h-${data.appointmentId}`,
      delay: reminder24hTime - now,
    });
  } else {
    logger.debug({ appointmentId: data.appointmentId }, "Skipping 24h reminder — appointment is less than 24h away");
  }

  const reminder2hTime = subHours(appointmentDate, 2).getTime();
  if (reminder2hTime > now) {
    await appointmentQueue.add("reminder-2h", data, {
      jobId: `reminder-2h-${data.appointmentId}`,
      delay: reminder2hTime - now,
    });
  } else {
    logger.debug({ appointmentId: data.appointmentId }, "Skipping 2h reminder — appointment is less than 2h away");
  }

  logger.info(
    { appointmentId: data.appointmentId },
    "Appointment notification jobs enqueued",
  );
}

export async function enqueueConfirmedNotification(data: AppointmentJobData) {
  await appointmentQueue.add("confirmed", data, {
    jobId: `confirmed-${data.appointmentId}`,
  });

  logger.info(
    { appointmentId: data.appointmentId },
    "Appointment confirmed notification job enqueued",
  );
}

export async function enqueueResendConfirmation(data: AppointmentJobData) {
  await appointmentQueue.add("confirmation", data, {
    jobId: `resend-confirmation-${data.appointmentId}-${Date.now()}`,
  });

  logger.info(
    { appointmentId: data.appointmentId },
    "Resend confirmation notification job enqueued",
  );
}

export async function enqueueCancelledNotification(data: AppointmentJobData) {
  await appointmentQueue.add("cancelled", data, {
    jobId: `cancelled-${data.appointmentId}-${Date.now()}`,
  });

  logger.info(
    { appointmentId: data.appointmentId },
    "Appointment cancelled notification job enqueued",
  );
}

export async function removeAppointmentJobs(appointmentId: number) {
  const jobIds = [
    `reminder-24h-${appointmentId}`,
    `reminder-2h-${appointmentId}`,
  ];
  for (const jobId of jobIds) {
    const job = await appointmentQueue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info({ jobId }, "Removed scheduled reminder job");
    }
  }
}
