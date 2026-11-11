import { performance } from "node:perf_hooks";
import type { Db } from "mongodb";
import { logger } from "../infrastructure/logging/logger";
import { MonitoringService } from "../infrastructure/outbox/monitoring";
import type { HealthState, OutboxStatus, ServiceStatus, StatusSnapshot } from "./types";

const CHECK_TIMEOUT_MS = 3_000;
const CACHE_TTL_MS = 10_000;
const SLOW_PING_MS = 1_000;
const STUCK_QUEUE_MS = 60_000;

const SEVERITY: Record<HealthState, number> = { operational: 0, degraded: 1, down: 2 };

export interface SnapshotDeps {
  readonly db: Db;
  readonly environment: string;
  readonly commit: string | null;
  readonly isRealtimeUp: () => boolean;
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function worst(states: readonly HealthState[]): HealthState {
  return states.reduce<HealthState>((acc, s) => (SEVERITY[s] > SEVERITY[acc] ? s : acc), "operational");
}

interface DatabaseCheck {
  readonly service: ServiceStatus;
  readonly latencyMs: number | null;
}

async function checkDatabase(db: Db): Promise<DatabaseCheck> {
  try {
    const started = performance.now();
    await withTimeout(db.command({ ping: 1 }), CHECK_TIMEOUT_MS, "MongoDB ping");
    const latencyMs = Math.round(performance.now() - started);
    const slow = latencyMs > SLOW_PING_MS;
    return {
      latencyMs,
      service: {
        id: "database",
        name: "MongoDB",
        state: slow ? "degraded" : "operational",
        detail: slow ? `Slow response (${latencyMs} ms)` : `Responding in ${latencyMs} ms`,
      },
    };
  } catch (err) {
    logger.warn("Status check failed", { check: "database", error: String(err) });
    return {
      latencyMs: null,
      service: { id: "database", name: "MongoDB", state: "down", detail: "Not responding" },
    };
  }
}

interface OutboxCheck {
  readonly service: ServiceStatus;
  readonly outbox: OutboxStatus | null;
}

async function checkOutbox(db: Db, databaseUp: boolean): Promise<OutboxCheck> {
  const name = "Outbox relay";
  if (!databaseUp) {
    return { outbox: null, service: { id: "outbox", name, state: "degraded", detail: "Unknown while the database is unreachable" } };
  }
  try {
    const m = await withTimeout(new MonitoringService(db).getQueueMetrics(), CHECK_TIMEOUT_MS, "Outbox metrics");
    const outbox: OutboxStatus = { pending: m.pendingDepth, deadLetter: m.deadLetterCount, oldestPendingMs: m.oldestPendingAgeMs };
    const stuck = outbox.deadLetter > 0 || outbox.oldestPendingMs > STUCK_QUEUE_MS;
    return {
      outbox,
      service: {
        id: "outbox",
        name,
        state: stuck ? "degraded" : "operational",
        detail: `${outbox.pending} pending, ${outbox.deadLetter} dead-lettered`,
      },
    };
  } catch (err) {
    logger.warn("Status check failed", { check: "outbox", error: String(err) });
    return { outbox: null, service: { id: "outbox", name, state: "degraded", detail: "Queue metrics unavailable" } };
  }
}

export async function collectSnapshot(deps: SnapshotDeps): Promise<StatusSnapshot> {
  const database = await checkDatabase(deps.db);
  const outbox = await checkOutbox(deps.db, database.latencyMs !== null);

  const realtimeUp = deps.isRealtimeUp();
  const services: ServiceStatus[] = [
    { id: "api", name: "API", state: "operational", detail: "Accepting requests" },
    database.service,
    {
      id: "realtime",
      name: "Realtime (Socket.IO)",
      state: realtimeUp ? "operational" : "down",
      detail: realtimeUp ? "Chat and signaling server attached" : "Not started",
    },
    outbox.service,
  ];

  return {
    overall: worst(services.map((s) => s.state)),
    checkedAt: new Date(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: deps.environment,
    commit: deps.commit,
    dbLatencyMs: database.latencyMs,
    outbox: outbox.outbox,
    services,
  };
}

/**
 * Wraps collectSnapshot in a short-lived cache so a burst of page views (or a
 * crawler) costs one database ping and one metrics query per TTL window.
 */
export function createSnapshotProvider(
  deps: SnapshotDeps,
  ttlMs: number = CACHE_TTL_MS,
  now: () => number = Date.now,
): () => Promise<StatusSnapshot> {
  let cached: { readonly at: number; readonly value: Promise<StatusSnapshot> } | null = null;
  return () => {
    const t = now();
    if (cached && t - cached.at < ttlMs) return cached.value;
    const value = collectSnapshot(deps);
    cached = { at: t, value };
    value.catch(() => {
      if (cached?.value === value) cached = null;
    });
    return value;
  };
}