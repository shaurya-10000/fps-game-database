import { Router, Request, Response } from "express";
import { Db, Document } from "mongodb";
import { z } from "zod";
import { logger } from "../../infrastructure/logging/logger";
import { HISTORY_PAGE_SIZE, MAX_MESSAGE_LENGTH, type ChatRoom } from "./service";
import { canAccessRoom } from "./room-access";

/** Reactions are limited to this fixed set so arbitrary text can never become a database key. */
export const REACTION_EMOJIS = [
  "\u{1F44D}",
  "\u2764\uFE0F",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F64F}",
  "\u{1F525}",
  "\u{1F389}",
] as const;

const MAX_GROUP_MEMBERS = 50;
const MAX_PINS_PER_ROOM = 50;

interface Io {
  to(room: string): { emit(event: string, payload: unknown): void };
  in(room: string): { socketsLeave(room: string): void };
}

export interface GroupMemberView {
  playerId: string;
  name: string;
  isAdmin: boolean;
}

export interface GroupView {
  roomId: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  members: GroupMemberView[];
}

class ChatExtrasError extends Error {}

function fail(code: string): never {
  throw new ChatExtrasError(code);
}

export class ChatExtrasService {
  constructor(private db: Db) {}

  private rooms() {
    return this.db.collection<ChatRoom>("chatRooms");
  }

  private messages() {
    return this.db.collection<{ _id: string } & Document>("chatMessages");
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const players = await this.db
      .collection<{ _id: string } & Document>("players")
      .find({ _id: { $in: unique } }, { projection: { displayName: 1 } })
      .toArray();
    return new Map(players.map((p) => [p._id, String(p["displayName"] ?? "")] as [string, string]));
  }

  private async nameOf(id: string): Promise<string> {
    return (await this.names([id])).get(id) || id.slice(0, 8);
  }

  private async requireAccess(playerId: string, roomId: string): Promise<void> {
    if (!(await canAccessRoom(this.db, playerId, roomId))) fail("FORBIDDEN");
  }

  private toView(room: ChatRoom, names: Map<string, string>): GroupView {
    const admins = room.admins ?? [];
    return {
      roomId: room._id,
      name: room.name,
      createdBy: room.createdBy ?? "",
      createdAt: room.createdAt,
      members: (room.members ?? []).map((id) => ({
        playerId: id,
        name: names.get(id) || id.slice(0, 8),
        isAdmin: admins.includes(id),
      })),
    };
  }

  private async memberGroup(playerId: string, roomId: string): Promise<ChatRoom> {
    const room = await this.rooms().findOne({ _id: roomId, type: "group", members: playerId });
    if (!room) fail("NOT_FOUND");
    return room;
  }

  private async areFriends(playerId: string, ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const count = await this.db.collection("friendships").countDocuments({
      fromPlayerId: playerId,
      toPlayerId: { $in: ids },
      status: "accepted",
    });
    return count === ids.length;
  }

  private notifyMembers(io: Io | null, memberIds: string[], roomId: string): void {
    if (!io) return;
    for (const id of new Set(memberIds)) io.to(id).emit("group_updated", { roomId });
  }

  private async postSystem(roomId: string, text: string, io: Io | null): Promise<void> {
    const msg = {
      _id: `msg_${crypto.randomUUID()}`,
      roomId,
      senderId: "system",
      senderName: "System",
      content: text,
      system: true,
      createdAt: new Date(),
    };
    await this.messages().insertOne(msg);
    io?.to(roomId).emit("new_message", msg);
  }

  // ------------------------------------------------------------------- groups

