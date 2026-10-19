import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db } from "mongodb";
import { ContentCatalogService } from "../../src/domain/catalog/service";
import "dotenv/config";

describe("Content Catalog - Full IP", () => {
  let client: MongoClient;
  let db: Db;
  let service: ContentCatalogService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-catalog-test");
    service = new ContentCatalogService(db);
    await service.seedCatalog();
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("seeds the full catalog with expected counts", async () => {
    const summary = await service.getCatalogSummary("v1");
    expect(summary.maps).toBe(10);
    expect(summary.weapons).toBe(35);
    expect(summary.throwables).toBe(8);
    expect(summary.characters).toBe(25);
    expect(summary.gameModes).toBe(4);
    expect(summary.equipment).toBe(13);
  });

  it("has 5 weapons per type", async () => {
    for (const type of ["assault_rifle", "smg", "sniper", "lmg", "pistol", "shotgun", "melee"] as const) {
      const weapons = await service.getWeaponsByType("v1", type);
      expect(weapons.length).toBe(5);
    }
  });

  it("has 5 characters per role", async () => {
    for (const role of ["assault", "sniper", "controller", "support", "tank"] as const) {
      const chars = await service.getCharactersByRole("v1", role);
      expect(chars.length).toBe(5);
    }
  });

  it("bomb defusal is 7 rounds, 5v5, in both buckets", async () => {
    const catalog = await service.getCatalog("v1");
    const bomb = catalog!.gameModes.find(g => g.id === "bomb_defusal");
    expect(bomb!.teamSize).toBe(5);
    expect(bomb!.roundsPerMatch).toBe(7);
    expect(bomb!.buckets).toEqual(["ranked", "unranked"]);
  });

  it("battle royale supports solo through squad of 5", async () => {
    const catalog = await service.getCatalog("v1");
    const br = catalog!.gameModes.find(g => g.id === "battle_royale");
    expect(br!.battleRoyaleTeamSizes).toEqual([1, 2, 3, 4, 5]);
  });

  it("ranked bucket includes all 4 modes", async () => {
    const modes = await service.getGameModesForBucket("v1", "ranked");
    expect(modes.length).toBe(4);
  });

  it("unranked bucket includes all 4 modes", async () => {
    const modes = await service.getGameModesForBucket("v1", "unranked");
    expect(modes.length).toBe(4);
  });

  it("equipment has 3 armor, 3 helmet, 6 ammo, 1 medkit", async () => {
    const catalog = await service.getCatalog("v1");
    const armor = catalog!.equipment.filter(e => e.category === "armor");
    const helmet = catalog!.equipment.filter(e => e.category === "helmet");
    const ammo = catalog!.equipment.filter(e => e.category === "ammo");
    const consumable = catalog!.equipment.filter(e => e.category === "consumable");
    expect(armor.length).toBe(3);
    expect(helmet.length).toBe(3);
    expect(ammo.length).toBe(6);
    expect(consumable.length).toBe(1);
  });

  it("every map has at least one game mode", async () => {
    const catalog = await service.getCatalog("v1");
    for (const map of catalog!.maps) {
      expect(map.gameModes.length).toBeGreaterThan(0);
    }
  });

  it("all weapon types are valid", async () => {
    const catalog = await service.getCatalog("v1");
    const validTypes = ["assault_rifle", "smg", "sniper", "lmg", "pistol", "shotgun", "melee"];
    for (const weapon of catalog!.weapons) {
      expect(validTypes).toContain(weapon.type);
      expect(weapon.damage).toBeGreaterThan(0);
    }
  });

  it("all character roles are valid", async () => {
    const catalog = await service.getCatalog("v1");
    const validRoles = ["assault", "sniper", "controller", "support", "tank"];
    for (const char of catalog!.characters) {
      expect(validRoles).toContain(char.role);
    }
  });
});
