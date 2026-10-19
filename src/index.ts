import "dotenv/config";
import { loadEnv } from "./config/env";
import { getMongoClient } from "./infrastructure/mongodb/client";
import { logger, runWithLogContext } from "./infrastructure/logging/logger";
import { PlayerService } from "./domain/players/player-service";
import { requirePlayer } from "./infrastructure/auth/middleware";

// Scope note: this milestone ships the service layer, not an HTTP server.
// This entrypoint validates that all wiring loads cleanly (env, Mongo
// client, services, auth middleware) and then exits. Workers, scripts,
// and integration tests consume the same modules directly.
//
// If/when an HTTP server is added, it should be started here, and this
// comment should be deleted rather than kept alongside a real listener.
async function main(): Promise<void> {
  const env = loadEnv();
  const bootId = `boot-${Date.now()}`;

  runWithLogContext({ requestId: bootId, traceId: bootId }, async () => {
    try {
      const client = getMongoClient(env);
      const db = client.db("fps-game-database");
      const playerService = new PlayerService(db);

      logger.info("fps-game-database wiring validated", {
        env: env.NODE_ENV,
        mongoPoolSize: client.options.maxPoolSize,
        hasPlayerService: !!playerService,
        hasMiddleware: !!requirePlayer,
      });

      process.exit(0);
    } catch (err: unknown) {
      logger.error("boot failed", { err: String(err) });
      process.exit(1);
    }
  });
}

main();