  async listGroups(playerId: string): Promise<GroupView[]> {
    const rooms = await this.rooms()
      .find({ type: "group", members: playerId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(200)
      .toArray();
    const names = await this.names(rooms.flatMap((r) => r.members ?? []));
    return rooms.map((r) => this.toView(r, names));
  }

  async getGroup(playerId: string, roomId: string): Promise<GroupView> {
    const room = await this.memberGroup(playerId, roomId);
    const names = await this.names(room.members ?? []);
    return this.toView(room, names);
  }

  async createGroup(creatorId: string, name: string, memberIds: string[], io: Io | null): Promise<GroupView> {
    const others = [...new Set(memberIds)].filter((id) => id !== creatorId);
    if (others.length === 0) fail("INVALID_PAYLOAD");
    if (others.length + 1 > MAX_GROUP_MEMBERS) fail("GROUP_FULL");
    if (!(await this.areFriends(creatorId, others))) fail("NOT_FRIENDS");

    const now = new Date();
    const room: ChatRoom = {
      _id: `group_${crypto.randomUUID()}`,
      type: "group",
      name,
      members: [creatorId, ...others],
      admins: [creatorId],
      createdBy: creatorId,
      createdAt: now,
      updatedAt: now,
    };
    await this.rooms().insertOne(room);

    const names = await this.names(room.members ?? []);
    const creatorName = names.get(creatorId) || "Someone";
    await this.postSystem(room._id, `${creatorName} created the group "${name}"`, io);
    this.notifyMembers(io, room.members ?? [], room._id);
    return this.toView(room, names);
  }

  async renameGroup(actorId: string, roomId: string, name: string, io: Io | null): Promise<void> {
    const room = await this.memberGroup(actorId, roomId);
    if (!(room.admins ?? []).includes(actorId)) fail("FORBIDDEN");
    await this.rooms().updateOne({ _id: roomId }, { $set: { name, updatedAt: new Date() } });
    await this.postSystem(roomId, `${await this.nameOf(actorId)} renamed the group to "${name}"`, io);
    this.notifyMembers(io, room.members ?? [], roomId);
  }

  async addMembers(actorId: string, roomId: string, memberIds: string[], io: Io | null): Promise<void> {
    const room = await this.memberGroup(actorId, roomId);
    const current = room.members ?? [];
    const fresh = [...new Set(memberIds)].filter((id) => !current.includes(id));
    if (fresh.length === 0) fail("INVALID_PAYLOAD");
    if (current.length + fresh.length > MAX_GROUP_MEMBERS) fail("GROUP_FULL");
    if (!(await this.areFriends(actorId, fresh))) fail("NOT_FRIENDS");

    await this.rooms().updateOne({ _id: roomId }, { $addToSet: { members: { $each: fresh } }, $set: { updatedAt: new Date() } });
    const names = await this.names([actorId, ...fresh]);
    const added = fresh.map((id) => names.get(id) || id.slice(0, 8)).join(", ");
    await this.postSystem(roomId, `${names.get(actorId) || "Someone"} added ${added}`, io);
    this.notifyMembers(io, [...current, ...fresh], roomId);
  }

  /** Removes `targetId`. A player removing themselves is "leaving". */
  async removeMember(actorId: string, roomId: string, targetId: string, io: Io | null): Promise<void> {
    const room = await this.memberGroup(actorId, roomId);
    const members = room.members ?? [];
    const admins = room.admins ?? [];
    if (!members.includes(targetId)) fail("NOT_FOUND");

    const leaving = actorId === targetId;
    if (!leaving && !admins.includes(actorId)) fail("FORBIDDEN");

    const remaining = members.filter((id) => id !== targetId);
    const names = await this.names([actorId, targetId]);

    if (remaining.length === 0) {
      await this.rooms().deleteOne({ _id: roomId });
      await this.messages().deleteMany({ roomId });
    } else {
      let nextAdmins = admins.filter((id) => id !== targetId);
      if (nextAdmins.length === 0) nextAdmins = [remaining[0] as string];
      await this.rooms().updateOne(
        { _id: roomId },
        { $set: { members: remaining, admins: nextAdmins, updatedAt: new Date() } },
      );
      const text = leaving
        ? `${names.get(actorId) || "Someone"} left the group`
        : `${names.get(actorId) || "Someone"} removed ${names.get(targetId) || "a member"}`;
      await this.postSystem(roomId, text, io);
    }

    // The removed player must stop receiving this room's live messages immediately.
    io?.in(targetId).socketsLeave(roomId);
    this.notifyMembers(io, members, roomId);
  }

  // ----------------------------------------------------------------- messages

  async history(playerId: string, roomId: string, before: Date | null, limit: number): Promise<Document[]> {
    await this.requireAccess(playerId, roomId);
    const filter: Document = { roomId };
    if (before) filter["createdAt"] = { $lt: before };
    const docs = await this.messages().find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
    return this.withNames(docs).then((list) => list.reverse());
  }

  async search(playerId: string, roomId: string, query: string): Promise<Document[]> {
    await this.requireAccess(playerId, roomId);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const docs = await this.messages()
      .find({ roomId, deleted: { $ne: true }, system: { $ne: true }, content: { $regex: escaped, $options: "i" } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return this.withNames(docs);
  }

  async listPins(playerId: string, roomId: string): Promise<Document[]> {
    await this.requireAccess(playerId, roomId);
    const docs = await this.messages()
      .find({ roomId, "pinned.at": { $exists: true }, deleted: { $ne: true } })
      .sort({ "pinned.at": -1 })
      .limit(MAX_PINS_PER_ROOM)
      .toArray();
    return this.withNames(docs);
  }

  private async withNames(docs: Document[]): Promise<Document[]> {
    const ids = docs.flatMap((d) => {
      const pinned = d["pinned"] as { by?: string } | undefined;
      return [String(d["senderId"]), ...(pinned?.by ? [pinned.by] : [])];
    });
    const names = await this.names(ids);
    return docs.map((d) => {
      const pinned = d["pinned"] as { by: string; at: Date } | undefined;
      return {
        ...d,
        senderName: names.get(String(d["senderId"])) || d["senderName"] || String(d["senderId"]).slice(0, 8),
        ...(pinned ? { pinned: { ...pinned, byName: names.get(pinned.by) || pinned.by.slice(0, 8) } } : {}),
      };
    });
  }

  async pin(actorId: string, roomId: string, messageId: string, io: Io | null): Promise<void> {
    await this.requireAccess(actorId, roomId);
    // Pins are for private conversations; in open rooms (global, region) anyone could pin anything.
    if (!roomId.startsWith("dm_") && !roomId.startsWith("group_")) fail("FORBIDDEN");
    const count = await this.messages().countDocuments({ roomId, "pinned.at": { $exists: true } });
    if (count >= MAX_PINS_PER_ROOM) fail("PIN_LIMIT");
    const pinned = { by: actorId, at: new Date() };
    const updated = await this.messages().findOneAndUpdate(
      { _id: messageId as never, roomId, deleted: { $ne: true }, system: { $ne: true } },
      { $set: { pinned } },
    );
    if (!updated) fail("NOT_FOUND");
    io?.to(roomId).emit("message_pinned", {
      roomId,
      messageId,
      pinned: { ...pinned, byName: await this.nameOf(actorId) },
    });
  }

  async unpin(actorId: string, roomId: string, messageId: string, io: Io | null): Promise<void> {
    await this.requireAccess(actorId, roomId);
    const updated = await this.messages().findOneAndUpdate(
      { _id: messageId as never, roomId },
      { $unset: { pinned: "" } },
    );
    if (!updated) fail("NOT_FOUND");
    io?.to(roomId).emit("message_unpinned", { roomId, messageId });
  }

  async editMessage(actorId: string, roomId: string, messageId: string, content: string, io: Io | null): Promise<void> {
    await this.requireAccess(actorId, roomId);
    const editedAt = new Date();
    const updated = await this.messages().findOneAndUpdate(
      {
        _id: messageId as never,
        roomId,
        senderId: actorId,
        deleted: { $ne: true },
        system: { $ne: true },
        audioUrl: { $exists: false },
      },
      { $set: { content, editedAt } },
    );
    if (!updated) fail("NOT_FOUND");
    io?.to(roomId).emit("message_edited", { roomId, messageId, content, editedAt });
  }

  async deleteMessage(actorId: string, roomId: string, messageId: string, io: Io | null): Promise<void> {
    await this.requireAccess(actorId, roomId);
    const msg = await this.messages().findOne({ _id: messageId as never, roomId });
    if (!msg || msg["system"]) fail("NOT_FOUND");

    if (msg["senderId"] !== actorId) {
      const room = roomId.startsWith("group_") ? await this.rooms().findOne({ _id: roomId }) : null;
      if (!room || !(room.admins ?? []).includes(actorId)) fail("FORBIDDEN");
    }

    await this.messages().updateOne(
      { _id: messageId as never },
      {
        $set: { deleted: true, content: "", deletedAt: new Date() },
        $unset: { audioUrl: "", pinned: "", reactions: "", replyTo: "" },
      },
    );
    io?.to(roomId).emit("message_deleted", { roomId, messageId });
  }

  async toggleReaction(actorId: string, roomId: string, messageId: string, emoji: string, io: Io | null): Promise<void> {
    await this.requireAccess(actorId, roomId);
    if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) fail("INVALID_PAYLOAD");

    const filter = { _id: messageId as never, roomId, deleted: { $ne: true }, system: { $ne: true } };
    const msg = await this.messages().findOne(filter);
    if (!msg) fail("NOT_FOUND");

    const field = `reactions.${emoji}`;
    const reactions = (msg["reactions"] ?? {}) as Record<string, string[]>;
    const already = (reactions[emoji] ?? []).includes(actorId);
    const update: Document = already ? { $pull: { [field]: actorId } } : { $addToSet: { [field]: actorId } };
    await this.messages().updateOne(filter, update);

    const after = await this.messages().findOne({ _id: messageId as never }, { projection: { reactions: 1 } });
    const next = (after?.["reactions"] ?? {}) as Record<string, string[]>;
    const cleaned: Record<string, string[]> = {};
    for (const [key, ids] of Object.entries(next)) {
      if (ids.length > 0) cleaned[key] = ids;
    }
    io?.to(roomId).emit("message_reactions", { roomId, messageId, reactions: cleaned });
  }
}

// ---------------------------------------------------------------------- routes

const nameSchema = z.string().trim().min(1).max(50);
const idsSchema = z.array(z.string().min(1).max(128)).min(1).max(MAX_GROUP_MEMBERS - 1);
const createSchema = z.object({ name: nameSchema, memberIds: idsSchema }).strict();
const renameSchema = z.object({ name: nameSchema }).strict();
const addSchema = z.object({ memberIds: idsSchema }).strict();
const editSchema = z.object({ content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH) }).strict();
const reactSchema = z.object({ emoji: z.string().min(1).max(16) }).strict();

function param(req: Request, key: string): string {
  const raw = req.params[key];
  if (!raw || Array.isArray(raw)) fail("INVALID_PAYLOAD");
  return raw;
}

function playerOf(req: Request): string {
  const id = req.ctx?.player?._id;
  if (!id) fail("UNAUTHORIZED");
  return id;
}

function ioOf(req: Request): Io | null {
  return (req.app.locals["io"] as Io | undefined) ?? null;
}

function handle(err: unknown, res: Response): void {
  const code = err instanceof ChatExtrasError ? err.message : "INTERNAL_SERVER_ERROR";
  const status: Record<string, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INVALID_PAYLOAD: 400,
    NOT_FRIENDS: 400,
    GROUP_FULL: 409,
    PIN_LIMIT: 409,
  };
  if (!(err instanceof ChatExtrasError)) logger.error("Chat extras route error", { error: String(err) });
  res.status(status[code] ?? 500).json({ error: code });
}

export function buildChatExtrasRouter(db: Db): Router {
  const router = Router();
  const service = new ChatExtrasService(db);

  const route =
    (fn: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response): Promise<void> => {
      try {
        await fn(req, res);
      } catch (err) {
        handle(err, res);
      }
    };

  const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
    const result = schema.safeParse(body);
    if (!result.success) fail("INVALID_PAYLOAD");
    return result.data;
  };

