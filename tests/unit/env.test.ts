import { describe, expect, it, vi } from "vitest";
import { loadEnv } from "../../src/config/env";

describe("Environment configuration", () => {
  it("throws an error if MONGODB_URI is missing in production", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      loadEnv({ 
        NODE_ENV: "production",
        AUTH_JWKS_URI: "https://test.com/jwks",
        AUTH_ISSUER: "https://test.com/",
        AUTH_AUDIENCE: "test-api"
      });
    }).toThrow("Invalid environment variables");

    consoleSpy.mockRestore();
  });

  it("uses the dev fallback for MONGODB_URI when NODE_ENV is not production", () => {
    const env = loadEnv({ 
      NODE_ENV: "development",
      AUTH_JWKS_URI: "https://test.com/jwks",
      AUTH_ISSUER: "https://test.com/",
      AUTH_AUDIENCE: "test-api"
    });
    
    expect(env.MONGODB_URI).toBe("mongodb://localhost:27017/fps_test");
    expect(env.PORT).toBe(3000);
  });
});