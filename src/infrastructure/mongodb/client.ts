import { MongoClient } from "mongodb";
import { Env } from "../../config/env";

let client: MongoClient | null = null;

export function getMongoClient(env: Env): MongoClient {
  if (client) {
    return client;
  }

  client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    maxConnecting: env.MONGODB_MAX_CONNECTING,
    waitQueueTimeoutMS: env.MONGODB_WAIT_QUEUE_TIMEOUT_MS,
  });

  return client;
}

// Used strictly for testing teardown to prevent hanging Vitest processes
export async function closeMongoClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}