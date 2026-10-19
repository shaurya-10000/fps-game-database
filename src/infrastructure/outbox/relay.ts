import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";
import { triggerFailurePoint } from "../../infrastructure/failure-injection";

export interface OutboxDelivery {
  _id: string;
  eventId: string;
  consumer: string;
  status: "pending" | "processing" | "completed" | "failed" | "dead_letter";
  leaseOwner?: string;
  leaseUntil?: Date;
  attempts: number;
  availableAt: Date;
  createdAt: Date;
}

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;

export class OutboxRelay {
  constructor(private db: Db, private workerId: string) {}

  async claimDelivery(): Promise<OutboxDelivery | null> {
    const col = this.db.collection<OutboxDelivery>("outboxDeliveries");
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 30000); // 30s lease

    const result = await col.findOneAndUpdate(
      {
        $or: [
          { status: "pending", availableAt: { $lte: now } },
          { status: "processing", leaseUntil: { $lt: now } }
        ]
      },
      {
        $set: {
          status: "processing",
          leaseOwner: this.workerId,
          leaseUntil: leaseUntil,
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, returnDocument: "after" }
    );

    return result;
  }

  async completeDelivery(deliveryId: string): Promise<boolean> {
    const col = this.db.collection<OutboxDelivery>("outboxDeliveries");
    triggerFailurePoint("before-projection-commit");

    const result = await col.updateOne(
      { 
        _id: deliveryId, 
        leaseOwner: this.workerId,
        status: "processing"
      },
      { 
        $set: { status: "completed", completedAt: new Date() },
        $unset: { leaseOwner: "", leaseUntil: "" }
      }
    );

    return result.modifiedCount === 1;
  }

  async failDelivery(deliveryId: string, error: string): Promise<"retry" | "dead_letter" | "ignored"> {
    const col = this.db.collection<OutboxDelivery>("outboxDeliveries");
    
    const delivery = await col.findOne({ _id: deliveryId });
    if (!delivery || delivery.leaseOwner !== this.workerId) {
      logger.warn("Stale-worker protection: refusing to fail delivery owned by another worker.", { deliveryId });
      return "ignored";
    }

    if (delivery.attempts >= MAX_ATTEMPTS) {
      await col.updateOne(
        { _id: deliveryId },
        { 
          $set: { status: "dead_letter", lastError: error, failedAt: new Date() },
          $unset: { leaseOwner: "", leaseUntil: "" }
        }
      );
      // 4.5: Dead-letter alerting
      logger.error("🚨 DEAD LETTER ALERT: Delivery moved to dead_letter", { 
        deliveryId, 
        consumer: delivery.consumer,
        attempts: delivery.attempts,
        error 
      });
      return "dead_letter";
    }

    const backoffMs = BASE_BACKOFF_MS * Math.pow(2, delivery.attempts - 1);
    const jitter = Math.random() * 500;
    const availableAt = new Date(Date.now() + backoffMs + jitter);

    await col.updateOne(
      { _id: deliveryId },
      { 
        $set: { status: "pending", availableAt, lastError: error },
        $unset: { leaseOwner: "", leaseUntil: "" }
      }
    );
    logger.warn("Delivery scheduled for retry", { deliveryId, attempts: delivery.attempts, nextRetryAt: availableAt });
    return "retry";
  }
}
