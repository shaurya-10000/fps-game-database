import { MongoClient, Document } from "mongodb";
import "dotenv/config";
import { logger } from "../src/infrastructure/logging/logger";
import fs from "fs";
import path from "path";

async function verifyExplain() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI is missing");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("fps-game-database");

  // Simulate the "player_match_history" query: get the latest 10 matches for a specific player
  const targetPlayerId = "player_0";

  const explainResult = await db.command({
    explain: {
      find: "matchParticipants",
      filter: { playerId: targetPlayerId },
      sort: { createdAt: -1 },
      limit: 10
    },
    verbosity: "executionStats"
  }) as Document;

  const stats = explainResult["executionStats"] as Document;
  const nReturned = stats["nReturned"] as number;
  const totalDocsExamined = stats["totalDocsExamined"] as number;

  // Save the output to docs/operations/
  const outputDir = path.join(__dirname, "../docs/architecture");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, "explain-player-history.json");
  fs.writeFileSync(outputPath, JSON.stringify(explainResult, null, 2));
  logger.info(`Saved explain output to ${outputPath}`);

  logger.info(`Query stats: nReturned=${nReturned}, totalDocsExamined=${totalDocsExamined}`);

  // The verification requirement
  const maxAllowed = nReturned * 1.2;
  
  if (totalDocsExamined > maxAllowed) {
    logger.error(`❌ FAIL: Index not effective. totalDocsExamined (${totalDocsExamined}) exceeds maxAllowed (${maxAllowed}).`);
    await client.close();
    process.exit(1);
  }

  logger.info(`✅ PASS: Index is effective (${totalDocsExamined} <= ${maxAllowed}).`);
  await client.close();
}

verifyExplain().catch(console.error);