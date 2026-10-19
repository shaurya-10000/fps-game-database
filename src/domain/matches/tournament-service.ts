import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

export interface BracketRevision {
  _id: string;
  tournamentId: string;
  revision: number;
  parentRevisionId?: string | undefined;
  definition: Record<string, unknown>;
  definitionHash: string;
  active: boolean;
  createdAt: Date;
}

export interface TournamentMatch {
  _id: string;
  tournamentId: string;
  bracketVersion: string;
  playerA: string;
  playerB: string;
  winnerId?: string;
  status: "pending" | "completed";
  createdAt: Date;
}

export class TournamentService {
  constructor(private db: Db) {}

  async createRevision(
    tournamentId: string,
    definition: Record<string, unknown>,
    parentRevisionId?: string
  ): Promise<BracketRevision> {
    const col = this.db.collection<BracketRevision>("bracketRevisions");
    
    const definitionHash = require("crypto")
      .createHash("sha256")
      .update(JSON.stringify(definition))
      .digest("hex");

    const latest = await col.findOne(
      { tournamentId },
      { sort: { revision: -1 } }
    );

    const revision: BracketRevision = {
      _id: `bracket_${crypto.randomUUID()}`,
      tournamentId,
      revision: (latest?.revision || 0) + 1,
      parentRevisionId,
      definition,
      definitionHash,
      active: false,
      createdAt: new Date()
    };

    await col.insertOne(revision);
    return revision;
  }

  async activateRevision(revisionId: string): Promise<void> {
    const col = this.db.collection<BracketRevision>("bracketRevisions");
    
    const revision = await col.findOne({ _id: revisionId });
    if (!revision) throw new Error("REVISION_NOT_FOUND");

    const session = this.db.client.startSession();
    try {
      await session.withTransaction(async () => {
        await col.updateMany(
          { tournamentId: revision.tournamentId, active: true },
          { $set: { active: false } },
          { session }
        );

        const result = await col.updateOne(
          { _id: revisionId, active: false },
          { $set: { active: true } },
          { session }
        );
        
        if (result.modifiedCount === 0) {
          throw new Error("REVISION_ALREADY_ACTIVE");
        }
      });
      logger.info("Bracket revision activated", { revisionId });
    } finally {
      await session.endSession();
    }
  }

  async advanceBracket(
    matchId: string,
    winnerId: string
  ): Promise<"advanced" | "duplicate"> {
    const matchesCol = this.db.collection<TournamentMatch>("tournamentMatches");
    
    const result = await matchesCol.updateOne(
      { 
        _id: matchId, 
        status: "pending",
        winnerId: { $exists: false }
      },
      { 
        $set: { 
          winnerId, 
          status: "completed", 
          completedAt: new Date() 
        } 
      }
    );

    if (result.modifiedCount === 0) {
      const existing = await matchesCol.findOne({ _id: matchId });
      if (existing?.status === "completed") return "duplicate";
      throw new Error("BRACKET_ADVANCEMENT_FAILED");
    }

    logger.info("Bracket match advanced", { matchId, winnerId });
    return "advanced";
  }
}
