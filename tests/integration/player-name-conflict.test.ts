import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { PlayerService } from "../../src/domain/players/player-service";
import "dotenv/config";

describe("PlayerService - displayName uniqueness", () => {
  let client: MongoClient;
  let db: Db;
  let service: PlayerService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-name-conflict-test");
    service = new PlayerService(db);
    await db.collection("players").createIndex({ displayName: 1 }, { unique: true });
  });

  afterEach(async () => {
    await db.collection("players").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  async function seedPlayer(id: string, name: string): Promise<void> {
    await db.collection<{ _id: string } & Document>("players").insertOne({
      _id: id,
      displayName: name,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it("throws DISPLAY_NAME_TAKEN when renaming to a name already in use", async () => {
    await seedPlayer("p1", "Alice");
    await seedPlayer("p2", "Bob");

    await expect(service.updateProfile("p2", { displayName: "Alice" }))
      .rejects.toThrow("DISPLAY_NAME_TAKEN");

    const p2 = await db.collection<{ _id: string } & Document>("players").findOne({ _id: "p2" });
    expect(p2!["displayName"]).toBe("Bob");
  });

  it("allows renaming to a free name", async () => {
    await seedPlayer("p3", "Carol");

    const updated = await service.updateProfile("p3", { displayName: "Caroline" });
    expect(updated.displayName).toBe("Caroline");
  });

  it("rejects profile updates that include extra fields", async () => {
    await seedPlayer("p4", "Dave");

    await expect(
      service.updateProfile("p4", { displayName: "Dave2", status: "admin" })
    ).rejects.toThrow(/INVALID_PAYLOAD/);

    const p4 = await db.collection<{ _id: string } & Document>("players").findOne({ _id: "p4" });
    expect(p4!["displayName"]).toBe("Dave");
  });
});
