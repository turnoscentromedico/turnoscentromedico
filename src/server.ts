import { config } from "./utils/config";
import { logger } from "./utils/logger";
import { buildApp } from "./app";
import { createAppointmentWorker } from "./queue/appointment.worker";
import { appointmentQueue } from "./queue/appointment.queue";

async function main() {
  const app = await buildApp();
  const worker = createAppointmentWorker();

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
    logger.info(`Server listening on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    logger.fatal(err, "Failed to start server");
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await worker.close();
    await appointmentQueue.close();
    await app.close();
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
