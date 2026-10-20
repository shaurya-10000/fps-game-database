import { Router, Request, Response } from "express";
import { DmResolver } from "./dm-resolver";
import { logger } from "../../infrastructure/logging/logger";

export function buildChatRouter(resolver: DmResolver): Router {
  const router = Router();

  router.get("/chat/dm/:username", async (req: Request, res: Response) => {
    try {
      const senderId = req.ctx?.player?._id;
      if (!senderId) {
        res.status(401).json({ error: "UNAUTHORIZED" });
        return;
      }

      const raw = req.params["username"];
      if (!raw || Array.isArray(raw)) {
        res.status(400).json({ error: "INVALID_USERNAME" });
        return;
      }
      const targetUsername = raw;

      const roomId = await resolver.resolveDmRoomIdByUsername(senderId, targetUsername);
      
      res.json({ roomId, targetUsername });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "FRIEND_REQUEST_FAILED") {
        res.status(404).json({ error: "USER_NOT_FOUND" });
      } else if (msg === "CANNOT_DM_SELF") {
        res.status(400).json({ error: msg });
      } else {
        logger.error("Failed to resolve DM room", { error: msg });
        res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
      }
    }
  });

  router.get("/chat/dm-by-id/:playerId", async (req: Request, res: Response) => {
    try {
      const senderId = req.ctx?.player?._id;
      if (!senderId) {
        res.status(401).json({ error: "UNAUTHORIZED" });
        return;
      }

      const raw = req.params["playerId"];
      if (!raw || Array.isArray(raw)) {
        res.status(400).json({ error: "INVALID_PLAYER_ID" });
        return;
      }

      const { roomId, targetName } = await resolver.resolveDmRoomIdByPlayerId(senderId, raw);
      res.json({ roomId, targetUsername: targetName });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "FRIEND_REQUEST_FAILED") {
        res.status(404).json({ error: "USER_NOT_FOUND" });
      } else if (msg === "CANNOT_DM_SELF") {
        res.status(400).json({ error: msg });
      } else {
        logger.error("Failed to resolve DM room by id", { error: msg });
        res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
      }
    }
  });

  return router;
}
