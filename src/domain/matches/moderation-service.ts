import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

export interface Sanction {
  _id: string;
  playerId: string;
  type: "warning" | "suspend" | "ban";
  reason: string;
  operatorId: string;
  expiresAt?: Date | undefined;
  active: boolean;
  createdAt: Date;
}

export interface AuditEvent {
  _id: string;
  actor: string;
  action: string;
  target: string;
  reason: string;
  before?: Record<string, unknown> | undefined;
  after?: Record<string, unknown> | undefined;
  createdAt: Date;
}

export class ModerationService {
  constructor(private db: Db) {}

  async applySanction(
    playerId: string,
    type: Sanction["type"],
    reason: string,
    operatorId: string,
    expiresAt?: Date
  ): Promise<void> {
    const session = this.db.client.startSession();
    try {
      await session.withTransaction(async () => {
        const sanctionsCol = this.db.collection<Sanction>("sanctions");
        const auditCol = this.db.collection<AuditEvent>("auditEvents");
        const playersCol = this.db.collection<{ _id: string } & Document>("players");

        // Write sanction
        await sanctionsCol.insertOne({
          _id: `sanction_${crypto.randomUUID()}`,
          playerId,
          type,
          reason,
          operatorId,
          expiresAt,
          active: true,
          createdAt: new Date()
        }, { session });

        // Update player status
        const newStatus = type === "ban" ? "banned" : type === "suspend" ? "suspended" : "active";
        await playersCol.updateOne(
          { _id: playerId },
          { $set: { status: newStatus, updatedAt: new Date() } },
          { session }
        );

        // Write audit
        await auditCol.insertOne({
          _id: `audit_${crypto.randomUUID()}`,
          actor: operatorId,
          action: "APPLY_SANCTION",
          target: playerId,
          reason,
          after: { type, expiresAt },
          createdAt: new Date()
        }, { session });
      });
      logger.info("Sanction applied", { playerId, type, operatorId });
    } finally {
      await session.endSession();
    }
  }

  async liftSanction(sanctionId: string, operatorId: string): Promise<void> {
    const session = this.db.client.startSession();
    try {
      await session.withTransaction(async () => {
        const sanctionsCol = this.db.collection<Sanction>("sanctions");
        const auditCol = this.db.collection<AuditEvent>("auditEvents");
        const playersCol = this.db.collection<{ _id: string } & Document>("players");

        const sanction = await sanctionsCol.findOne({ _id: sanctionId, active: true }, { session });
        if (!sanction) throw new Error("SANCTION_NOT_FOUND_OR_INACTIVE");

        // Deactivate sanction
        await sanctionsCol.updateOne(
          { _id: sanctionId },
          { $set: { active: false, liftedAt: new Date() } },
          { session }
        );

        // Restore player status
        await playersCol.updateOne(
          { _id: sanction.playerId },
          { $set: { status: "active", updatedAt: new Date() } },
          { session }
        );

        // Write audit
        await auditCol.insertOne({
          _id: `audit_${crypto.randomUUID()}`,
          actor: operatorId,
          action: "LIFT_SANCTION",
          target: sanction.playerId,
          reason: "Sanction lifted",
          before: { sanctionId },
          createdAt: new Date()
        }, { session });
      });
      logger.info("Sanction lifted", { sanctionId, operatorId });
    } finally {
      await session.endSession();
    }
  }

  async writeAuditEvent(event: Omit<AuditEvent, "_id" | "createdAt">): Promise<void> {
    const col = this.db.collection<AuditEvent>("auditEvents");
    await col.insertOne({
      ...event,
      _id: `audit_${crypto.randomUUID()}`,
      createdAt: new Date()
    });
  }
}
