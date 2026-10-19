import { MongoClient, Document } from "mongodb";
import "dotenv/config";
import { logger } from "../src/infrastructure/logging/logger";

// Deterministic PRNG (Mulberry32)
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const CONTENT_VERSIONS: Document[] = [
  {
    _id: "v1",
    maps: ["Terminal", "Frostline", "Ashfall"],
    weapons: ["RK-7", "VK-4", "LR-9"],
    characters: ["Ember", "Drift"],
    gameModes: ["Ranked", "Casual"],
    createdAt: new Date(),
  },
  {
    _id: "v2",
    maps: ["Terminal", "Frostline", "Ashfall", "Cinder"],
    weapons: ["RK-7", "VK-4", "LR-9", "AR-12"],
    characters: ["Ember", "Drift", "Rook"],
    gameModes: ["Ranked", "Casual"],
    createdAt: new Date(),
  },
];

async function seed() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI is missing");

  const sizeArg = process.argv.find(arg => arg.startsWith("--size="))?.split("=")[1] || "small";
  const sizes: Record<string, { players: number, matches: number }> = {
    small: { players: 100, matches: 1000 },
    medium: { players: 1000, matches: 10000 },
    large: { players: 10000, matches: 100000 },
  };

  const config = sizes[sizeArg] || sizes["small"]!;
  logger.info(`Seeding database with size: ${sizeArg} (${config.players} players, ${config.matches} matches)`);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("fps-game-database");

  // Clear existing data
  await db.collection("contentVersions").deleteMany({});
  await db.collection("players").deleteMany({});
  await db.collection("matches").deleteMany({});
  await db.collection("matchParticipants").deleteMany({});

  // 0. Seed content catalog (versioned)
  await db.collection("contentVersions").insertMany(CONTENT_VERSIONS);
  logger.info(`Inserted ${CONTENT_VERSIONS.length} content versions`);

  const rand = mulberry32(12345);
  const startTime = Date.now();

  // 1. Seed players
  const players: Document[] = [];
  for (let i = 0; i < config.players; i++) {
    players.push({
      _id: `player_${i}`,
      displayName: `Player${i}`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  await db.collection("players").insertMany(players);
  logger.info(`Inserted ${players.length} players`);

  // 2. Seed matches + participants
  const matches: Document[] = [];
  const participants: Document[] = [];

  for (let i = 0; i < config.matches; i++) {
    const matchId = `match_${i}`;
    const playerIndex = Math.floor(rand() * config.players);
    const playerId = `player_${playerIndex}`;

    matches.push({
      _id: matchId,
      status: "completed",
      contentVersion: 1,
      createdAt: new Date(),
    });

    participants.push({
      _id: `mp_${i}`,
      matchId,
      playerId,
      team: rand() > 0.5 ? "terrorist" : "counter-terrorist",
      score: Math.floor(rand() * 100),
      createdAt: new Date(),
    });
  }

  await db.collection("matches").insertMany(matches);
  await db.collection("matchParticipants").insertMany(participants);
  logger.info(`Inserted ${matches.length} matches and ${participants.length} participants`);

  // 3. Index for the explain query
  await db.collection("matchParticipants").createIndex({ playerId: 1, createdAt: -1 });
  logger.info("Created index on matchParticipants: { playerId: 1, createdAt: -1 }");

  const duration = Date.now() - startTime;
  await client.close();

  if (duration > 60000) {
    logger.warn(`Seed took ${duration}ms, which exceeds the 60s requirement for small.`);
    process.exit(1);
  }

  logger.info(`Seeding completed in ${duration}ms.`);
}

seed().catch(console.error);
