import { logger } from "../logging/logger";

export type FailurePoint = 
  | "before-transaction-commit" 
  | "before-projection-commit"
  | "commit-succeeded-acknowledgment-lost";

let injectedFailure: FailurePoint | null = null;

export function setFailurePoint(point: FailurePoint): void {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("Failure injection is strictly forbidden in production.");
  }
  injectedFailure = point;
  logger.warn(`Failure point armed: ${point}`);
}

export function clearFailurePoint(): void {
  injectedFailure = null;
}

export function triggerFailurePoint(point: FailurePoint): void {
  if (injectedFailure === point) {
    logger.error(`Triggering injected failure at: ${point}`);
    injectedFailure = null; 
    throw new Error(`Injected Failure: ${point}`);
  }
}