  // ---- groups
  router.get("/chat/groups", route(async (req, res) => {
    res.json({ groups: await service.listGroups(playerOf(req)) });
  }));

  router.post("/chat/groups", route(async (req, res) => {
    const body = parse(createSchema, req.body);
    res.status(201).json(await service.createGroup(playerOf(req), body.name, body.memberIds, ioOf(req)));
  }));

  router.get("/chat/groups/:roomId", route(async (req, res) => {
    res.json(await service.getGroup(playerOf(req), param(req, "roomId")));
  }));

  router.patch("/chat/groups/:roomId", route(async (req, res) => {
    const body = parse(renameSchema, req.body);
    await service.renameGroup(playerOf(req), param(req, "roomId"), body.name, ioOf(req));
    res.status(204).send();
  }));

  router.post("/chat/groups/:roomId/members", route(async (req, res) => {
    const body = parse(addSchema, req.body);
    await service.addMembers(playerOf(req), param(req, "roomId"), body.memberIds, ioOf(req));
    res.status(204).send();
  }));

  router.delete("/chat/groups/:roomId/members/:playerId", route(async (req, res) => {
    await service.removeMember(playerOf(req), param(req, "roomId"), param(req, "playerId"), ioOf(req));
    res.status(204).send();
  }));

  // ---- history, search, pins
  router.get("/chat/rooms/:roomId/history", route(async (req, res) => {
    const beforeRaw = typeof req.query["before"] === "string" ? new Date(req.query["before"]) : null;
    const before = beforeRaw && !Number.isNaN(beforeRaw.getTime()) ? beforeRaw : null;
    const limitRaw = Number(req.query["limit"] ?? HISTORY_PAGE_SIZE);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : HISTORY_PAGE_SIZE;
    res.json({ messages: await service.history(playerOf(req), param(req, "roomId"), before, limit) });
  }));

