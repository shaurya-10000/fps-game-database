import { describe, expect, it, afterEach, vi } from "vitest";
import { 
  setFailurePoint, 
  clearFailurePoint, 
  triggerFailurePoint 
} from "../../src/infrastructure/failure-injection";

describe("Failure Injection Harness", () => {
  afterEach(() => {
    clearFailurePoint();
    vi.unstubAllEnvs();
  });

  it("triggers a failure when armed and called", () => {
    // Stub logger to avoid noisy test output
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    setFailurePoint("before-transaction-commit");
    
    expect(() => {
      triggerFailurePoint("before-transaction-commit");
    }).toThrow("Injected Failure: before-transaction-commit");

    // Ensure it only fires once
    expect(() => {
      triggerFailurePoint("before-transaction-commit");
    }).not.toThrow();
  });

  it("is strictly disabled in production", () => {
    // Force NODE_ENV to production
    vi.stubEnv("NODE_ENV", "production");

    expect(() => {
      setFailurePoint("before-transaction-commit");
    }).toThrow("Failure injection is strictly forbidden in production.");
  });
});