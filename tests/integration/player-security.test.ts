import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { PlayerService } from "../../src/domain/players/player-service";
import { Principal } from "../../src/infrastructure/auth/identity-provider";
import "dotenv/config";

describe("PlayerService - Security (2.5 & 2.6)", () => {
  let client: MongoClient;
  let db: Db;
  let service: PlayerService;
  let playerId: string;
  
  const currentPrincipal: Principal = { provider: "steam", providerId: "steam_1" };
  const newPrincipal: Principal = { provider: "xbox", providerId: "xbox_1" };

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-security-test");
    service = new PlayerService(db);
    
    playerId = `player_sec_${Date.now()}`;
    await db.collection<{ _id: string } & Document>("players").insertOne({
      _id: playerId,
      displayName: "SecTest",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Fix: explicitly type the collection to expect a string _id here too
    await db.collection<{ _id: string } & Document>("playerIdentities").insertOne({
      _id: "id_sec_1",
      playerId: playerId,
      provider: currentPrincipal.provider,
      providerId: currentPrincipal.providerId,
      createdAt: new Date()
    });
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describe("2.5 Identity Linking", () => {
    it("links a new identity if owned by the player", async () => {
      await service.linkIdentity(playerId, newPrincipal, currentPrincipal);
      const count = await db.collection("playerIdentities").countDocuments({ playerId });
      expect(count).toBe(2);
    });

    it("rejects linking an identity that belongs to someone else", async () => {
      await expect(
        service.linkIdentity("someone_else", { provider: "xbox", providerId: "xbox_2" }, currentPrincipal)
      ).rejects.toThrow("UNAUTHORIZED");
    });
  });

  describe("2.6 Account Status Enforcement", () => {
    it("passes for active players", async () => {
      await expect(service.enforceHighRiskStatus(playerId)).resolves.not.toThrow();
    });

    it("fails if the player is suspended mid-session", async () => {
      await db.collection<{ _id: string } & Document>("players").updateOne(
        { _id: playerId }, 
        { $set: { status: "suspended" } }
      );
      
      await expect(service.enforceHighRiskStatus(playerId)).rejects.toThrow("FORBIDDEN: Account is suspended");
    });
  });
});