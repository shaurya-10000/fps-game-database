import "dotenv/config";
import { loadEnv } from "./config/env";
import { getMongoClient } from "./infrastructure/mongodb/client";
import { logger } from "./infrastructure/logging/logger";
import { OutboxRelay } from "./infrastructure/outbox/relay";
import { RatingProcessor, RatingEvent } from "./domain/matches/rating-processor";

const env = loadEnv();
const client = getMongoClient(env);
const db = client.db("fps-game-database");

const workerId = `worker-${process.pid}`;
const relay = new OutboxRelay(db, workerId);
const ratingProcessor = new RatingProcessor(db);

interface Delivery {
  _id: string;
  consumer: string;
  eventId: string;
}

async function processDelivery(delivery: Delivery): Promise<void> {
  switch (delivery.consumer) {
    case "rating": {
      // ratingEvents._id is a string ("evt_<uuid>"), not an ObjectId,
      // so the collection must be typed to tell the driver the _id shape.
      const event = await db
        .collection<{ _id: string } & RatingEvent>("ratingEvents")
        .findOne({ _id: delivery.eventId });

      if (!event) {
        // Event ledger already contains this event from a prior attempt.
        // The delivery just needs to complete — this is the recovery path.
        logger.warn("Rating event missing from ledger; completing delivery as no-op", {
          deliveryId: delivery._id,
          eventId: delivery.eventId,
        });
        return;
      }
      await ratingProcessor.processEvent(delivery._id, event, workerId);
      return;
    }
    case "progression":
    case "statistics":
      // Non-rating consumers are wired as no-op acknowledgements in this
      // milestone. Projections for these are rebuilt by
      // scripts/rebuild-projections.ts. When a live projection is added,
      // route here and stop completing blindly.
      logger.info("Delivery acknowledged by no-op consumer", {
        deliveryId: delivery._id,
        consumer: delivery.consumer,
      });
      return;
    default:
      throw new Error(`Unknown consumer: ${delivery.consumer}`);
  }
}

export async function runWorker(): Promise<void> {
  logger.info("Worker starting", { pid: process.pid, workerId });
  while (true) {
    try {
      const delivery = await relay.claimDelivery();
      if (!delivery) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      try {
        await processDelivery(delivery as unknown as Delivery);
        await relay.completeDelivery(delivery._id);
      } catch (err) {
        logger.error("Delivery processing failed", {
          deliveryId: delivery._id,
          error: String(err),
        });
        await relay.failDelivery(delivery._id, String(err));
      }
    } catch (err) {
      logger.error("Worker loop error", { error: String(err) });
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

if (require.main === module) {
  runWorker().catch((err) => {
    logger.error("Worker crashed", { error: String(err) });
    process.exit(1);
  });
}
