import { Db } from "mongodb";
import { ChatService } from "./service";

export class DmResolver {
  constructor(private db: Db, private chatService: ChatService) {}

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
