import { Db } from "mongodb";

/**
 * Whether a player may read or write a chat room.
 * - DM rooms are `dm_<idA>_<idB>`: only the two participants.
 * - Group rooms: members only.
 * - Global and region rooms: everyone.
 * Anything else is denied.
 */
export async function canAccessRoom(db: Db, playerId: string, roomId: string): Promise<boolean> {
  if (!playerId || !roomId) return false;

  if (roomId.startsWith("dm_")) {
    const rest = roomId.slice(3);
    return rest.startsWith(`${playerId}_`) || rest.endsWith(`_${playerId}`);
  }

  if (roomId.startsWith("group_")) {
    const room = await db.collection("chatRooms").findOne({ _id: roomId as never, type: "group", members: playerId });
    return room !== null;
  }

  return roomId === "global_chat" || roomId.startsWith("region_");
}