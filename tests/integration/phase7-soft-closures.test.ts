import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { MatchmakingService } from "../../src/domain/matches/matchmaking-service";
import "dotenv/config";

describe("Phase 7 - Soft Closure Fixes (7.4, 7.5)", () => {
  let client: MongoClient;
  let db: Db;
  let matchmaking: MatchmakingService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-phase7-fixes-test");
    matchmaking = new MatchmakingService(db);
  });

  afterEach(async () => {
    await db.collection("matchmakingTickets").deleteMany({});
    await db.collection("matchAllocations").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describe("7.4 Cancellation vs Allocation Race", () => {
    it("cancel before claim succeeds", async () => {
      const ticket = await matchmaking.createTicket("p1", "party1");
      await matchmaking.cancelTicket(ticket._id);
      const doc = await db.collection<{ _id: string } & Document>("matchmakingTickets").findOne({ _id: ticket._id });
      expect(doc!["status"]).toBe("cancelled");
    });

    it("cancel after claim commits returns error", async () => {
      const ticket = await matchmaking.createTicket("p1", "party1");
      await matchmaking.allocateTickets([ticket._id]);
      await expect(matchmaking.cancelTicket(ticket._id)).rejects.toThrow(/CANNOT_CANCEL/);
    });

    it("cancel racing claim resolves deterministically", async () => {
      const ticket = await matchmaking.createTicket("p1", "party1");
      const [a, c] = await Promise.allSettled([
        matchmaking.allocateTickets([ticket._id]),
        matchmaking.cancelTicket(ticket._id)
      ]);
      const successes = [a, c].filter(r => r.status === "fulfilled");
      expect(successes.length).toBe(1);
    });
  });

  describe("7.5 Allocator Crash Recovery", () => {
    it("calls the real production recoverExpiredAllocations method", async () => {
      const ticket = await matchmaking.createTicket("p1", "party1");

      // Simulate a crash: set to allocating with an expired lease
      await db.collection<{ _id: string } & Document>("matchmakingTickets").updateOne(
        { _id: ticket._id },
        { 
          $set: { 
            status: "allocating", 
            leaseOwner: "crashed-allocator", 
            leaseUntil: new Date(Date.now() - 60000) 
          } 
        }
      );

      // Call the real production method
      const recovered = await matchmaking.recoverExpiredAllocations();
      expect(recovered).toBe(1);

      const doc = await db.collection<{ _id: string } & Document>("matchmakingTickets").findOne({ _id: ticket._id });
      expect(doc!["status"]).toBe("queued");
      expect(doc!["leaseOwner"]).toBeUndefined();
    });
  });
});
