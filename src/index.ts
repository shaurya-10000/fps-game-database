import "dotenv/config";
import { startServer } from "./server";
import { runWorker } from "./worker";
import { logger } from "./infrastructure/logging/logger";

// Start the HTTP server
startServer();

// Start the background worker
if (process.env["RUN_WORKER"] === "true") {
  runWorker().catch(err => {
    logger.error("Worker failed", { error: String(err) });
    process.exit(1);
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down...");
  process.exit(0);
});