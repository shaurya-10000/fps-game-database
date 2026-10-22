import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

export interface ChatReplyRef {
  messageId: string;
  senderId: string;
  senderName: string;
  preview: string;
}

export interface ChatMessage {
  senderName: string;
  _id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  audioUrl?: string;
  system?: boolean;
  replyTo?: ChatReplyRef;
  reactions?: Record<string, string[]>;
  pinned?: { by: string; at: Date };
  editedAt?: Date;
  deleted?: boolean;
}

export interface ChatRoom {
  _id: string;
  type: "global" | "region" | "group";
  name: string;
  members?: string[];
  admins?: string[];
  createdBy?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export const HISTORY_PAGE_SIZE = 50;
export const MAX_MESSAGE_LENGTH = 2000;

export class ChatService {
  constructor(private db: Db) {}

  async ensureIndexes(): Promise<void> {
    const messages = this.db.collection("chatMessages");
    await messages.createIndex({ roomId: 1, createdAt: -1 });
    await messages.createIndex(
      { roomId: 1, "pinned.at": -1 },
      { partialFilterExpression: { "pinned.at": { $exists: true } }, name: "chat_pinned_by_room" },
    );

    const rooms = this.db.collection<ChatRoom>("chatRooms");

    // Group names are not unique (two groups may both be called "Squad"), so the
    // old unique { type, name } index is replaced by one that only covers global/region rooms.
    const existing = await rooms.indexes();
    const legacy = existing.find((index) => index.name === "type_1_name_1" && !index.partialFilterExpression);
    if (legacy) await rooms.dropIndex("type_1_name_1");
    await rooms.createIndex(
      { type: 1, name: 1 },
      {
        unique: true,
        name: "chat_rooms_unique_global_region",
        partialFilterExpression: { type: { $in: ["global", "region"] } },
      },
    );
    await rooms.createIndex({ type: 1, members: 1 }, { name: "chat_rooms_group_members" });

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

  async saveMessage(roomId: string, senderId: string, content: string, replyToId?: string): Promise<ChatMessage> {
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

    if (replyToId) {
      const target = await this.db
        .collection("chatMessages")
        .findOne({ _id: replyToId as never, roomId, deleted: { $ne: true } });
      if (target) {
        const targetSenderId = String(target["senderId"]);
        const targetPlayer = await this.db
          .collection<{ _id: string } & Document>("players")
          .findOne({ _id: targetSenderId });
        const preview = target["audioUrl"] ? "Voice message" : String(target["content"] ?? "").slice(0, 140);
        msg.replyTo = {
          messageId: String(target["_id"]),
          senderId: targetSenderId,
          senderName: String(targetPlayer?.["displayName"] ?? target["senderName"] ?? targetSenderId.slice(0, 8)),
          preview,
        };
      }
    }

    await this.db.collection<ChatMessage>("chatMessages").insertOne(msg);
    return msg;
  }

  /** Newest `limit` messages (optionally only those older than `before`), returned newest-first. */
  async getHistory(roomId: string, limit = HISTORY_PAGE_SIZE, before?: Date): Promise<ChatMessage[]> {
    const filter: Document = { roomId };
    if (before) filter["createdAt"] = { $lt: before };

    const msgs = await this.db
      .collection<ChatMessage>("chatMessages")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Fetch display names for any messages missing them
    const senderIds = [...new Set(msgs.map((m) => m.senderId))];
    const players = await this.db
      .collection<{ _id: string; displayName: string } & Document>("players")
      .find({ _id: { $in: senderIds } })
      .toArray();

    const nameMap = new Map(players.map((p) => [p._id, p.displayName]));

    return msgs.map((m) => ({
      ...m,
      senderName: nameMap.get(m.senderId) || m.senderName || m.senderId.slice(0, 8),
    }));
  }
}