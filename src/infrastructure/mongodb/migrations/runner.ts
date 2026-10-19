import { MongoClient, Db, Document } from "mongodb";
import fs from "fs";
import path from "path";
import "dotenv/config";
import { logger } from "../../logging/logger";

interface Migration {
  name: string;
  up: (db: Db) => Promise<void>;
}

const MIGRATIONS_DIR = path.join(__dirname);

// Accept both .ts (ts-node) and .js (compiled dist) so the runner behaves
// identically from src/ and from dist/. Exclude the runner and its d.ts.
const MIGRATION_FILE_RE = /^[0-9A-Za-z._-]+\.(ts|js)$/;
const EXCLUDED = new Set(["runner.ts", "runner.js", "runner.d.ts"]);

async function getAppliedMigrations(db: Db): Promise<Set<string>> {
  const collection = db.collection("schemaMigrations");
  const docs = await collection.find({ status: "applied" }).toArray();
  return new Set(docs.map((doc) => doc["name"] as string));
}

async function recordMigrationStart(db: Db, name: string): Promise<void> {
  const collection = db.collection("schemaMigrations");
  const result = (await collection.findOneAndUpdate(
    { name },
    { $setOnInsert: { name, status: "pending", startedAt: new Date() } },
    { upsert: true, returnDocument: "before" }
  )) as Document | null;

  if (result && result["status"] === "applied") {
    throw new Error(`Migration ${name} is already applied.`);
  }
  if (result && result["status"] === "pending") {
    logger.warn(`Migration ${name} was left in a pending state. Forcing re-run.`);
  }
}

async function recordMigrationSuccess(db: Db, name: string): Promise<void> {
  const collection = db.collection("schemaMigrations");
  await collection.updateOne(
    { name },
    { $set: { status: "applied", completedAt: new Date() } }
  );
}

async function recordMigrationFailure(db: Db, name: string, error: string): Promise<void> {
  const collection = db.collection("schemaMigrations");
  await collection.updateOne(
    { name },
    { $set: { status: "failed", failedAt: new Date(), error } }
  );
}

async function run() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI is missing");

  const isDryRun = process.argv.includes("--dry-run");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("fps-game-database");

  logger.info(`Starting migration runner (dry-run: ${isDryRun}, dir: ${MIGRATIONS_DIR})`);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => MIGRATION_FILE_RE.test(f) && !EXCLUDED.has(f))
    .sort();

  if (files.length === 0) {
    logger.warn(
      "No migration files found. If this is unexpected, check that you are running from src/ (ts-node) or that dist/ contains compiled migrations."
    );
  }

  const applied = await getAppliedMigrations(db);

  for (const file of files) {
    const name = file.replace(/\.(ts|js)$/, "");

    if (applied.has(name)) {
      logger.info(`Skipping already applied migration: ${name}`);
      continue;
    }

    logger.info(`Applying migration: ${name}`);

    if (isDryRun) {
      logger.info(`[DRY RUN] Would apply ${name}`);
      continue;
    }

    try {
      await recordMigrationStart(db, name);

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const migrationModule = require(path.join(MIGRATIONS_DIR, file));
      const migration: Migration = migrationModule.default || migrationModule;

      if (typeof migration.up !== "function") {
        throw new Error(`Migration ${name} does not export an 'up' function.`);
      }

      await migration.up(db);
      await recordMigrationSuccess(db, name);
      logger.info(`Successfully applied migration: ${name}`);
    } catch (err) {
      const errorMsg = String(err);
      await recordMigrationFailure(db, name, errorMsg);
      logger.error(`Failed to apply migration: ${name}`, { error: errorMsg });
      await client.close();
      process.exit(1);
    }
  }

  await client.close();
  logger.info("Migration runner finished successfully.");
}

run().catch((err) => {
  logger.error("Migration runner crashed", { error: String(err) });
  process.exit(1);
});