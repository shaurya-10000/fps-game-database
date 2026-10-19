import express from "express";
import "dotenv/config";
import { loadEnv } from "./config/env";
import { getMongoClient } from "./infrastructure/mongodb/client";
import { logger } from "./infrastructure/logging/logger";
import { CanonicalResultService } from "./domain/matches/canonical-service";

const env = loadEnv();
const client = getMongoClient(env);
const db = client.db("fps-game-database");
const canonicalService = new CanonicalResultService(db);

const app = express();
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", env: env.NODE_ENV });
  return;
});

// Match result endpoint
app.post("/internal/matches/:matchId/result", async (req, res): Promise<void> => {
  try {
    const matchId = req.params.matchId;
    const idempotencyKey = req.header("X-Idempotency-Key");
    const fingerprint = req.header("X-Request-Fingerprint");

    if (!idempotencyKey || !fingerprint) {
      res.status(400).json({ error: "Missing Idempotency headers" });
      return;
    }

    const payload = { matchId, participants: req.body.participants };
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
  const server = app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });
  return server;
}