import express from "express";
import cors from "cors";
import "dotenv/config";
import { createServer } from "http";
import { Db } from "mongodb";
import multer from "multer";
import fs from "fs";
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
import { DmResolver } from "./domain/chat/dm-resolver";
import { buildChatRouter } from "./domain/chat/routes";
import { buildChatExtrasRouter } from "./domain/chat/chat-extras";
import { canAccessRoom } from "./domain/chat/room-access";
import { AuthService } from "./domain/auth/auth-service";
import { buildAuthRouter } from "./domain/auth/routes";

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
const authService = new AuthService(db);

const app = express();
app.locals['db'] = db;
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const upload = multer({ dest: "uploads/" });
if (!fs.existsSync("uploads")) { fs.mkdirSync("uploads"); }

// Health check
app.get("/health", (req, res) => { res.status(200).json({ status: "ok", env: env.NODE_ENV }); return; });

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
    req.ctx = { principal, player } as Context;
    next();
  } catch (err) {
    logger.warn("Auth failed", { error: String(err) });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
};

// Mount Auth Router
app.use("/api", buildAuthRouter(authService));

// Profile Updates
app.get("/api/me/profile", authMiddleware, async (req, res) => {
  try {
    const playerId = req.ctx?.player?._id;
    if (!playerId) { res.status(401).json({ error: "UNAUTHORIZED" }); return; }
    const db = req.app.locals['db'] as Db;
    type Doc = { _id: string } & import("mongodb").Document;
    const p = await db.collection<Doc>("players").findOne({ _id: playerId });
    res.json({ playerId, displayName: p?.["displayName"] ?? "", username: p?.["username"] ?? "" });
  } catch (err) {
    logger.error("Profile fetch failed", { error: String(err) });
    res.status(500).json({ error: "FETCH_FAILED" });
  }
});

app.patch("/api/me/profile", authMiddleware, async (req, res) => {
  try {
    const { displayName, username, email } = req.body ?? {};
    const playerId = req.ctx?.player?._id;
    if (!playerId) { res.status(401).json({ error: "UNAUTHORIZED" }); return; }
    const db = req.app.locals['db'] as Db;
    type Doc = { _id: string } & import("mongodb").Document;

    const nextDisplay = typeof displayName === "string" ? displayName.trim() : "";
    const nextUsername = typeof username === "string" ? username.trim() : "";

    if (nextDisplay && (nextDisplay.length < 2 || nextDisplay.length > 32)) {
      res.status(400).json({ error: "NAME_TOO_SHORT" });
      return;
    }
    if (nextUsername && !/^[A-Za-z0-9_]{2,24}$/.test(nextUsername)) {
      res.status(400).json({ error: "INVALID_USERNAME" });
      return;
    }

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (nextDisplay) set["displayName"] = nextDisplay;   // not unique
    if (nextUsername) set["username"] = nextUsername;    // unique

    try {
      await db.collection<Doc>("players").updateOne({ _id: playerId }, { $set: set });
    } catch (err: any) {
      if (err?.code === 11000) {
        const key = Object.keys(err.keyPattern ?? {})[0];
        logger.warn("Duplicate key on profile update", { key: String(key) });
        if (key === "username") { res.status(409).json({ error: "USERNAME_TAKEN" }); return; }
        res.status(409).json({ error: "DISPLAY_NAME_INDEX_STILL_UNIQUE" });
        return;
      }
      throw err;
    }

    if (typeof email === "string" && email.includes("@")) {
      try {
        await db.collection<Doc>("authCredentials").updateOne(
          { playerId },
          { $set: { email: email.trim().toLowerCase() } }
        );
      } catch (err: any) {
        if (err?.code === 11000) { res.status(409).json({ error: "EMAIL_IN_USE" }); return; }
        throw err;
      }
    }

    res.json({ success: true });
  } catch (err) {
    logger.error("Profile update failed", { error: String(err) });
    res.status(500).json({ error: "UPDATE_FAILED" });
  }
});
// Player Search
app.get("/api/me/players/search", authMiddleware, async (req, res) => {
  try {
    const q = req.query["q"] as string;
    if (!q || q.length < 2) { res.json({ results: [] }); return; }
    const db = req.app.locals['db'] as Db;
    const myId = req.ctx?.player?._id || "";
    const players = await db.collection<{ _id: string, displayName: string } & import("mongodb").Document>("players").find({ 
      displayName: { $regex: "^" + q, $options: "i" },
      _id: { $ne: myId }
    }).project({ _id: 1, displayName: 1 }).limit(20).toArray();
    res.json({ results: players });
  } catch (err) { res.status(500).json({ error: "INTERNAL_SERVER_ERROR" }); }
});

