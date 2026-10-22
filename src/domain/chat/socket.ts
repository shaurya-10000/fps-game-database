import { Server as SocketServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { ChatService, MAX_MESSAGE_LENGTH } from "./service";
import { canAccessRoom, roomRecipients } from "./room-access";
import { IdentityProvider } from "../../infrastructure/auth/identity-provider";
import { PlayerService } from "../players/player-service";
import { logger } from "../../infrastructure/logging/logger";
import type { Db } from "mongodb";

const RATE_WINDOW_MS = 10_000;
const RATE_MAX_MESSAGES = 20;

export function initChatSocket(
  httpServer: HttpServer,
  chatService: ChatService,
  authProvider: IdentityProvider,
  playerService: PlayerService,
  db: Db
): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: "*" }, // Adjust this in production
  });

  // Authenticate socket connections using the same JWT logic as HTTP
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth["token"];
      if (!token) return next(new Error("Authentication error: No token"));

      const principal = await authProvider.verify(token);
      const player = await playerService.resolvePlayer(principal);

      socket.data.playerId = player._id;
      socket.data.playerName = String((player as unknown as Record<string, unknown>)["displayName"] ?? player._id.slice(0, 8));
      next();
    } catch (err) {
      logger.warn("Socket auth failed", { error: String(err) });
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const playerId = socket.data.playerId as string;
    const playerName = String(socket.data.playerName ?? playerId.slice(0, 8));
    const sentAt: number[] = [];
    const lastTyping = new Map<string, number>();

    // Join a personal room based on playerId for direct targeting
    socket.join(playerId);
    logger.info("User connected", { playerId, socketId: socket.id });

    const rateLimited = (): boolean => {
      const now = Date.now();
      while (sentAt.length > 0 && now - (sentAt[0] ?? 0) > RATE_WINDOW_MS) sentAt.shift();
      if (sentAt.length >= RATE_MAX_MESSAGES) return true;
      sentAt.push(now);
      return false;
    };

    // --- CHAT EVENTS ---

    socket.on("join_room", async (roomId: string) => {
      try {
        if (typeof roomId !== "string" || !(await canAccessRoom(db, playerId, roomId))) {
          socket.emit("error", "Unauthorized to join this room");
          return;
        }
        socket.join(roomId);
        logger.info("User joined room", { playerId, roomId });
        const history = await chatService.getHistory(roomId);
        socket.emit("room_history", history.reverse());
      } catch (err) {
        logger.error("Error joining room", { error: String(err) });
      }
    });

    socket.on("send_message", async (data: { roomId: string; content: string; replyToId?: string }) => {
      try {
        if (!data || typeof data.content !== "string" || typeof data.roomId !== "string") return;
        const content = data.content.trim();
        if (!content || content.length > MAX_MESSAGE_LENGTH) return;
        if (!(await canAccessRoom(db, playerId, data.roomId))) {
          socket.emit("error", "Unauthorized to post in this room");
          return;
        }
        if (rateLimited()) {
          socket.emit("error", "You are sending messages too quickly");
          return;
        }
        const replyToId = typeof data.replyToId === "string" && data.replyToId ? data.replyToId : undefined;
        const message = await chatService.saveMessage(data.roomId, playerId, content, replyToId);
        io.to(data.roomId).emit("new_message", message);

        // Tell the other participants (even if they have not opened this chat) so they can show unread badges.
        const recipients = await roomRecipients(db, data.roomId, playerId);
        if (recipients) {
          const activity = {
            roomId: data.roomId,
            kind: recipients.kind,
            senderId: playerId,
            senderName: message.senderName,
            preview: message.content.slice(0, 100),
            messageId: message._id,
            createdAt: message.createdAt,
          };
          for (const id of recipients.ids) io.to(id).emit("chat_activity", activity);
        }
      } catch (err) {
        logger.error("Error sending message", { error: String(err) });
        socket.emit("error", "Failed to send message");
      }
    });

    // Typing indicators are only relayed inside rooms this socket has joined, and throttled.
    socket.on("typing", (data: { roomId?: unknown; typing?: unknown }) => {
      if (!data || typeof data.roomId !== "string" || !socket.rooms.has(data.roomId)) return;
      const typing = data.typing === true;
      const now = Date.now();
      if (typing) {
        if (now - (lastTyping.get(data.roomId) ?? 0) < 1500) return;
        lastTyping.set(data.roomId, now);
      }
      socket.to(data.roomId).emit("typing", { roomId: data.roomId, playerId, name: playerName, typing });
    });

    // --- WEBRTC SIGNALING EVENTS ---

    socket.on("call_user", (data: { targetPlayerId: string; offer: unknown }) => {
      logger.info("Call initiated", { from: playerId, to: data.targetPlayerId });
      io.to(data.targetPlayerId).emit("incoming_call", {
        fromPlayerId: playerId,
        offer: data.offer,
      });
    });

    socket.on("answer_call", (data: { targetPlayerId: string; answer: unknown }) => {
      logger.info("Call answered", { from: playerId, to: data.targetPlayerId });
      io.to(data.targetPlayerId).emit("call_answered", {
        fromPlayerId: playerId,
        answer: data.answer,
      });
    });

    socket.on("ice_candidate", (data: { targetPlayerId: string; candidate: unknown }) => {
      io.to(data.targetPlayerId).emit("ice_candidate", {
        fromPlayerId: playerId,
        candidate: data.candidate,
      });
    });

    socket.on("end_call", (data: { targetPlayerId: string }) => {
      io.to(data.targetPlayerId).emit("call_ended", { fromPlayerId: playerId });
    });

    socket.on("disconnect", () => {
      logger.info("User disconnected", { playerId, socketId: socket.id });
    });
  });

  return io;
}