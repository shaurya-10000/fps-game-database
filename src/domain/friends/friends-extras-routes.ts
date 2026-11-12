import { Router, Request, Response } from "express";
import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

const LIMIT = 200;

function param(req: Request, key: string): string | null {
  const raw = req.params[key];
  return raw && !Array.isArray(raw) ? raw : null;
}

/**
 * The friend-management endpoints the dashboard needs beyond the basics:
 * outgoing requests, cancelling or declining a request, and the block list.
 */
export function buildFriendsExtrasRouter(db: Db): Router {
  const router = Router();
  const friendships = db.collection("friendships");
  const blocks = db.collection("blocks");

  async function names(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const players = await db
      .collection<{ _id: string } & Document>("players")
      .find({ _id: { $in: ids } }, { projection: { displayName: 1 } })
      .toArray();
    return new Map(players.map((p) => [p._id, String(p["displayName"] ?? "")] as [string, string]));
  }

  const route =
    (fn: (req: Request, res: Response, me: string) => Promise<void>) =>
    async (req: Request, res: Response): Promise<void> => {
      try {
        const me = req.ctx?.player?._id;
        if (!me) {
          res.status(401).json({ error: "UNAUTHORIZED" });
          return;
        }
        await fn(req, res, me);
      } catch (err) {
        logger.error("Friends extras route error", { error: String(err) });
        res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
      }
    };

  // Requests I have sent that are still waiting.
  router.get("/me/friends/requests/outgoing", route(async (_req, res, me) => {
    const rows = await friendships.find({ fromPlayerId: me, status: "pending" }).sort({ createdAt: -1 }).limit(LIMIT).toArray();
    const lookup = await names(rows.map((r) => String(r["toPlayerId"])));
    res.json({
      outgoing: rows.map((r) => ({ ...r, toPlayerName: lookup.get(String(r["toPlayerId"])) || String(r["toPlayerId"]) })),
    });
  }));

  // Cancel a request I sent, or decline one sent to me. Pending requests only: friendships are untouched.
  router.delete("/me/friends/requests/:otherId", route(async (req, res, me) => {
    const other = param(req, "otherId");
    if (!other) {
      res.status(400).json({ error: "INVALID_PAYLOAD" });
      return;
    }
    await friendships.deleteMany({
      status: "pending",
      $or: [
        { fromPlayerId: me, toPlayerId: other },
        { fromPlayerId: other, toPlayerId: me },
      ],
    });
    res.status(204).send();
  }));

  // People I have blocked.
  router.get("/me/blocks", route(async (_req, res, me) => {
    const rows = await blocks.find({ blockerId: me }).sort({ createdAt: -1 }).limit(LIMIT).toArray();
    const lookup = await names(rows.map((r) => String(r["blockedId"])));
    res.json({
      blocked: rows.map((r) => ({
        playerId: String(r["blockedId"]),
        displayName: lookup.get(String(r["blockedId"])) || String(r["blockedId"]).slice(0, 8),
        createdAt: r["createdAt"],
      })),
    });
  }));

  router.delete("/me/blocks/:playerId", route(async (req, res, me) => {
    const target = param(req, "playerId");
    if (!target) {
      res.status(400).json({ error: "INVALID_PAYLOAD" });
      return;
    }
    await blocks.deleteOne({ blockerId: me, blockedId: target });
    res.status(204).send();
  }));

  return router;
}
