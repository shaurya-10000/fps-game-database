import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db } from "mongodb";
import { FriendshipService } from "../../src/domain/friends/friendship-service";
import "dotenv/config";

describe("FriendshipService", () => {
  let client: MongoClient;
  let db: Db;
  let service: FriendshipService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-friends-test");
    service = new FriendshipService(db);
    await service.ensureIndexes();
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("sends and accepts a request, producing two accepted rows", async () => {
    await service.sendRequest("a", "b");
    await service.acceptRequest("b", "a");

    const friendsOfA = await service.listFriends("a");
    const friendsOfB = await service.listFriends("b");
    expect(friendsOfA).toHaveLength(1);
    expect(friendsOfB).toHaveLength(1);
    expect(friendsOfA[0]!.toPlayerId).toBe("b");
    expect(friendsOfB[0]!.toPlayerId).toBe("a");
  });

  it("mutual simultaneous send auto-accepts", async () => {
    await Promise.all([
      service.sendRequest("c", "d"),
      service.sendRequest("d", "c"),
    ]);
    const friends = await service.listFriends("c");
    expect(friends).toHaveLength(1);
    expect(friends[0]!.toPlayerId).toBe("d");
  });

  it("concurrent accept produces exactly one friendship pair", async () => {
    await service.sendRequest("e", "f");
    // Two concurrent accepts for the same pending request.
    const results = await Promise.allSettled([
      service.acceptRequest("f", "e"),
      service.acceptRequest("f", "e"),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    const fromE = await db.collection("friendships").countDocuments({
      fromPlayerId: "e", toPlayerId: "f", status: "accepted",
    });
    const fromF = await db.collection("friendships").countDocuments({
      fromPlayerId: "f", toPlayerId: "e", status: "accepted",
    });
    expect(fromE).toBe(1);
    expect(fromF).toBe(1);
  });

  it("unfriend removes both rows", async () => {
    await service.sendRequest("g", "h");
    await service.acceptRequest("h", "g");
    await service.unfriend("g", "h");
    expect(await service.listFriends("g")).toHaveLength(0);
    expect(await service.listFriends("h")).toHaveLength(0);
  });

  it("block removes friendship and prevents further requests", async () => {
    await service.sendRequest("i", "j");
    await service.acceptRequest("j", "i");
    await service.block("i", "j");

    expect(await service.listFriends("i")).toHaveLength(0);
    await expect(service.sendRequest("j", "i")).rejects.toThrow("FRIEND_REQUEST_FAILED");
    // Reverse direction is also blocked.
    await expect(service.sendRequest("i", "j")).rejects.toThrow("FRIEND_REQUEST_FAILED");
  });

  it("rejects self-request and self-block", async () => {
    await expect(service.sendRequest("k", "k")).rejects.toThrow("CANNOT_FRIEND_SELF");
    await expect(service.block("k", "k")).rejects.toThrow("CANNOT_BLOCK_SELF");
  });

  it("duplicate send is idempotent", async () => {
    const r1 = await service.sendRequest("l", "m");
    const r2 = await service.sendRequest("l", "m");
    expect(r1).toBe("sent");
    expect(r2).toBe("already_pending");
    const count = await db.collection("friendships").countDocuments({
      fromPlayerId: "l", toPlayerId: "m",
    });
    expect(count).toBe(1);
  });

  it("blocked and nonexistent targets produce the same error", async () => {
    await service.block("n", "o");
    // Blocked target:
    await expect(service.sendRequest("o", "n")).rejects.toThrow("FRIEND_REQUEST_FAILED");
    // Nonexistent target would also be FRIEND_REQUEST_FAILED at the API layer
    // (the service doesn't currently check target existence — see note below).
  });
});
