import { Db, Document } from "mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export class AuthService {
  private privateKey: string;
  private publicKey: string;

  constructor(private db: Db) {
    // 1. Try to load from Environment Variables (Render / Production)
    if (process.env["AUTH_PRIVATE_KEY"] && process.env["AUTH_PUBLIC_KEY"]) {
      this.privateKey = process.env["AUTH_PRIVATE_KEY"].replace(/\\n/g, "\n");
      this.publicKey = process.env["AUTH_PUBLIC_KEY"].replace(/\\n/g, "\n");
    } 
    // 2. Fallback to local files (Local Development)
    else {
      const keyDir = path.join(__dirname, "../../infrastructure/auth/keys");
      this.privateKey = fs.readFileSync(path.join(keyDir, "private.pem"), "utf8");
      this.publicKey = fs.readFileSync(path.join(keyDir, "public.pem"), "utf8");
    }
  }

  async register(email: string, username: string, passwordPlain: string) {
    const players = this.db.collection<{ _id: string } & Document>("players");
    const auths = this.db.collection<{ _id: string } & Document>("authCredentials");
    const identities = this.db.collection<{ _id: string } & Document>("playerIdentities");

    const existingEmail = await auths.findOne({ email });
    if (existingEmail) throw new Error("EMAIL_IN_USE");

    const existingUser = await players.findOne({ displayName: username });
    if (existingUser) throw new Error("USERNAME_TAKEN");

    const passwordHash = await bcrypt.hash(passwordPlain, 10);
    const playerId = `player_${crypto.randomUUID()}`;
    const now = new Date();

    await players.insertOne({
      _id: playerId,
      displayName: username,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await auths.insertOne({
      _id: `auth_${crypto.randomUUID()}`,
      playerId,
      email: email.toLowerCase(),
      passwordHash,
      createdAt: now,
    });

    await identities.insertOne({
      _id: `identity_${crypto.randomUUID()}`,
      playerId,
      provider: "local",
      providerId: email.toLowerCase(),
      createdAt: now,
    });

    return this.generateToken(playerId, username);
  }

  async login(email: string, passwordPlain: string) {
    const auths = this.db.collection<{ _id: string } & Document>("authCredentials");
    const players = this.db.collection<{ _id: string } & Document>("players");

    const auth = await auths.findOne({ email: email.toLowerCase() });
    if (!auth) throw new Error("INVALID_CREDENTIALS");

    const valid = await bcrypt.compare(passwordPlain, auth["passwordHash"] as string);
    if (!valid) throw new Error("INVALID_CREDENTIALS");

    const player = await players.findOne({ _id: auth["playerId"] as string });
    if (!player) throw new Error("PLAYER_NOT_FOUND");

    return this.generateToken(player._id, player["displayName"] as string);
  }

  generateToken(playerId: string, username: string) {
    const payload = {
      sub: playerId,
      username: username,
      iss: "local",
      aud: "fps-api",
    };

    const token = jwt.sign(payload, this.privateKey, {
      algorithm: "RS256",
      expiresIn: "7d",
    });

    return { token, playerId, username };
  }

  getJwks() {
    const jwk = crypto.createPublicKey(this.publicKey).export({ format: "jwk" });
    return {
      keys: [
        {
          ...jwk,
          kid: "local-key-1",
          alg: "RS256",
          use: "sig",
        },
      ],
    };
  }
}