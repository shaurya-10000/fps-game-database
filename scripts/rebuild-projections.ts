import { MongoClient } from "mongodb";
import "dotenv/config";
import { logger } from "../src/infrastructure/logging/logger";

// NOTE: matchParticipants stores { score } per participant. This milestone
// does not have explicit kills/deaths fields, so this projection intentionally
// exposes score-based aggregates only. If the schema later gains real
// kills/deaths fields, update this pipeline AND statistics-definitions.md
// together, or the doc will over-claim what the data proves.
async function rebuildProjections() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI is missing");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("fps-game-database");

  logger.info("Rebuilding playerStatistics projections from canonical match data...");

  await db.collection("playerStatistics").deleteMany({});

  const pipeline = [
    {
      $lookup: {
        from: "matches",
        localField: "matchId",
        foreignField: "_id",
        as: "match",
      },
    },
    { $unwind: "$match" },
    { $match: { "match.status": "completed" } },
    {
      $group: {
        _id: "$playerId",
        matchesPlayed: { $sum: 1 },
        totalScore: { $sum: "$score" },
        averageScore: { $avg: "$score" },
        bestScore: { $max: "$score" },
      },
    },
  ];

  const cursor = db.collection("matchParticipants").aggregate(pipeline);
  let count = 0;
  for await (const doc of cursor) {
    await db.collection("playerStatistics").insertOne(doc);
    count++;
  }

  logger.info(`Rebuilt ${count} player statistics projections`);
  await client.close();
}

rebuildProjections().catch((err) => {
  console.error(err);
  process.exit(1);
});