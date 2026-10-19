import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { ModerationService } from "../../src/domain/matches/moderation-service";
import { requirePlayer, requireAdmin, Context } from "../../src/infrastructure/auth/middleware";
import { Player } from "../../src/domain/players/player-service";
import "dotenv/config";

describe("Phase 8 - Moderation & Audit", () => {
  let client: MongoClient;
  let db: Db;
  let moderation: ModerationService;

  const mockPlayer: Player = {
    _id: "player_target",
    displayName: "Target",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-phase8-test");
    moderation = new ModerationService(db);
  });

  afterEach(async () => {
    await db.collection("sanctions").deleteMany({});
    await db.collection("players").deleteMany({});
    await db.collection("auditEvents").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describe("8.1 Report and Sanction Workflow", () => {
    it("applies sanction, updates player status, and writes audit", async () => {
      await db.collection<{ _id: string } & Document>("players").insertOne({ 
        ...mockPlayer,
        status: "active"
      });

      await moderation.applySanction("player_target", "suspend", "Cheating", "admin_1");

      const player = await db.collection<{ _id: string } & Document>("players").findOne({ _id: "player_target" });
      expect(player!["status"]).toBe("suspended");

      const auditCount = await db.collection("auditEvents").countDocuments({ target: "player_target" });
      expect(auditCount).toBe(1);
    });

    it("lifts sanction and restores player status", async () => {
      await db.collection<{ _id: string } & Document>("players").insertOne({ 
        ...mockPlayer, 
        status: "suspended" 
      });
      
      // Apply a sanction first
      await moderation.applySanction("player_target", "suspend", "Cheating", "admin_1");
      
      // Get the sanction
      const sanction = await db.collection<{ _id: string } & Document>("sanctions").findOne({ playerId: "player_target" });
      
      // Lift it
      await moderation.liftSanction(sanction!["_id"] as string, "admin_2");

      const player = await db.collection<{ _id: string } & Document>("players").findOne({ _id: "player_target" });
      expect(player!["status"]).toBe("active");

      const sanctionAfter = await db.collection<{ _id: string } & Document>("sanctions").findOne({ _id: sanction!["_id"] });
      expect(sanctionAfter!["active"]).toBe(false);

      const auditCount = await db.collection("auditEvents").countDocuments({ target: "player_target" });
      expect(auditCount).toBe(2); // apply + lift
    });
  });

  describe("8.2 Audit Event Coverage", () => {
    it("records audit events with actor, reason, and before/after state", async () => {
      await moderation.writeAuditEvent({
        actor: "admin_1",
        action: "TEST_ACTION",
        target: "player_1",
        reason: "Testing audit coverage",
        before: { status: "active" },
        after: { status: "suspended" }
      });

      const audit = await db.collection<{ _id: string } & Document>("auditEvents").findOne({ action: "TEST_ACTION" });
      expect(audit!["actor"]).toBe("admin_1");
      expect(audit!["reason"]).toBe("Testing audit coverage");
      expect(audit!["before"]).toEqual({ status: "active" });
      expect(audit!["after"]).toEqual({ status: "suspended" });
    });
  });

  describe("8.3 Admin Endpoint Separation", () => {
    it("throws 403 for non-admin players", () => {
      const playerCtx: Context = { 
        player: mockPlayer, 
        principal: { providerId: "p1", provider: "auth0" } 
      };
      const checkAdmin = requireAdmin("sanction");
      expect(() => checkAdmin(playerCtx)).toThrow();
    });

    it("passes for admin players", () => {
      const adminCtx: Context = { 
        player: mockPlayer, 
        principal: { 
          providerId: "p1", 
          provider: "auth0", 
          metadata: { role: "admin" }
        } 
      };
      const checkAdmin = requireAdmin("sanction");
      expect(() => checkAdmin(adminCtx)).not.toThrow();
    });
  });
});
