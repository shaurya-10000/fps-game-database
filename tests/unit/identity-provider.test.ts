import { describe, expect, it, beforeAll, vi } from "vitest";
import { IdentityProvider } from "../../src/infrastructure/auth/identity-provider";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

describe("IdentityProvider", () => {
  let validToken: string;
  let expiredToken: string;
  let wrongIssuerToken: string;
  let provider: IdentityProvider;

  const issuer = "https://test-issuer.com/";
  const audience = "fps-api";
  const jwksUri = "https://test-issuer.com/.well-known/jwks.json";

  beforeAll(async () => {
    // 1. Generate a key pair
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    
    // 2. Export the public key to JWK
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "test-key-1";
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";
    
    const jwks = { keys: [publicJwk] };

    // 3. Mock fetch to return the JWKS
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(JSON.stringify(jwks), { headers: { "Content-Type": "application/json" } });
    }));

    // 4. Generate Tokens
    const createToken = async (options: { issuer?: string, exp?: string }) => {
      const jwt = new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
        .setSubject("user_123")
        .setIssuer(options.issuer || issuer)
        .setAudience(audience)
        .setIssuedAt();
      
      if (options.exp === "expired") {
        jwt.setExpirationTime(Math.floor(Date.now() / 1000) - 3600); // 1 hour ago
      } else {
        jwt.setExpirationTime("1h");
      }

      return jwt.sign(privateKey);
    };

    validToken = await createToken({});
    expiredToken = await createToken({ exp: "expired" });
    wrongIssuerToken = await createToken({ issuer: "https://wrong-issuer.com/" });

    // 5. Initialize Provider
    provider = new IdentityProvider(jwksUri, issuer, audience);
  });

  it("verifies a valid token", async () => {
    const principal = await provider.verify(validToken);
    expect(principal.providerId).toBe("user_123");
    expect(principal.provider).toBe(issuer);
  });

  it("rejects an expired token", async () => {
    await expect(provider.verify(expiredToken)).rejects.toThrow("Invalid token");
  });

  it("rejects a token with the wrong issuer", async () => {
    await expect(provider.verify(wrongIssuerToken)).rejects.toThrow("Invalid token");
  });

  it("rejects a tampered token", async () => {
    const tampered = validToken.slice(0, -5) + "abcde";
    await expect(provider.verify(tampered)).rejects.toThrow("Invalid token");
  });
});