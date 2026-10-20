import { Db } from "mongodb";
import { ChatService } from "./service";

export class DmResolver {
  constructor(private db: Db, private chatService: ChatService) {}

  /**
   * Resolves the DM room for a known player ID. Used by the Friends page,
   * because display names are not unique. Same BOLA-safe errors as the
   * username lookup: a missing player and a block look identical.
   */
  async resolveDmRoomIdByPlayerId(
    senderId: string,
    targetId: string
  ): Promise<{ roomId: string; targetName: string }> {
    if (targetId === senderId) {
      throw new Error("CANNOT_DM_SELF");
    }

    const target = await this.db
      .collection<{ _id: string; displayName: string }>("players")
      .findOne({ _id: targetId });
    if (!target) {
      throw new Error("FRIEND_REQUEST_FAILED");
    }

    const blocked = await this.db.collection("blocks").findOne({
      $or: [
        { blockerId: senderId, blockedId: targetId },
        { blockerId: targetId, blockedId: senderId },
      ],
    });
    if (blocked) {
      throw new Error("FRIEND_REQUEST_FAILED");
    }

    const roomId = await this.chatService.getDmRoomId(senderId, target._id);
    return { roomId, targetName: target.displayName };
  }

  /**
   * Takes a sender's ID and the recipient's displayName (username).
   * Returns the deterministic DM room ID, or throws if the user doesn't exist.
   */
  async resolveDmRoomIdByUsername(senderId: string, targetUsername: string): Promise<string> {
    const playersCol = this.db.collection<{ _id: string; displayName: string }>("players");
    
    // 1. Look up the target player by their unique username
    const targetPlayer = await playersCol.findOne({ displayName: targetUsername });
    
    if (!targetPlayer) {
      // BOLA-safe: We use the exact same error as a block so they can't enumerate usernames
      throw new Error("FRIEND_REQUEST_FAILED"); 
    }

    // 2. Prevent DMing yourself
    if (targetPlayer._id === senderId) {
      throw new Error("CANNOT_DM_SELF");
    }

    // 3. Generate the deterministic room ID (sorts IDs alphabetically)
    return this.chatService.getDmRoomId(senderId, targetPlayer._id);
  }
}
