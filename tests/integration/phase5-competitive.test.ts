import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { calculateNewRating } from "../../src/domain/matches/rating-algorithm";
import { deriveTier } from "../../src/domain/matches/tier-derivation";
import { RatingCorrectionService } from "../../src/domain/matches/rating-correction-service";
import { SeasonService } from "../../src/domain/matches/season-service";
import "dotenv/config";

describe("Phase 5 - Competitive Engine", () => {
  let client: MongoClient;
  let db: Db;
  let correctionService: RatingCorrectionService;
  let seasonService: SeasonService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-phase5-test");
    correctionService = new RatingCorrectionService(db);
    seasonService = new SeasonService(db);
  });

  afterEach(async () => {
    await db.collection("ratingCorrections").deleteMany({});
    await db.collection("competitiveRatings").deleteMany({});
    await db.collection("ratingEvents").deleteMany({});
    await db.collection("seasons").deleteMany({});
    await db.collection("matches").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describe("5.1 Rating Algorithm", () => {
    it("calculates deterministic Elo for win/loss/draw", () => {
      const win = calculateNewRating({ playerRating: 1500, opponentRating: 1500, result: "win", isPlacement: false });
      expect(win.delta).toBe(16); // K=32, Expected=0.5, Actual=1 -> 16
      
      const loss = calculateNewRating({ playerRating: 1500, opponentRating: 1500, result: "loss", isPlacement: false });
      expect(loss.delta).toBe(-16);
      
      const draw = calculateNewRating({ playerRating: 1500, opponentRating: 1500, result: "draw", isPlacement: false });
      expect(draw.delta).toBe(0);
    });
  });

  describe("5.2 Tier Derivation", () => {
    it("maps ratings to tiers monotonically", () => {
      expect(deriveTier(0).tier).toBe("Bronze");
      expect(deriveTier(1199).tier).toBe("Bronze");
      expect(deriveTier(1200).tier).toBe("Silver");
      expect(deriveTier(1500).tier).toBe("Gold");
      expect(deriveTier(2400).tier).toBe("Master");
      expect(deriveTier(2799).tier).toBe("Master");
      expect(deriveTier(2800).tier).toBe("Legendary");
      expect(deriveTier(5000).tier).toBe("Legendary");
      // Legendary is divisionless
      expect(deriveTier(2800).division).toBe(1);
      expect(deriveTier(5000).division).toBe(1);
    });
  });

  describe("5.3 Rating Correction Workflow", () => {
    it("preserves original event and applies compensating correction", async () => {
      // Setup original event + projection
      await db.collection<{ _id: string } & Document>("ratingEvents").insertOne({
        _id: "evt_original",
        playerId: "player_corr",
        sequence: 1,
        ratingDelta: 25,
        matchId: "match_1",
        createdAt: new Date()
      });

      await db.collection<{ _id: string } & Document>("competitiveRatings").insertOne({
        _id: "player_corr",
        rating: 1025,
        lastAppliedSequence: 1,
        updatedAt: new Date()
      });

      await correctionService.applyCorrection("player_corr", "evt_original", -25, "Bad match result", "admin_1");

      // Original event must be untouched
      const original = await db.collection<{ _id: string } & Document>("ratingEvents").findOne({ _id: "evt_original" });
      expect(original!["ratingDelta"]).toBe(25);

      // Projection updated
      const projection = await db.collection<{ _id: string } & Document>("competitiveRatings").findOne({ _id: "player_corr" });
      expect(projection!["rating"]).toBe(1000);

      // Correction ledger exists
      const corrections = await db.collection("ratingCorrections").countDocuments({ playerId: "player_corr" });
      expect(corrections).toBe(1);
    });
  });

  describe("5.4 Season Lifecycle", () => {
    it("prevents match creation in closed seasons", async () => {
      const season = await seasonService.createSeason("Season 1");
      await seasonService.activateSeason(season._id);
      
      await db.collection<{ _id: string } & Document>("matches").insertOne({
        _id: "match_season_test",
        status: "created",
        contentVersion: "v1",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await seasonService.createMatchInSeason(season._id, "match_season_test");
      await seasonService.closeSeason(season._id);

      await expect(seasonService.createMatchInSeason(season._id, "match_season_test"))
        .rejects.toThrow("CANNOT_CREATE_MATCH_IN_NON_ACTIVE_SEASON");
    });
  });
});
