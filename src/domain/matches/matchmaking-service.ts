import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

export interface MatchmakingTicket {
  _id: string;
  playerId: string;
  partyId: string;
  status: "queued" | "allocating" | "matched" | "cancelled";
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchAllocation {
  _id: string;
  matchId: string;
  ticketIds: string[];
  createdAt: Date;
}

const VALID_TICKET_TRANSITIONS: Record<MatchmakingTicket["status"], MatchmakingTicket["status"][]> = {
  queued: ["allocating", "cancelled"],
  allocating: ["matched", "cancelled"],
  matched: [],
  cancelled: [],
};

export class MatchmakingService {
  constructor(private db: Db) {}

  async createTicket(playerId: string, partyId: string): Promise<MatchmakingTicket> {
    const col = this.db.collection<MatchmakingTicket>("matchmakingTickets");
    const ticket: MatchmakingTicket = {
      _id: `ticket_${crypto.randomUUID()}`,
      playerId,
      partyId,
      status: "queued",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await col.insertOne(ticket);
    return ticket;
  }

  async cancelTicket(ticketId: string): Promise<void> {
    const col = this.db.collection<MatchmakingTicket>("matchmakingTickets");
    const ticket = await col.findOne({ _id: ticketId });
    
    if (!ticket) throw new Error("TICKET_NOT_FOUND");
    
    if (ticket.status === "allocating") {
      throw new Error("CANNOT_CANCEL_ALLOCATING_TICKET");
    }

    if (!VALID_TICKET_TRANSITIONS[ticket.status].includes("cancelled")) {
      throw new Error(`CANNOT_CANCEL_${ticket.status.toUpperCase()}_TICKET`);
    }

    await col.updateOne(
      { _id: ticketId, status: ticket.status, version: ticket.version },
      { $set: { status: "cancelled", updatedAt: new Date() }, $inc: { version: 1 } }
    );
  }

  async allocateTickets(ticketIds: string[]): Promise<string> {
    const session = this.db.client.startSession();
    const matchId = `match_${crypto.randomUUID()}`;
    const allocationId = `alloc_${crypto.randomUUID()}`;
    
    try {
      await session.withTransaction(async () => {
        const ticketsCol = this.db.collection<MatchmakingTicket>("matchmakingTickets");
        const allocationsCol = this.db.collection<MatchAllocation>("matchAllocations");

        for (const ticketId of ticketIds) {
          const result = await ticketsCol.updateOne(
            { _id: ticketId, status: "queued" },
            { $set: { status: "allocating", updatedAt: new Date() }, $inc: { version: 1 } },
            { session }
          );
          if (result.modifiedCount === 0) {
            throw new Error(`PARTIAL_CLAIM_FAILED: ${ticketId} is not queued`);
          }
        }

        await allocationsCol.insertOne(
          {
            _id: allocationId,
            matchId,
            ticketIds,
            createdAt: new Date()
          },
          { session }
        );

        await ticketsCol.updateMany(
          { _id: { $in: ticketIds } },
          { $set: { status: "matched", updatedAt: new Date() }, $inc: { version: 1 } },
          { session }
        );
      });

      logger.info("Allocated match", { matchId, ticketCount: ticketIds.length });
      return matchId;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Real production method: recovers tickets stuck in "allocating"
   * whose allocator has crashed (lease expired).
   */
  async recoverExpiredAllocations(): Promise<number> {
    const col = this.db.collection<{ _id: string } & Document>("matchmakingTickets");
    const now = new Date();

    const result = await col.updateMany(
      {
        status: "allocating",
        leaseUntil: { $lt: now }
      },
      {
        $set: { status: "queued", updatedAt: now },
        $unset: { leaseOwner: "", leaseUntil: "" }
      }
    );

    logger.info("Recovered expired allocations", { count: result.modifiedCount });
    return result.modifiedCount;
  }
}
