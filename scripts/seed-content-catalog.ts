import { MongoClient } from "mongodb";
import "dotenv/config";
import { ContentCatalogService } from "../src/domain/catalog/service";
import { logger } from "../src/infrastructure/logging/logger";

async function seedCatalog() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI is missing");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("fps-game-database");
  const service = new ContentCatalogService(db);

  await service.seedCatalog();
  const summary = await service.getCatalogSummary("v1");

  logger.info("Content catalog seeded", summary);
  await client.close();
}

seedCatalog().catch(console.error);