// Chat Extras: Voice & Groups
app.post("/api/chat/rooms/:roomId/voice", authMiddleware, upload.single("audio"), async (req, res) => {
  try {
    const roomId = req.params["roomId"] as string;
    const playerId = req.ctx?.player?._id;
    if (!playerId) { res.status(401).json({ error: "UNAUTHORIZED" }); return; }
    if (!(await canAccessRoom(req.app.locals['db'] as Db, playerId, roomId))) {
      if (req.file) fs.unlink(req.file.path, () => undefined);
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    if (!req.file) { res.status(400).json({ error: "No audio file" }); return; }
    
    const url = `${process.env["BACKEND_URL"] || "http://localhost:3000"}/uploads/${req.file.filename}`;
    const db = req.app.locals['db'] as Db;
    
    const player = await db.collection<{ _id: string, displayName: string } & import("mongodb").Document>("players").findOne({ _id: playerId });
    const senderName = player ? player["displayName"] : playerId.slice(0,8);

    const msgId = `msg_${crypto.randomUUID()}`;
    const msg = {
      _id: msgId, roomId, senderId: playerId, senderName,
      content: "🎤 Voice Message", audioUrl: url, createdAt: new Date()
    };
    await db.collection<{ _id: string } & import("mongodb").Document>("chatMessages").insertOne(msg);
    
    const io = req.app.locals["io"] as any;
    if (io) io.to(roomId).emit("new_message", msg);
    
    res.json({ messageId: msgId, url });
  } catch (err) { res.status(500).json({ error: "VOICE_UPLOAD_FAILED" }); }
});

app.post("/api/chat/groups-legacy", authMiddleware, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const creatorId = req.ctx?.player?._id;
    if (!name || !memberIds || !Array.isArray(memberIds)) { res.status(400).json({ error: "INVALID_PAYLOAD" }); return; }

    const db = req.app.locals['db'] as Db;
    const roomId = `group_${crypto.randomUUID()}`;
    await db.collection<{ _id: string } & import("mongodb").Document>("chatRooms").insertOne({
      _id: roomId, type: "group", name, members: [creatorId, ...memberIds], createdAt: new Date()
    });
    res.json({ roomId, name, type: "group" });
  } catch (err) { res.status(500).json({ error: "GROUP_CREATE_FAILED" }); }
});

// Mount Other Routers
app.use("/api", authMiddleware, buildFriendsRouter(friendshipService));
app.use("/api", authMiddleware, buildProgressionRouter(db));
app.use("/api", authMiddleware, buildChatRouter(dmResolver));
app.use("/api", authMiddleware, buildChatExtrasRouter(db));
app.use("/api", authMiddleware, buildLeaderboardRouter(leaderboardService));

// Match result
app.post("/internal/matches/:matchId/result", authMiddleware, async (req, res): Promise<void> => {
  try {
    const rawMatchId = req.params["matchId"];
    if (!rawMatchId || Array.isArray(rawMatchId)) { res.status(400).json({ error: "Missing or invalid matchId parameter" }); return; }
    const matchId = rawMatchId as string;
    const idempotencyKey = req.header("X-Idempotency-Key");
    const fingerprint = req.header("X-Request-Fingerprint");
    if (!idempotencyKey || !fingerprint) { res.status(400).json({ error: "Missing Idempotency headers" }); return; }

    const payload = { matchId, gameModeId: req.body.gameModeId, participants: req.body.participants };
    const result = await canonicalService.acceptResult(payload, idempotencyKey, fingerprint);
    res.status(200).json(result);
  } catch (err: unknown) {
    logger.error("Failed to accept result", { error: String(err) });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export function startServer() {
  const server = createServer(app);
  masteryService.ensureIndexes().catch((err: unknown) => logger.error("Failed to init mastery indexes", { error: String(err) }));
  chatService.ensureIndexes().catch((err: unknown) => logger.error("Failed to init chat indexes", { error: String(err) }));

  const io = initChatSocket(server, chatService, authProvider, playerService, db);
  app.locals['io'] = io;

  server.listen(env.PORT, () => { logger.info(`Server and Chat listening on port ${env.PORT}`); });
  return server;
}