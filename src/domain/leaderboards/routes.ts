import { Router, Request, Response } from "express";
import { LeaderboardService } from "./leaderboard-service";

export function buildLeaderboardRouter(service: LeaderboardService): Router {
  const router = Router();

  const handleError = (err: unknown, res: Response) => {
    res.status(500).json({ error: "Internal Server Error" });
  };

  router.get("/leaderboards/global", async (req: Request, res: Response): Promise<void> => {
    try { res.json(await service.getGlobalLeaderboard()); } catch (e) { handleError(e, res); }
  });

  router.get("/leaderboards/region/:region", async (req: Request, res: Response): Promise<void> => {
    try {
      const region = req.params["region"];
      if (!region || Array.isArray(region)) { res.status(400).json({ error: "Invalid region" }); return; }
      res.json(await service.getRegionalLeaderboard(region)); 
    } catch (e) { handleError(e, res); }
  });

  router.get("/leaderboards/friends", async (req: Request, res: Response): Promise<void> => {
    try {
      const playerId = req.ctx?.player?._id;
      if (!playerId) { res.status(401).json({ error: "Unauthorized" }); return; }
      res.json(await service.getFriendsLeaderboard(playerId)); 
    } catch (e) { handleError(e, res); }
  });

  router.get("/leaderboards/weapon/:weaponId", async (req: Request, res: Response): Promise<void> => {
    try {
      const weaponId = req.params["weaponId"];
      if (!weaponId || Array.isArray(weaponId)) { res.status(400).json({ error: "Invalid weapon" }); return; }
      res.json(await service.getWeaponLeaderboard(weaponId)); 
    } catch (e) { handleError(e, res); }
  });

  router.get("/leaderboards/character/:characterId", async (req: Request, res: Response): Promise<void> => {
    try {
      const characterId = req.params["characterId"];
      if (!characterId || Array.isArray(characterId)) { res.status(400).json({ error: "Invalid character" }); return; }
      res.json(await service.getCharacterLeaderboard(characterId)); 
    } catch (e) { handleError(e, res); }
  });

  return router;
}