  router.get("/chat/rooms/:roomId/search", route(async (req, res) => {
    const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
    if (q.length < 2 || q.length > 100) fail("INVALID_PAYLOAD");
    res.json({ messages: await service.search(playerOf(req), param(req, "roomId"), q) });
  }));

  router.get("/chat/rooms/:roomId/pins", route(async (req, res) => {
    res.json({ messages: await service.listPins(playerOf(req), param(req, "roomId")) });
  }));

  router.post("/chat/rooms/:roomId/messages/:messageId/pin", route(async (req, res) => {
    await service.pin(playerOf(req), param(req, "roomId"), param(req, "messageId"), ioOf(req));
    res.status(204).send();
  }));

  router.delete("/chat/rooms/:roomId/messages/:messageId/pin", route(async (req, res) => {
    await service.unpin(playerOf(req), param(req, "roomId"), param(req, "messageId"), ioOf(req));
    res.status(204).send();
  }));

  // ---- edit, delete, react
  router.patch("/chat/rooms/:roomId/messages/:messageId", route(async (req, res) => {
    const body = parse(editSchema, req.body);
    await service.editMessage(playerOf(req), param(req, "roomId"), param(req, "messageId"), body.content, ioOf(req));
    res.status(204).send();
  }));

  router.delete("/chat/rooms/:roomId/messages/:messageId", route(async (req, res) => {
    await service.deleteMessage(playerOf(req), param(req, "roomId"), param(req, "messageId"), ioOf(req));
    res.status(204).send();
  }));

  router.post("/chat/rooms/:roomId/messages/:messageId/reactions", route(async (req, res) => {
    const body = parse(reactSchema, req.body);
    await service.toggleReaction(playerOf(req), param(req, "roomId"), param(req, "messageId"), body.emoji, ioOf(req));
    res.status(204).send();
  }));

  return router;
}