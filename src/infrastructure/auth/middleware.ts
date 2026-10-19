import { Principal } from "./identity-provider";
import { Player } from "../../domain/players/player-service";

export interface Context {
  principal?: Principal;
  player?: Player;
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/**
 * Requires the user to be authenticated (have a valid token).
 */
export function requirePlayer(ctx: Context): Player {
  if (!ctx.player) {
    throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  }
  return ctx.player;
}

/**
 * Requires the user to be an admin.
 */
export function requireAdmin(permission: string) {
  return (ctx: Context): void => {
    const player = requirePlayer(ctx);
    // In a real app, you'd check player.roles or a separate admin table.
    // We will simulate this by checking a metadata flag.
    const isAdmin = ctx.principal?.metadata?.["role"] === "admin";
    if (!isAdmin) {
      throw new HttpError(403, "FORBIDDEN", `Admin permission '${permission}' required`);
    }
  };
}

/**
 * Requires the user to own the resource.
 * Returns 404 (Not Found) instead of 403 (Forbidden) to prevent existence leaks.
 */
export function requireOwnership(resourceOwnerId: string) {
  return (ctx: Context): void => {
    const player = requirePlayer(ctx);
    
    // If the player does not own the resource, throw a 404
    if (player._id !== resourceOwnerId) {
      throw new HttpError(404, "NOT_FOUND", "Resource not found");
    }
  };
}