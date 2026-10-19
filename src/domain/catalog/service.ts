import { Db, Document } from "mongodb";
import { ContentCatalog, WeaponType, CharacterRole, GameModeId, MatchmakingBucket } from "./types";
import { CATALOG_V1 } from "./data";

export class ContentCatalogService {
  constructor(private db: Db) {}

  async seedCatalog(): Promise<void> {
    const col = this.db.collection<{ _id: string } & Document>("contentVersions");
    await col.updateOne(
      { _id: CATALOG_V1.version },
      { $set: { ...CATALOG_V1, _id: CATALOG_V1.version, createdAt: new Date() } },
      { upsert: true }
    );
  }

  async getCatalog(version: string): Promise<ContentCatalog | null> {
    const col = this.db.collection<{ _id: string } & Document>("contentVersions");
    const doc = await col.findOne({ _id: version });
    return doc ? (doc as unknown as ContentCatalog) : null;
  }

  async getWeaponsByType(version: string, type: WeaponType) {
    const catalog = await this.getCatalog(version);
    if (!catalog) throw new Error(`CATALOG_NOT_FOUND: ${version}`);
    return catalog.weapons.filter(w => w.type === type);
  }

  async getWeaponById(version: string, weaponId: string) {
    const catalog = await this.getCatalog(version);
    if (!catalog) throw new Error(`CATALOG_NOT_FOUND: ${version}`);
    const weapon = catalog.weapons.find(w => w.id === weaponId);
    if (!weapon) throw new Error(`WEAPON_NOT_FOUND: ${weaponId}`);
    return weapon;
  }

  async getCharactersByRole(version: string, role: CharacterRole) {
    const catalog = await this.getCatalog(version);
    if (!catalog) throw new Error(`CATALOG_NOT_FOUND: ${version}`);
    return catalog.characters.filter(c => c.role === role);
  }

  async getMapsForMode(version: string, gameModeId: GameModeId) {
    const catalog = await this.getCatalog(version);
    if (!catalog) throw new Error(`CATALOG_NOT_FOUND: ${version}`);
    return catalog.maps.filter(m => m.gameModes.includes(gameModeId));
  }

  async getGameModesForBucket(version: string, bucket: MatchmakingBucket) {
    const catalog = await this.getCatalog(version);
    if (!catalog) throw new Error(`CATALOG_NOT_FOUND: ${version}`);
    return catalog.gameModes.filter(g => g.buckets.includes(bucket));
  }

  async getCatalogSummary(version: string) {
    const catalog = await this.getCatalog(version);
    if (!catalog) throw new Error(`CATALOG_NOT_FOUND: ${version}`);
    return {
      maps: catalog.maps.length,
      weapons: catalog.weapons.length,
      throwables: catalog.throwables.length,
      characters: catalog.characters.length,
      gameModes: catalog.gameModes.length,
      equipment: catalog.equipment.length
    };
  }
}
