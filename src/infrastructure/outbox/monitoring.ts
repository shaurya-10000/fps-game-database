import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

export interface QueueMetrics {
  oldestPendingAgeMs: number;
  pendingDepth: number;
  deadLetterCount: number;
}

export class MonitoringService {
  constructor(private db: Db) {}

  async getQueueMetrics(): Promise<QueueMetrics> {
    const col = this.db.collection<{ _id: string } & Document>("outboxDeliveries");
    const now = new Date();

    const pendingDepth = await col.countDocuments({ status: "pending" });
    const deadLetterCount = await col.countDocuments({ status: "dead_letter" });

    // Find the oldest pending delivery
    const oldest = await col.findOne(
      { status: "pending" },
      { sort: { createdAt: 1 } }
    );

    const oldestPendingAgeMs = oldest 
      ? now.getTime() - new Date(oldest["createdAt"]).getTime()
      : 0;

    // Alerting thresholds
    if (oldestPendingAgeMs > 60000) {
      logger.warn("🚨 ALERT: Queue age exceeds 60 seconds", { 
        oldestPendingAgeMs, pendingDepth, deadLetterCount 
      });
    }
    if (pendingDepth > 1000) {
      logger.warn("🚨 ALERT: Queue depth exceeds 1000", { 
        oldestPendingAgeMs, pendingDepth, deadLetterCount 
      });
    }
    if (deadLetterCount > 0) {
      logger.warn("🚨 ALERT: Dead letter queue is not empty", { 
        oldestPendingAgeMs, pendingDepth, deadLetterCount 
      });
    }

    return { oldestPendingAgeMs, pendingDepth, deadLetterCount };
  }
}
