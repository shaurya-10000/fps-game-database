import { Router, Request, Response } from "express";
import { Db } from "mongodb";
import { XpEngine } from "./xp-engine";

export function buildProgressionRouter(db: Db): Router {
  const router = Router();

  router.get("/me/progression", async (req: Request, res: Response) => {
    try {
      const playerId = req.ctx?.player?._id;
      if (!playerId) {
        res.status(401).json({ error: "UNAUTHORIZED" });
        return;
      }

      const profile = await db
        .collection<{ _id: string; totalXp: number; level: number; updatedAt: Date }>("progressionProfiles")
        .findOne({ _id: playerId });

      // If a player has never played a match, return their defaults
      const level = profile?.level ?? 1;
      const currentLevelXp = profile?.totalXp ?? 0;
      const xpForNextLevel = XpEngine.getXpRequiredForNextLevel(level);

      res.json({
        playerId,
        level,
        currentLevelXp,
        xpForNextLevel,
        progressPercent: Math.round((currentLevelXp / xpForNextLevel) * 100),
      });
    } catch (err) {
      res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
    }
  });

  return router;
}
