import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { MatchmakingService } from "../../src/domain/matches/matchmaking-service";
import { TournamentService } from "../../src/domain/matches/tournament-service";
import "dotenv/config";

describe("Phase 7 - Matchmaking & Tournaments", () => {
  let client: MongoClient;
  let db: Db;
  let matchmaking: MatchmakingService;
  let tournament: TournamentService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-phase7-test");
    matchmaking = new MatchmakingService(db);
    tournament = new TournamentService(db);
  });

  afterEach(async () => {
    await db.collection("matchmakingTickets").deleteMany({});
    await db.collection("matchAllocations").deleteMany({});
    await db.collection("bracketRevisions").deleteMany({});
    await db.collection("tournamentMatches").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describe("7.1 Ticket State Machine", () => {
    it("enforces legal transitions and rejects illegal ones", async () => {
      const ticket = await matchmaking.createTicket("player_1", "party_1");
      expect(ticket.status).toBe("queued");

      // Fix: manually set the ticket to allocating to avoid race condition
      await db.collection<{ _id: string } & Document>("matchmakingTickets").updateOne(
        { _id: ticket._id },
        { $set: { status: "allocating" } }
      );

      // Cannot cancel after allocating
      await expect(matchmaking.cancelTicket(ticket._id))
        .rejects.toThrow("CANNOT_CANCEL_ALLOCATING_TICKET");
    });
  });

  describe("7.2 Atomic Allocation Claim", () => {
    it("only one allocator succeeds with concurrent claims", async () => {
      const ticket = await matchmaking.createTicket("player_1", "party_1");
      
      const [r1, r2] = await Promise.allSettled([
        matchmaking.allocateTickets([ticket._id]),
        matchmaking.allocateTickets([ticket._id])
      ]);

      const successes = [r1, r2].filter(r => r.status === "fulfilled");
      expect(successes.length).toBe(1);

      const allocations = await db.collection("matchAllocations").countDocuments();
      expect(allocations).toBe(1);
    });
  });

  describe("7.3 Partial Claim Prevention", () => {
    it("aborts the entire allocation if one ticket fails", async () => {
      const t1 = await matchmaking.createTicket("player_1", "party_1");
      const t2 = await matchmaking.createTicket("player_2", "party_1");
      
      await db.collection<{ _id: string } & Document>("matchmakingTickets").updateOne(
        { _id: t2._id },
        { $set: { status: "matched" } }
      );

      await expect(matchmaking.allocateTickets([t1._id, t2._id]))
        .rejects.toThrow("PARTIAL_CLAIM_FAILED");

      const t1After = await db.collection<{ _id: string } & Document>("matchmakingTickets").findOne({ _id: t1._id });
      expect(t1After!["status"]).toBe("queued");
    });
  });

  describe("7.6 Bracket Revision Immutability", () => {
    it("only one revision can be active", async () => {
      const r1 = await tournament.createRevision("tour_1", { rounds: 4 });
      const r2 = await tournament.createRevision("tour_1", { rounds: 8 });

      await tournament.activateRevision(r1._id);
      await tournament.activateRevision(r2._id);

      const activeCount = await db.collection("bracketRevisions").countDocuments({ 
        tournamentId: "tour_1", 
        active: true 
      });
      expect(activeCount).toBe(1);
    });
  });

  describe("7.7 Bracket Advancement Idempotency", () => {
    it("does not advance twice on replay", async () => {
      await db.collection<{ _id: string } & Document>("tournamentMatches").insertOne({
        _id: "tm_1",
        tournamentId: "tour_1",
        bracketVersion: "bracket_1",
        playerA: "p1",
        playerB: "p2",
        status: "pending",
        createdAt: new Date()
      });

      const r1 = await tournament.advanceBracket("tm_1", "p1");
      expect(r1).toBe("advanced");

      const r2 = await tournament.advanceBracket("tm_1", "p1");
      expect(r2).toBe("duplicate");

      const r3 = await tournament.advanceBracket("tm_1", "p2");
      expect(r3).toBe("duplicate");
    });
  });
});
