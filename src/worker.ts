import "dotenv/config";
import { loadEnv } from "./config/env";
import { getMongoClient } from "./infrastructure/mongodb/client";
import { logger } from "./infrastructure/logging/logger";
import { OutboxRelay } from "./infrastructure/outbox/relay";
import { RatingProcessor, RatingEvent } from "./domain/matches/rating-processor";
import { ProgressionService } from "./domain/progression/progression-service";
import { MasteryService } from "./domain/leaderboards/mastery-service";
import { MatchResultPayload } from "./domain/matches/canonical-service";
import { XpEngine } from "./domain/progression/xp-engine";

const env = loadEnv();
const client = getMongoClient(env);
const db = client.db("fps-game-database");

const workerId = `worker-${process.pid}`;
const relay = new OutboxRelay(db, workerId);
const ratingProcessor = new RatingProcessor(db);
const progressionService = new ProgressionService(db);
const masteryService = new MasteryService(db);

interface Delivery {
  _id: string;
  consumer: string;
  eventId: string;
}

interface OutboxEvent {
  _id: string;
  payload: MatchResultPayload;
}

async function processDelivery(delivery: Delivery): Promise<void> {
  switch (delivery.consumer) {
    case "rating": {
      const event = await db
        .collection<{ _id: string } & RatingEvent>("ratingEvents")
        .findOne({ _id: delivery.eventId });

      if (!event) {
        logger.warn("Rating event missing from ledger; completing delivery as no-op", {
          deliveryId: delivery._id,
          eventId: delivery.eventId,
        });
        return;
      }
      await ratingProcessor.processEvent(delivery._id, event, workerId);
      return;
    }
    case "progression": {
      const event = await db
        .collection<OutboxEvent>("outboxEvents")
        .findOne({ _id: delivery.eventId });

      if (!event) {
        logger.warn("Outbox event missing for progression", { eventId: delivery.eventId });
        return;
      }

      const payload = event["payload"];
      
      for (const participant of payload.participants) {
        // 1. Award overall player XP (Levels up the player)
        await progressionService.awardMatchXp(participant, payload.gameModeId);

        // 2. Award Weapon/Character Mastery XP
        // In the future, the payload will include actual weaponId and characterId.
        // For now, we award XP to "default_weapon" and "default_character"
        // to prove the mastery leaderboard pipeline works.
        const baseXp = XpEngine.calculateMatchXp(participant, payload.gameModeId);
        const masteryXpGained = Math.floor(baseXp * 0.1); // 10% of total XP goes to mastery

        if (masteryXpGained > 0) {
          await masteryService.awardMasteryXp(participant.playerId, "weapon", "default_weapon", masteryXpGained);
          await masteryService.awardMasteryXp(participant.playerId, "character", "default_character", masteryXpGained);
        }
      }
      return;
    }
    case "statistics":
      logger.info("Delivery acknowledged by no-op consumer", { deliveryId: delivery._id, consumer: delivery.consumer });
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
