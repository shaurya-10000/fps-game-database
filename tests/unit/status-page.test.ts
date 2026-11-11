import { describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import { formatUptime, renderStatusPage } from "../../src/status/StatusPage";
import { collectSnapshot, createSnapshotProvider } from "../../src/status/snapshot";
import type { StatusSnapshot } from "../../src/status/types";

function fakeDb(overrides: { ping?: () => Promise<unknown>; dead?: number } = {}): { db: Db; ping: ReturnType<typeof vi.fn> } {
  const ping = vi.fn(overrides.ping ?? (() => Promise.resolve({ ok: 1 })));
  const collection = {
    countDocuments: vi.fn((filter: { status: string }) => Promise.resolve(filter.status === "dead_letter" ? (overrides.dead ?? 0) : 0)),
    findOne: vi.fn(() => Promise.resolve(null)),
  };
  const db = { command: ping, collection: () => collection } as unknown as Db;
  return { db, ping };
}

const deps = (db: Db, realtime = true) => ({ db, environment: "test", commit: "abcdef123456", isRealtimeUp: () => realtime });

describe("status snapshot", () => {
  it("reports every service operational when checks pass", async () => {
    const snapshot = await collectSnapshot(deps(fakeDb().db));
    expect(snapshot.overall).toBe("operational");
    expect(snapshot.services.map((s) => s.id)).toEqual(["api", "database", "realtime", "outbox"]);
    expect(snapshot.outbox).toEqual({ pending: 0, deadLetter: 0, oldestPendingMs: 0 });
  });

  it("degrades when dead letters are waiting", async () => {
    const snapshot = await collectSnapshot(deps(fakeDb({ dead: 3 }).db));
    expect(snapshot.overall).toBe("degraded");
    expect(snapshot.outbox?.deadLetter).toBe(3);
  });

  it("is down when the database does not respond", async () => {
    const { db } = fakeDb({ ping: () => Promise.reject(new Error("boom")) });
    const snapshot = await collectSnapshot(deps(db));
    expect(snapshot.overall).toBe("down");
    expect(snapshot.dbLatencyMs).toBeNull();
    expect(snapshot.outbox).toBeNull();
  });

  it("is down when the realtime server is not attached", async () => {
    const snapshot = await collectSnapshot(deps(fakeDb().db, false));
    expect(snapshot.overall).toBe("down");
  });

  it("caches within the TTL and refreshes after it", async () => {
    const { db, ping } = fakeDb();
    let clock = 1_000;
    const get = createSnapshotProvider(deps(db), 10_000, () => clock);
    await get();
    clock += 5_000;
    await get();
    expect(ping).toHaveBeenCalledTimes(1);
    clock += 6_000;
    await get();
    expect(ping).toHaveBeenCalledTimes(2);
  });
});

describe("status page", () => {
  it("renders headline, services and metrics", async () => {
    const snapshot = await collectSnapshot(deps(fakeDb().db));
    const html = renderStatusPage(snapshot);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("All systems operational");
    expect(html).toContain("Realtime (Socket.IO)");
    expect(html).toContain("abcdef1");
    expect(html).toContain('href="/health"');
  });

  it("renders the outage headline", () => {
    const snapshot: StatusSnapshot = {
      overall: "down", checkedAt: new Date("2026-11-11T12:00:00Z"), uptimeSeconds: 5, environment: "production",
      commit: null, dbLatencyMs: null, outbox: null, services: [],
    };
    const html = renderStatusPage(snapshot);
    expect(html).toContain("Major outage");
    expect(html).toContain("2026-11-11 12:00:00 UTC");
  });

  it("formats uptime compactly", () => {
    expect(formatUptime(45)).toBe("45s");
    expect(formatUptime(3_700)).toBe("1h 1m");
    expect(formatUptime(200_000)).toBe("2d 7h");
  });
});