import { Router, Request, Response } from "express";
import { z } from "zod";
import { FriendshipService } from "./friendship-service";
import { logger } from "../../infrastructure/logging/logger";

const targetSchema = z.object({
  toPlayerId: z.string().min(1).max(128),
}).strict();

// Express 5 types req.params[key] as string | string[] | undefined.
// Pulling a required single-string route param out is repetitive enough to
// deserve its own helper, and the Array.isArray branch matches the pattern
// already used for matchId in server.ts.
function requiredStringParam(req: Request, key: string): string | null {
  const raw = req.params[key];
  if (!raw || Array.isArray(raw)) return null;
  return raw;
}

export function buildFriendsRouter(service: FriendshipService): Router {
  const router = Router();

  const playerIdOf = (req: Request): string => {
    const player = req.ctx?.player;
    if (!player) throw new Error("UNAUTHORIZED");
    return player._id;
  };

  router.post("/me/friends/requests", async (req: Request, res: Response) => {
    try {
      const parsed = targetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "INVALID_PAYLOAD" });
        return;
      }
      const me = playerIdOf(req);
      const result = await service.sendRequest(me, parsed.data.toPlayerId);
      res.status(202).json({ status: result });
    } catch (err) {
      handle(err, res);
    }
  });

  router.post(
    "/me/friends/requests/:fromPlayerId/accept",
    async (req: Request, res: Response) => {
      try {
        const fromPlayerId = requiredStringParam(req, "fromPlayerId");
        if (!fromPlayerId) {
          res.status(400).json({ error: "INVALID_PAYLOAD" });
          return;
        }
        const me = playerIdOf(req);
        await service.acceptRequest(me, fromPlayerId);
        res.status(204).send();
      } catch (err) {
        handle(err, res);
      }
    }
  );

  router.delete("/me/friends/:otherId", async (req: Request, res: Response) => {
    try {
      const otherId = requiredStringParam(req, "otherId");
      if (!otherId) {
        res.status(400).json({ error: "INVALID_PAYLOAD" });
        return;
      }
      const me = playerIdOf(req);
      await service.unfriend(me, otherId);
      res.status(204).send();
    } catch (err) {
      handle(err, res);
    }
  });

  router.get("/me/friends", async (req: Request, res: Response) => {
    try {
      const me = playerIdOf(req);
      res.json({ friends: await service.listFriends(me) });
    } catch (err) {
      handle(err, res);
    }
  });

  router.get("/me/friends/requests", async (req: Request, res: Response) => {
    try {
      const me = playerIdOf(req);
      res.json({ incoming: await service.listIncomingRequests(me) });
    } catch (err) {
      handle(err, res);
    }
  });

  router.post("/me/blocks", async (req: Request, res: Response) => {
    try {
      const parsed = targetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "INVALID_PAYLOAD" });
        return;
      }
      const me = playerIdOf(req);
      await service.block(me, parsed.data.toPlayerId);
      res.status(204).send();
    } catch (err) {
      handle(err, res);
    }
  });

  return router;
}

// BOLA-safe: a blocked target and a nonexistent target look identical.
function handle(err: unknown, res: Response): void {
  const msg = err instanceof Error ? err.message : String(err);
  logger.warn("Friends route error", { error: msg });

  if (msg === "CANNOT_FRIEND_SELF" || msg === "CANNOT_BLOCK_SELF") {
    res.status(400).json({ error: msg });
    return;
  }
  if (msg === "TOO_MANY_PENDING_REQUESTS") {
    res.status(429).json({ error: msg });
    return;
  }
  if (msg === "FRIEND_CAP_REACHED") {
    res.status(409).json({ error: msg });
    return;
  }
  if (msg === "FRIEND_REQUEST_FAILED") {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  if (msg === "UNAUTHORIZED") {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
}
