import { Db } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

export interface ChatMessage {
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
    const msg: ChatMessage = {
      _id: `msg_${crypto.randomUUID()}`,
      roomId,
      senderId,
      content,
      createdAt: new Date(),
    };

    await this.db.collection<ChatMessage>("chatMessages").insertOne(msg);
    return msg;
  }

  async getHistory(roomId: string, limit = 50): Promise<ChatMessage[]> {
    return this.db
      .collection<ChatMessage>("chatMessages")
      .find({ roomId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}
