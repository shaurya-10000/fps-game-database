import express from "express";
import "dotenv/config";
import { createServer } from "http";
import { loadEnv } from "./config/env";
import { getMongoClient } from "./infrastructure/mongodb/client";
import { logger } from "./infrastructure/logging/logger";
import { CanonicalResultService } from "./domain/matches/canonical-service";
import { PlayerService } from "./domain/players/player-service";
import { FriendshipService } from "./domain/friends/friendship-service";
import { buildFriendsRouter } from "./domain/friends/routes";
import { ChatService } from "./domain/chat/service";
import { initChatSocket } from "./domain/chat/socket";
import { buildProgressionRouter } from "./domain/progression/routes";
import { MasteryService } from "./domain/leaderboards/mastery-service";
import { LeaderboardService } from "./domain/leaderboards/leaderboard-service";
import { buildLeaderboardRouter } from "./domain/leaderboards/routes";
import { IdentityProvider } from "./infrastructure/auth/identity-provider";
import { Context } from "./infrastructure/auth/middleware";

// New Imports for Username DMs
import { DmResolver } from "./domain/chat/dm-resolver";
import { buildChatRouter } from "./domain/chat/routes";

const env = loadEnv();
const client = getMongoClient(env);
const db = client.db("fps-game-database");

const canonicalService = new CanonicalResultService(db);
const playerService = new PlayerService(db);
const friendshipService = new FriendshipService(db);
const chatService = new ChatService(db);
const dmResolver = new DmResolver(db, chatService);
const masteryService = new MasteryService(db);
const leaderboardService = new LeaderboardService(db);
const authProvider = new IdentityProvider(env.AUTH_JWKS_URI, env.AUTH_ISSUER, env.AUTH_AUDIENCE);

const app = express();
app.use(express.json());

// Health check endpoint (public)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", env: env.NODE_ENV });
  return;
});

// Auth Middleware
const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }
    const token = authHeader.split(" ")[1];
    if (!token) { res.status(401).json({ error: "Missing token" }); return; }
    const principal = await authProvider.verify(token);
    const player = await playerService.resolvePlayer(principal);
    
    // Attach to request for the route handler
    req.ctx = { principal, player } as Context;
    next();
  } catch (err) {
    logger.warn("Auth failed", { error: String(err) });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
};

// Mount Routers
app.use("/api", authMiddleware, buildFriendsRouter(friendshipService));
app.use("/api", authMiddleware, buildProgressionRouter(db));
app.use("/api", authMiddleware, buildChatRouter(dmResolver));
app.use("/api", authMiddleware, buildLeaderboardRouter(leaderboardService));

// Match result endpoint (secured)
app.post("/internal/matches/:matchId/result", authMiddleware, async (req, res): Promise<void> => {
  try {
    const rawMatchId = req.params["matchId"];
    if (!rawMatchId || Array.isArray(rawMatchId)) {
      res.status(400).json({ error: "Missing or invalid matchId parameter" });
      return;
    }
    const matchId = rawMatchId as string;
    const idempotencyKey = req.header("X-Idempotency-Key");
    const fingerprint = req.header("X-Request-Fingerprint");

    if (!idempotencyKey || !fingerprint) {
      res.status(400).json({ error: "Missing Idempotency headers" });
      return;
    }

    const payload = { matchId, gameModeId: req.body.gameModeId, participants: req.body.participants };
    const result = await canonicalService.acceptResult(payload, idempotencyKey, fingerprint);

    res.status(200).json(result);
    return;
  } catch (err: unknown) {
    logger.error("Failed to accept result", { error: String(err) });
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
});

export function startServer() {
  const server = createServer(app);
  
  masteryService.ensureIndexes().catch((err: unknown) => logger.error("Failed to init mastery indexes", { error: String(err) }));
  chatService.ensureIndexes().catch((err: unknown) => logger.error("Failed to init chat indexes", { error: String(err) }));

  initChatSocket(server, chatService, authProvider, playerService);

  server.listen(env.PORT, () => {
    logger.info(`Server and Chat listening on port ${env.PORT}`);
  });
  return server;
}


