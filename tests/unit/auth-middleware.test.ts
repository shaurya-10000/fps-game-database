import { describe, expect, it } from "vitest";
import { 
  requirePlayer, 
  requireAdmin, 
  requireOwnership, 
  HttpError,
  Context
} from "../../src/infrastructure/auth/middleware";
import { Principal } from "../../src/infrastructure/auth/identity-provider";
import { Player } from "../../src/domain/players/player-service";

const mockPlayer: Player = {
  _id: "player_123",
  displayName: "TestPlayer",
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrincipal: Principal = {
  providerId: "auth0|123",
  provider: "auth0",
};

describe("Authorization Middleware", () => {
  describe("requirePlayer", () => {
    it("throws 401 if unauthenticated", () => {
      expect(() => requirePlayer({})).toThrowError(HttpError);
      try {
        requirePlayer({});
      } catch (err) {
        expect((err as HttpError).status).toBe(401);
      }
    });

    it("returns the player if authenticated", () => {
      const ctx: Context = { player: mockPlayer, principal: mockPrincipal };
      const player = requirePlayer(ctx);
      expect(player._id).toBe("player_123");
    });
  });

  describe("requireOwnership", () => {
    it("passes if the player owns the resource", () => {
      const ctx: Context = { player: mockPlayer, principal: mockPrincipal };
      const checkOwnership = requireOwnership("player_123");
      expect(() => checkOwnership(ctx)).not.toThrow();
    });

    it("throws 404 (not 403) if the player does not own the resource", () => {
      const ctx: Context = { player: mockPlayer, principal: mockPrincipal };
      const checkOwnership = requireOwnership("player_456");
      
      try {
        checkOwnership(ctx);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(404);
        expect((err as HttpError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("requireAdmin", () => {
    it("throws 403 if the player is not an admin", () => {
      const ctx: Context = { player: mockPlayer, principal: mockPrincipal };
      const checkAdmin = requireAdmin("economy:write");
      
      try {
        checkAdmin(ctx);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(403);
        expect((err as HttpError).code).toBe("FORBIDDEN");
      }
    });

    it("passes if the player has the admin role", () => {
      const adminPrincipal: Principal = {
        ...mockPrincipal,
        metadata: { role: "admin" }
      };
      const ctx: Context = { player: mockPlayer, principal: adminPrincipal };
      const checkAdmin = requireAdmin("economy:write");
      
      expect(() => checkAdmin(ctx)).not.toThrow();
    });
  });
});