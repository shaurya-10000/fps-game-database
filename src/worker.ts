import "dotenv/config";
import { loadEnv } from "./config/env";
import { getMongoClient } from "./infrastructure/mongodb/client";
import { logger } from "./infrastructure/logging/logger";
import { OutboxRelay } from "./infrastructure/outbox/relay";

const env = loadEnv();
const client = getMongoClient(env);
const db = client.db("fps-game-database");
const relay = new OutboxRelay(db, "worker-1");

export async function runWorker() {
  logger.info("Starting outbox worker loop...");
  while (true) {
    try {
      const delivery = await relay.claimDelivery();
      if (delivery) {
        logger.info("Claimed delivery", { id: delivery._id });
        // In a real implementation, you would route to the correct processor (e.g., RatingProcessor)
        // based on delivery.consumer.
        await relay.completeDelivery(delivery._id);
      } else {
        // Backoff if no work is found
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      logger.error("Worker error", { error: String(err) });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

if (require.main === module) {
  runWorker().catch(err => {
    logger.error("Worker crashed", { error: String(err) });
    process.exit(1);
  });
}