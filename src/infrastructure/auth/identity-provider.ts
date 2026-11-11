import { jwtVerify, createRemoteJWKSet, JWTPayload } from "jose";
import { logger } from "../logging/logger";

export interface Principal {
  providerId: string; // The ID from the provider (e.g., Auth0 sub)
  provider: string;   // e.g., "auth0", "steam"
  metadata?: Record<string, unknown>;
}

export class IdentityProvider {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private issuer: string;
  private audience: string;

  constructor(jwksUri: string, issuer: string, audience: string) {
    this.jwks = createRemoteJWKSet(new URL(jwksUri));
    this.issuer = issuer;
    this.audience = audience;
  }

  async verify(token: string): Promise<Principal> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });

      if (!payload.sub) {
        throw new Error("Token is missing 'sub' claim");
      }

      return {
        providerId: payload.sub,
        provider: this.issuer,
        metadata: payload as Record<string, unknown>,
      };
    } catch (err) {
      logger.warn("Token verification failed", { error: String(err) });
      throw new Error("Invalid token");
    }
  }
}