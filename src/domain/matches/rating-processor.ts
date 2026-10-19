import { Db, Document, ClientSession } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";
import { triggerFailurePoint } from "../../infrastructure/failure-injection";
import { RatingProjection } from "./rating-consumer";

export interface RatingEvent {
  _id: string;
  playerId: string;
  sequence: number;
  ratingDelta: number;
  matchId: string;
  createdAt: Date;
}

export class RatingProcessor {
  constructor(private db: Db) {}

  async processEvent(
    deliveryId: string,
    event: RatingEvent,
    workerId: string
  ): Promise<"applied" | "duplicate" | "deferred"> {
    const session = this.db.client.startSession();
    
    try {
      let result: "applied" | "duplicate" | "deferred" = "deferred";

      await session.withTransaction(async () => {
        const projectionsCol = this.db.collection<RatingProjection>("competitiveRatings");
        const eventsCol = this.db.collection<RatingEvent>("ratingEvents");
        // Fix: explicitly type the collection
        const deliveriesCol = this.db.collection<{ _id: string } & Document>("outboxDeliveries");

        const projection = await projectionsCol.findOne(
          { _id: event.playerId },
          { session }
        );

        const lastApplied = projection?.lastAppliedSequence || 0;

        if (event.sequence <= lastApplied) {
          result = "duplicate";
          return;
        }

        if (event.sequence > lastApplied + 1) {
          result = "deferred";
          return;
        }

        if (!projection) {
          await projectionsCol.insertOne(
            {
              _id: event.playerId,
              rating: 1000 + event.ratingDelta,
              lastAppliedSequence: event.sequence,
              updatedAt: new Date()
            },
            { session }
          );
        } else {
          await projectionsCol.updateOne(
            { _id: event.playerId },
            {
              $inc: { rating: event.ratingDelta },
              $set: { lastAppliedSequence: event.sequence, updatedAt: new Date() }
            },
            { session }
          );
        }

        await eventsCol.insertOne(event, { session });

        triggerFailurePoint("before-projection-commit");

        const completion = await deliveriesCol.updateOne(
          { _id: deliveryId, leaseOwner: workerId, status: "processing" },
          { 
            $set: { status: "completed", completedAt: new Date() },
            $unset: { leaseOwner: "", leaseUntil: "" }
          },
          { session }
        );

        if (completion.modifiedCount === 0) {
          throw new Error("LEASE_LOST");
        }

        result = "applied";
      });

      logger.info("Rating event processed atomically", {
        playerId: event.playerId,
        sequence: event.sequence,
        result
      });

      return result;
    } finally {
      await session.endSession();
    }
  }
}
