import { Router, Request, Response } from "express";
import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";
import { deriveTier } from "../matches/tier-derivation";

const RECENT_MATCHES = 8;
const HISTORY_POINTS = 20;

interface Totals {
  matches: number;
  kills: number;
  deaths: number;
  damage: number;
  score: number;
  bestScore: number;
  survivalSeconds: number;
}

/**
 * Everything the profile page needs in one call: rating, tier, rank, career totals,
 * recent matches and a short rating history. All numbers are derived from existing projections.
 */
export function buildProfileOverviewRouter(db: Db): Router {
  const router = Router();

  router.get("/me/overview", async (req: Request, res: Response) => {
    try {
      const playerId = req.ctx?.player?._id;
      if (!playerId) {
        res.status(401).json({ error: "UNAUTHORIZED" });
        return;
      }

      const ratings = db.collection("competitiveRatings");
      const participants = db.collection("matchParticipants");
      const ratingEvents = db.collection("ratingEvents");

      const [player, ratingDoc, totalsRows, formRows, recentParticipants, recentEvents] = await Promise.all([
        db.collection("players").findOne({ _id: playerId as never }, { projection: { createdAt: 1 } }),
        ratings.findOne({ _id: playerId as never }),
        participants
          .aggregate<Document>([
            { $match: { playerId } },
            {
              $group: {
                _id: null,
                matches: { $sum: 1 },
                kills: { $sum: "$kills" },
                deaths: { $sum: "$deaths" },
                damage: { $sum: "$damage" },
                score: { $sum: "$score" },
                bestScore: { $max: "$score" },
                survivalSeconds: { $sum: "$survivalTimeSeconds" },
              },
            },
          ])
          .toArray(),
        ratingEvents
          .aggregate<Document>([
            { $match: { playerId } },
            {
              $group: {
                _id: null,
                wins: { $sum: { $cond: [{ $gt: ["$ratingDelta", 0] }, 1, 0] } },
                losses: { $sum: { $cond: [{ $lt: ["$ratingDelta", 0] }, 1, 0] } },
              },
            },
          ])
          .toArray(),
        participants.find({ playerId }).sort({ createdAt: -1 }).limit(RECENT_MATCHES).toArray(),
        ratingEvents.find({ playerId }).sort({ sequence: -1 }).limit(Math.max(HISTORY_POINTS, RECENT_MATCHES)).toArray(),
      ]);

      const totalsRow = totalsRows[0];
      const totals: Totals = {
        matches: Number(totalsRow?.["matches"] ?? 0),
        kills: Number(totalsRow?.["kills"] ?? 0),
        deaths: Number(totalsRow?.["deaths"] ?? 0),
        damage: Number(totalsRow?.["damage"] ?? 0),
        score: Number(totalsRow?.["score"] ?? 0),
        bestScore: Number(totalsRow?.["bestScore"] ?? 0),
        survivalSeconds: Number(totalsRow?.["survivalSeconds"] ?? 0),
      };

      const rating = typeof ratingDoc?.["rating"] === "number" ? (ratingDoc["rating"] as number) : null;
      let rank: number | null = null;
      let ratedPlayers = 0;
      if (rating !== null) {
        const [higher, total] = await Promise.all([
          ratings.countDocuments({ rating: { $gt: rating } }),
          ratings.estimatedDocumentCount(),
        ]);
        rank = higher + 1;
        ratedPlayers = total;
      }

      // Rating history: walk back from the current rating using the recorded deltas.
      const history: { rating: number; at: Date }[] = [];
      if (rating !== null) {
        let running = rating;
        const points: { rating: number; at: Date }[] = [];
        for (const event of recentEvents.slice(0, HISTORY_POINTS)) {
          points.push({ rating: running, at: event["createdAt"] as Date });
          running -= Number(event["ratingDelta"] ?? 0);
        }
        history.push(...points.reverse());
      }

      // Recent matches, with the game mode (stored on the match-completed event) and the rating change.
      const matchIds = recentParticipants.map((p) => String(p["matchId"]));
      const modeRows =
        matchIds.length > 0
          ? await db
              .collection("outboxEvents")
              .find({ matchId: { $in: matchIds }, type: "MATCH_COMPLETED" }, { projection: { matchId: 1, "payload.gameModeId": 1 } })
              .toArray()
          : [];
      const modeByMatch = new Map<string, string>();
      for (const row of modeRows) {
        const payload = row["payload"] as { gameModeId?: string } | undefined;
        if (payload?.gameModeId) modeByMatch.set(String(row["matchId"]), payload.gameModeId);
      }
      const deltaByMatch = new Map<string, number>();
      for (const event of recentEvents) deltaByMatch.set(String(event["matchId"]), Number(event["ratingDelta"] ?? 0));

      res.json({
        memberSince: (player?.["createdAt"] as Date | undefined) ?? null,
        rating,
        tier: rating !== null ? deriveTier(rating) : null,
        rank,
        ratedPlayers,
        career: {
          ...totals,
          kd: totals.deaths > 0 ? totals.kills / totals.deaths : totals.kills,
          wins: Number(formRows[0]?.["wins"] ?? 0),
          losses: Number(formRows[0]?.["losses"] ?? 0),
        },
        ratingHistory: history,
        recentMatches: recentParticipants.map((p) => {
          const matchId = String(p["matchId"]);
          return {
            matchId,
            gameModeId: modeByMatch.get(matchId) ?? null,
            kills: Number(p["kills"] ?? 0),
            deaths: Number(p["deaths"] ?? 0),
            score: Number(p["score"] ?? 0),
            damage: Number(p["damage"] ?? 0),
            ratingDelta: deltaByMatch.get(matchId) ?? null,
            at: p["createdAt"] as Date,
          };
        }),
      });
    } catch (err) {
      logger.error("Profile overview failed", { error: String(err) });
      res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
    }
  });

  return router;
}