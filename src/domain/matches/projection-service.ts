import { Db, Document } from "mongodb";

export interface ProjectionStatus {
  matchId: string;
  rating: "pending" | "processing" | "completed" | "failed";
  progression: "pending" | "processing" | "completed" | "failed";
  statistics: "pending" | "processing" | "completed" | "failed";
}

export class ProjectionService {
  constructor(private db: Db) {}

  async getProjectionStatus(matchId: string): Promise<ProjectionStatus> {
    const deliveriesCol = this.db.collection<{ _id: string } & Document>("outboxDeliveries");
    const outboxCol = this.db.collection<{ _id: string } & Document>("outboxEvents");

    // Find the event ID for this match
    const event = await outboxCol.findOne({ matchId, type: "MATCH_COMPLETED" });
    if (!event) {
      throw new Error("MATCH_EVENT_NOT_FOUND");
    }

    const deliveries = await deliveriesCol.find({ eventId: event._id }).toArray();
    
    const status: ProjectionStatus = {
      matchId,
      rating: "pending",
      progression: "pending",
      statistics: "pending",
    };

    for (const delivery of deliveries) {
      const consumer = delivery["consumer"] as keyof Omit<ProjectionStatus, "matchId">;
      const statusValue = delivery["status"] as "pending" | "processing" | "completed" | "failed";
      if (consumer in status) {
        status[consumer] = statusValue;
      }
    }

    return status;
  }

  async markDeliveryAsCompleted(eventId: string, consumer: string): Promise<void> {
    const deliveriesCol = this.db.collection<{ _id: string } & Document>("outboxDeliveries");
    await deliveriesCol.updateOne(
      { eventId, consumer },
      { $set: { status: "completed", completedAt: new Date() } }
    );
  }
}
