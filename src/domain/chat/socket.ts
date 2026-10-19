import { Server as SocketServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { ChatService } from "./service";
import { IdentityProvider } from "../../infrastructure/auth/identity-provider";
import { PlayerService } from "../players/player-service";
import { logger } from "../../infrastructure/logging/logger";

export function initChatSocket(
  httpServer: HttpServer,
  chatService: ChatService,
  authProvider: IdentityProvider,
  playerService: PlayerService
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
      next();
    } catch (err) {
      logger.warn("Socket auth failed", { error: String(err) });
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const playerId = socket.data.playerId as string;
    
    // Join a personal room based on playerId for direct targeting
    socket.join(playerId);
    logger.info("User connected", { playerId, socketId: socket.id });

    // --- CHAT EVENTS ---

    socket.on("join_room", async (roomId: string) => {
      try {
        if (roomId.startsWith("dm_")) {
          if (!roomId.includes(playerId)) {
            socket.emit("error", "Unauthorized to join this DM room");
            return;
          }
        }
        socket.join(roomId);
        logger.info("User joined room", { playerId, roomId });
        const history = await chatService.getHistory(roomId);
        socket.emit("room_history", history.reverse());
      } catch (err) {
        logger.error("Error joining room", { error: String(err) });
      }
    });

    socket.on("send_message", async (data: { roomId: string; content: string }) => {
      try {
        if (!data.content.trim() || !data.roomId) return;
        const message = await chatService.saveMessage(data.roomId, playerId, data.content);
        io.to(data.roomId).emit("new_message", message);
      } catch (err) {
        logger.error("Error sending message", { error: String(err) });
        socket.emit("error", "Failed to send message");
      }
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
