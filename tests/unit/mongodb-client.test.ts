import { describe, expect, it, afterAll } from "vitest";
import { getMongoClient, closeMongoClient } from "../../src/infrastructure/mongodb/client";
import { Env } from "../../src/config/env";

const mockEnv: Env = {
  NODE_ENV: "test",
  PORT: 3000,
  MONGODB_URI: "mongodb://localhost:27017/test",
  MONGODB_MAX_POOL_SIZE: 50,
  MONGODB_MAX_CONNECTING: 5,
  MONGODB_WAIT_QUEUE_TIMEOUT_MS: 10000,
  AUTH_JWKS_URI: "https://test.com/jwks",
  AUTH_ISSUER: "https://test.com/",
  AUTH_AUDIENCE: "test-api"
};

describe("MongoDB Client Management", () => {
  afterAll(async () => {
    await closeMongoClient();
  });

  it("returns a singleton instance", () => {
    const client1 = getMongoClient(mockEnv);
    const client2 = getMongoClient(mockEnv);
    expect(client1).toBe(client2);
  });

  it("applies pool configuration from env", () => {
    const client = getMongoClient(mockEnv);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (client as any).options;
    
    expect(options.maxPoolSize).toBe(50);
    expect(options.maxConnecting).toBe(5);
    expect(options.waitQueueTimeoutMS).toBe(10000);
  });
});