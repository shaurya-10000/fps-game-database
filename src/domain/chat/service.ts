import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

export interface ChatMessage {
  senderName: string;
  _id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

export interface ChatRoom {
  _id: string;
  type: "global" | "region" | "group";
  name: string;
  members?: string[];
  createdAt: Date;
}

export class ChatService {
  constructor(private db: Db) {}

  async ensureIndexes(): Promise<void> {
    const messages = this.db.collection("chatMessages");
    await messages.createIndex({ roomId: 1, createdAt: -1 });
    
    const rooms = this.db.collection<ChatRoom>("chatRooms");
    await rooms.createIndex({ type: 1, name: 1 }, { unique: true });

    // Ensure the Global room exists
    const globalRoom = await rooms.findOne({ type: "global" });
    if (!globalRoom) {
      await rooms.insertOne({
        _id: "global_chat",
        type: "global",
        name: "Global Chat",
        createdAt: new Date(),
      });
      logger.info("Created global chat room");
    }
  }

  async getOrCreateRegionRoom(regionName: string): Promise<string> {
    const rooms = this.db.collection<ChatRoom>("chatRooms");
    const id = `region_${regionName.toLowerCase()}`;
    
    const existing = await rooms.findOne({ _id: id });
    if (!existing) {
      await rooms.insertOne({
        _id: id,
        type: "region",
        name: `${regionName} Region`,
        createdAt: new Date(),
      });
    }
    return id;
  }

  getDmRoomId(userA: string, userB: string): string {
    const sorted = [userA, userB].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
  }

  async saveMessage(roomId: string, senderId: string, content: string): Promise<ChatMessage> {
    // Fetch the player's display name
    const player = await this.db.collection<{ _id: string } & Document>("players").findOne({ _id: senderId });
    const senderName = player ? player["displayName"] : senderId.slice(0, 8);

    const msg: ChatMessage = {
      _id: `msg_${crypto.randomUUID()}`,
      roomId,
      senderId,
      senderName,
      content,
      createdAt: new Date(),
    };

    await this.db.collection<ChatMessage>("chatMessages").insertOne(msg);
    return msg;
  }

  async getHistory(roomId: string, limit = 50): Promise<ChatMessage[]> {
    const msgs = await this.db
      .collection<ChatMessage>("chatMessages")
      .find({ roomId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
      
    // Fetch display names for any messages missing them
    const senderIds = [...new Set(msgs.map(m => m.senderId))];
    const players = await this.db
      .collection<{ _id: string; displayName: string } & Document>("players")
      .find({ _id: { $in: senderIds } })
      .toArray();
      
    const nameMap = new Map(players.map(p => [p._id, p.displayName]));

    return msgs.map(m => ({
      ...m,
      senderName: nameMap.get(m.senderId) || m.senderName || m.senderId.slice(0, 8)
    }));
  }
}
