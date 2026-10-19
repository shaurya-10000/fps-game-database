import { describe, expect, it, vi, beforeEach } from "vitest";
import { logger, runWithLogContext } from "../../src/infrastructure/logging/logger";

describe("Structured Logging", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("outputs JSON with requestId and playerId from context", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    runWithLogContext({ requestId: "req-123", playerId: "player-456" }, () => {
      logger.info("Match started", { matchId: "match-789" });
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
    
    expect(output.level).toBe("info");
    expect(output.msg).toBe("Match started");
    expect(output.requestId).toBe("req-123");
    expect(output.playerId).toBe("player-456");
    expect(output.matchId).toBe("match-789");
    expect(output.timestamp).toBeDefined();
  });

  it("never logs authorization headers", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    runWithLogContext({ requestId: "req-abc" }, () => {
      logger.info("Incoming request", { 
        req: { 
          headers: { 
            authorization: "Bearer super-secret-token",
            "content-type": "application/json"
          } 
        } 
      });
    });

    const output = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
    
    expect(output.req.headers.authorization).toBeUndefined();
    expect(output.req.headers.cookie).toBeUndefined();
    expect(output.req.headers["content-type"]).toBe("application/json");
  });
});