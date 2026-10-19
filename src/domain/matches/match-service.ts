import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

export interface ContentVersion {
  _id: string; // e.g., "v1", "v2"
  maps: string[];
  weapons: string[];
  characters: string[];
  gameModes: string[];
  createdAt: Date;
}

export interface Match {
  _id: string;
  status: "created" | "in_progress" | "completed" | "aborted";
  contentVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

const VALID_TRANSITIONS: Record<Match["status"], Match["status"][]> = {
  created: ["in_progress", "aborted"],
  in_progress: ["completed", "aborted"],
  completed: [],
  aborted: [],
};

export class MatchService {
  constructor(private db: Db) {}

  /**
   * Creates a new match pinned to a specific content version.
   */
  async createMatch(contentVersionId: string): Promise<Match> {
    const versionsCol = this.db.collection<ContentVersion>("contentVersions");
    const version = await versionsCol.findOne({ _id: contentVersionId });
    
    if (!version) {
      throw new Error(`CONTENT_VERSION_NOT_FOUND: ${contentVersionId}`);
    }

    const matchesCol = this.db.collection<Match>("matches");
    const now = new Date();
    const match: Match = {
      _id: `match_${crypto.randomUUID()}`,
      status: "created",
      contentVersion: contentVersionId,
      createdAt: now,
      updatedAt: now,
    };

    await matchesCol.insertOne(match);
    logger.info("Created match", { matchId: match._id, contentVersion: contentVersionId });
    
    return match;
  }

  /**
   * Transitions a match from one state to another.
   * Throws an error if the transition is illegal.
   */
  async transitionMatch(matchId: string, newStatus: Match["status"]): Promise<Match> {
    const matchesCol = this.db.collection<Match>("matches");
    const match = await matchesCol.findOne({ _id: matchId });

    if (!match) {
      throw new Error("MATCH_NOT_FOUND");
    }

    const allowed = VALID_TRANSITIONS[match.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`ILLEGAL_TRANSITION: Cannot go from '${match.status}' to '${newStatus}'.`);
    }

    const updated = await matchesCol.findOneAndUpdate(
      { _id: matchId },
      { $set: { status: newStatus, updatedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!updated) throw new Error("MATCH_NOT_FOUND");

    logger.info("Transitioned match state", { matchId, from: match.status, to: newStatus });
    return updated;
  }

  /**
   * Retrieves a match and resolves its catalog definitions as of its pinned version.
   */
  async getMatchWithResolvedContent(matchId: string): Promise<{ match: Match; content: ContentVersion }> {
    const matchesCol = this.db.collection<Match>("matches");
    const versionsCol = this.db.collection<ContentVersion>("contentVersions");

    const match = await matchesCol.findOne({ _id: matchId });
    if (!match) throw new Error("MATCH_NOT_FOUND");

    // We look up the specific version that the match was pinned to.
    // Even if the catalog has moved to v3, this will still return v1.
    const content = await versionsCol.findOne({ _id: match.contentVersion });
    if (!content) {
      throw new Error(`DATA_INTEGRITY_ERROR: Match references missing content version ${match.contentVersion}`);
    }

    return { match, content };
  }
}