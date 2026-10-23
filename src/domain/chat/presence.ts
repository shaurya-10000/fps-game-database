import type { Db } from "mongodb";

/** Which players have at least one open socket. In memory, so it is per server instance. */
const connections = new Map<string, number>();

export const presence = {
  isOnline(playerId: string): boolean {
    return connections.has(playerId);
  },
  /** Returns true when this is the player's first open connection. */
  connect(playerId: string): boolean {
    const next = (connections.get(playerId) ?? 0) + 1;
    connections.set(playerId, next);
    return next === 1;
  },
  /** Returns true when that was the player's last open connection. */
  disconnect(playerId: string): boolean {
    const next = (connections.get(playerId) ?? 0) - 1;
    if (next <= 0) {
      connections.delete(playerId);
      return true;
    }
    connections.set(playerId, next);
    return false;
  },
};

export async function friendIdsOf(db: Db, playerId: string): Promise<string[]> {
  const rows = await db
    .collection("friendships")
    .find({ fromPlayerId: playerId, status: "accepted" }, { projection: { toPlayerId: 1 } })
    .toArray();
  return rows.map((row) => String(row["toPlayerId"]));
}