import { Db } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";
import { Friendship, Block } from "./types";

const MAX_FRIENDS = 1000;
const MAX_INFLIGHT_REQUESTS = 50;

export class FriendshipService {
  constructor(private db: Db) {}

  async ensureIndexes(): Promise<void> {
    const friendships = this.db.collection("friendships");
    await friendships.createIndex(
      { fromPlayerId: 1, toPlayerId: 1 },
      { unique: true, name: "from_1_to_1" }
    );
    await friendships.createIndex(
      { fromPlayerId: 1, status: 1 },
      { name: "from_1_status_1" }
    );
    await friendships.createIndex(
      { toPlayerId: 1, status: 1 },
      { name: "to_1_status_1" }
    );

    const blocks = this.db.collection("blocks");
    await blocks.createIndex(
      { blockerId: 1, blockedId: 1 },
      { unique: true, name: "blocker_1_blocked_1" }
    );
  }

  /**
   * Send a friend request.
   * - If the other side already has a pending request to us, auto-accept.
   * - If either side blocked the other, fail generically (no existence leak).
   * - Idempotent under retry.
   */
  async sendRequest(
    fromPlayerId: string,
    toPlayerId: string
  ): Promise<"sent" | "already_pending" | "already_friends"> {
    if (fromPlayerId === toPlayerId) {
      throw new Error("CANNOT_FRIEND_SELF");
    }

    // Block check — either direction wins silently.
    const blocked = await this.db.collection<Block>("blocks").findOne({
      $or: [
        { blockerId: fromPlayerId, blockedId: toPlayerId },
        { blockerId: toPlayerId, blockedId: fromPlayerId },
      ],
    });
    if (blocked) {
      logger.warn("Friend request blocked by block edge", { fromPlayerId, toPlayerId });
      throw new Error("FRIEND_REQUEST_FAILED");
    }

    const col = this.db.collection<Friendship>("friendships");

    // If the other side already asked us, accept theirs (mutual = friends).
    const reverse = await col.findOne({
      fromPlayerId: toPlayerId,
      toPlayerId: fromPlayerId,
      status: "pending",
    });
    if (reverse) {
      await this.acceptRequest(fromPlayerId, toPlayerId);
      return "already_friends";
    }

    // If we already sent one (or are already friends), no-op.
    const existing = await col.findOne({ fromPlayerId, toPlayerId });
    if (existing) {
      return existing.status === "accepted" ? "already_friends" : "already_pending";
    }

    // Cap in-flight outgoing requests to prevent queue flooding.
    const inflight = await col.countDocuments({
      fromPlayerId,
      status: "pending",
    });
    if (inflight >= MAX_INFLIGHT_REQUESTS) {
      throw new Error("TOO_MANY_PENDING_REQUESTS");
    }

    try {
      await col.insertOne({
        _id: `fr_${crypto.randomUUID()}`,
        fromPlayerId,
        toPlayerId,
        status: "pending",
        createdAt: new Date(),
      });
      logger.info("Friend request sent", { fromPlayerId, toPlayerId });
      return "sent";
    } catch (err) {
      // Race on the unique (from, to) index: another concurrent call won.
      if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
        return "already_pending";
      }
      throw err;
    }
  }

  /**
   * Accept an incoming request. Wrapped in a transaction so the reverse
   * row and the status change commit together. Under concurrency, the
   * unique index on the reverse row is the exactly-once point.
   */
  async acceptRequest(accepterId: string, requesterId: string): Promise<void> {
    const session = this.db.client.startSession();
    try {
      await session.withTransaction(async () => {
        const col = this.db.collection<Friendship>("friendships");

        const pending = await col.findOne(
          { fromPlayerId: requesterId, toPlayerId: accepterId, status: "pending" },
          { session }
        );
        if (!pending) {
          // Already accepted by a race, or never existed. No-op, no leak.
          logger.info("Accept found no pending request", { accepterId, requesterId });
          return;
        }

        const updated = await col.updateOne(
          { _id: pending._id, status: "pending" },
          { $set: { status: "accepted", acceptedAt: new Date() } },
          { session }
        );
        if (updated.modifiedCount === 0) {
          return; // raced another accept
        }

        try {
          await col.insertOne(
            {
              _id: `fr_${crypto.randomUUID()}`,
              fromPlayerId: accepterId,
              toPlayerId: requesterId,
              status: "accepted",
              createdAt: new Date(),
              acceptedAt: new Date(),
            },
            { session }
          );
        } catch (err) {
          if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
            return; // reverse row already there from a prior attempt
          }
          throw err;
        }

        // Friend cap check under the transaction snapshot.
        const fromCount = await col.countDocuments(
          { fromPlayerId: accepterId, status: "accepted" },
          { session }
        );
        const toCount = await col.countDocuments(
          { fromPlayerId: requesterId, status: "accepted" },
          { session }
        );
        if (fromCount > MAX_FRIENDS || toCount > MAX_FRIENDS) {
          throw new Error("FRIEND_CAP_REACHED");
        }
      });

      logger.info("Friend request accepted", { accepterId, requesterId });
    } finally {
      await session.endSession();
    }
  }

  private async displayNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const players = await this.db
      .collection<{ _id: string } & import("mongodb").Document>("players")
      .find({ _id: { $in: ids } }, { projection: { displayName: 1 } })
      .toArray();
    return new Map(players.map((p) => [p._id, String(p["displayName"] ?? "")] as [string, string]));
  }

  /** Friends list with each friend's current display name attached. */
  async listFriendsWithNames(playerId: string, limit = 100) {
    const rows = await this.listFriends(playerId, limit);
    const names = await this.displayNames(rows.map((r) => r.toPlayerId));
    return rows.map((r) => ({ ...r, toPlayerName: names.get(r.toPlayerId) || r.toPlayerId }));
  }

  /** Incoming requests with the requester's current display name attached. */
  async listIncomingWithNames(playerId: string, limit = 100) {
    const rows = await this.listIncomingRequests(playerId, limit);
    const names = await this.displayNames(rows.map((r) => r.fromPlayerId));
    return rows.map((r) => ({ ...r, fromPlayerName: names.get(r.fromPlayerId) || r.fromPlayerId }));
  }

  private mutesCol() {
    return this.db.collection<{ _id: string } & import("mongodb").Document>("mutes");
  }

  /** Idempotent: the deterministic _id means a repeat call changes nothing. */
  async mute(muterId: string, mutedId: string): Promise<void> {
    if (muterId === mutedId) {
      throw new Error("CANNOT_MUTE_SELF");
    }
    await this.mutesCol().updateOne(
      { _id: `mute_${muterId}_${mutedId}` },
      { $setOnInsert: { muterId, mutedId, createdAt: new Date() } },
      { upsert: true }
    );
    logger.info("Player muted", { muterId, mutedId });
  }

  async unmute(muterId: string, mutedId: string): Promise<void> {
    await this.mutesCol().deleteOne({ _id: `mute_${muterId}_${mutedId}` });
    logger.info("Player unmuted", { muterId, mutedId });
  }

  async listMutedIds(muterId: string, limit = 1000): Promise<string[]> {
    const docs = await this.mutesCol().find({ muterId }).limit(limit).toArray();
    return docs.map((d) => String(d["mutedId"]));
  }

  async unfriend(playerId: string, otherId: string): Promise<void> {
    const session = this.db.client.startSession();
    try {
      await session.withTransaction(async () => {
        await this.db.collection<Friendship>("friendships").deleteMany(
          {
            $or: [
              { fromPlayerId: playerId, toPlayerId: otherId },
              { fromPlayerId: otherId, toPlayerId: playerId },
            ],
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
    logger.info("Unfriended", { playerId, otherId });
  }

  async listFriends(playerId: string, limit = 100): Promise<Friendship[]> {
    return this.db
      .collection<Friendship>("friendships")
      .find({ fromPlayerId: playerId, status: "accepted" })
      .sort({ acceptedAt: -1 })
      .limit(limit)
      .toArray();
  }

  async listIncomingRequests(playerId: string, limit = 100): Promise<Friendship[]> {
    return this.db
      .collection<Friendship>("friendships")
      .find({ toPlayerId: playerId, status: "pending" })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Blocking always wins. Removes friendship edges in both directions
   * and writes a one-way block. Blocking does not require a friendship.
   */
  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new Error("CANNOT_BLOCK_SELF");
    }
    const session = this.db.client.startSession();
    try {
      await session.withTransaction(async () => {
        await this.db.collection<Friendship>("friendships").deleteMany(
          {
            $or: [
              { fromPlayerId: blockerId, toPlayerId: blockedId },
              { fromPlayerId: blockedId, toPlayerId: blockerId },
            ],
          },
          { session }
        );

        try {
          await this.db.collection<Block>("blocks").insertOne(
            {
              _id: `blk_${crypto.randomUUID()}`,
              blockerId,
              blockedId,
              createdAt: new Date(),
            },
            { session }
          );
        } catch (err) {
          if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
            return; // already blocked
          }
          throw err;
        }
      });
    } finally {
      await session.endSession();
    }
    logger.info("Player blocked", { blockerId, blockedId });
  }
}
