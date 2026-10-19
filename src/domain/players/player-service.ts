import { Db, Document } from "mongodb";
import { Principal } from "../../infrastructure/auth/identity-provider";
import { logger } from "../../infrastructure/logging/logger";
import { z } from "zod";

export interface Player {
  _id: string;
  displayName: string;
  status: "active" | "suspended" | "banned";
  createdAt: Date;
  updatedAt: Date;
}

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(32),
}).strict();

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as Document)["code"] === 11000;
}

// Default display name uses 16 hex chars of a UUIDv4 (64 bits of entropy).
// The previous 6-char suffix has a birthday bound around 16.7M players,
// which would eventually collide on the unique displayName index.
function defaultDisplayName(): string {
  return `Player_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export class PlayerService {
  constructor(private db: Db) {}

  async resolvePlayer(principal: Principal): Promise<Player> {
    const playersCol = this.db.collection<Player>("players");
    const identitiesCol = this.db.collection<Document>("playerIdentities");

    const existingIdentity = await identitiesCol.findOne({
      provider: principal.provider,
      providerId: principal.providerId,
    });

    if (existingIdentity) {
      const player = await playersCol.findOne({ _id: existingIdentity["playerId"] as string });
      if (!player) throw new Error("Data integrity error.");
      return player;
    }

    const playerId = `player_${crypto.randomUUID()}`;
    const now = new Date();
    const newPlayer: Player = {
      _id: playerId,
      displayName: defaultDisplayName(),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const session = this.db.client.startSession();
    try {
      await session.withTransaction(async () => {
        const result = await identitiesCol.findOneAndUpdate(
          { provider: principal.provider, providerId: principal.providerId },
          {
            $setOnInsert: {
              _id: `identity_${crypto.randomUUID()}`,
              playerId: playerId,
              provider: principal.provider,
              providerId: principal.providerId,
              createdAt: now,
            },
          },
          { upsert: true, returnDocument: "after", session }
        );

        if (result && result["playerId"] !== playerId) {
          throw new Error("RACE_CONDITION_LOST");
        }

        await playersCol.insertOne(newPlayer, { session });
      });
      return newPlayer;
    } catch (err) {
      if (err instanceof Error && err.message === "RACE_CONDITION_LOST") {
        const identity = await identitiesCol.findOne({ provider: principal.provider, providerId: principal.providerId });
        if (identity) {
          const player = await playersCol.findOne({ _id: identity["playerId"] as string });
          if (player) return player;
        }
      }
      if (isDuplicateKeyError(err)) {
        const identity = await identitiesCol.findOne({ provider: principal.provider, providerId: principal.providerId });
        if (identity) {
          const player = await playersCol.findOne({ _id: identity["playerId"] as string });
          if (player) return player;
        }
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async updateProfile(playerId: string, payload: unknown): Promise<Player> {
    const parsed = updateProfileSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`INVALID_PAYLOAD: ${parsed.error.message}`);
    }

    const playersCol = this.db.collection<Player>("players");
    try {
      const result = await playersCol.findOneAndUpdate(
        { _id: playerId },
        { $set: { displayName: parsed.data.displayName, updatedAt: new Date() } },
        { returnDocument: "after" }
      );

      if (!result) throw new Error("PLAYER_NOT_FOUND");

      logger.info("Updated player profile", { playerId, displayName: parsed.data.displayName });
      return result;
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        logger.warn("Display name already taken", { playerId, displayName: parsed.data.displayName });
        throw new Error("DISPLAY_NAME_TAKEN");
      }
      throw err;
    }
  }

  async linkIdentity(playerId: string, newPrincipal: Principal, currentPrincipal: Principal): Promise<void> {
    if (playerId !== (await this.getPlayerIdFromPrincipal(currentPrincipal))) {
      throw new Error("UNAUTHORIZED: You can only link identities to your own account.");
    }

    const identitiesCol = this.db.collection<{ _id: string } & Document>("playerIdentities");

    const existing = await identitiesCol.findOne({
      provider: newPrincipal.provider,
      providerId: newPrincipal.providerId,
    });

    if (existing) {
      throw new Error("IDENTITY_ALREADY_LINKED");
    }

    await identitiesCol.insertOne({
      _id: `identity_${crypto.randomUUID()}`,
      playerId: playerId,
      provider: newPrincipal.provider,
      providerId: newPrincipal.providerId,
      createdAt: new Date(),
    });

    logger.info("Linked new identity", { playerId, provider: newPrincipal.provider });
  }

  async enforceHighRiskStatus(playerId: string): Promise<void> {
    const playersCol = this.db.collection<Player>("players");
    const player = await playersCol.findOne({ _id: playerId });

    if (!player) throw new Error("PLAYER_NOT_FOUND");
    if (player.status !== "active") {
      logger.warn("Blocked high-risk action for inactive player", { playerId, status: player.status });
      throw new Error(`FORBIDDEN: Account is ${player.status}`);
    }
  }

  private async getPlayerIdFromPrincipal(principal: Principal): Promise<string> {
    const identitiesCol = this.db.collection<Document>("playerIdentities");
    const identity = await identitiesCol.findOne({
      provider: principal.provider,
      providerId: principal.providerId,
    });
    if (!identity) throw new Error("PLAYER_NOT_FOUND");
    return identity["playerId"] as string;
  }
}
