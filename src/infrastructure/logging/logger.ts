import { AsyncLocalStorage } from "async_hooks";

export interface LogContext {
  requestId?: string;
  traceId?: string;
  playerId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<LogContext>();

export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

export function getLogContext(): LogContext {
  return asyncLocalStorage.getStore() || {};
}

type LogLevel = "info" | "warn" | "error";

function writeLog(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const context = getLogContext();
  
  // Strict security rule: never log tokens
  const safeMeta = { ...meta };
  if (safeMeta["req"] && typeof safeMeta["req"] === "object") {
    const req = safeMeta["req"] as Record<string, unknown>;
    if (req["headers"]) {
      const headers = req["headers"] as Record<string, unknown>;
      delete headers["authorization"];
      delete headers["cookie"];
    }
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    msg,
    ...context,
    ...safeMeta,
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else if (level === "warn") {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => writeLog("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => writeLog("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => writeLog("error", msg, meta),
};