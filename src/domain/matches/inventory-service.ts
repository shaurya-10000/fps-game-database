import { Db, Document } from "mongodb";

export interface InventoryItem {
  _id: string;
  playerId: string;
  definitionId: string;
  sourceEventId: string;
  grantedAt: Date;
}

export class InventoryService {
  constructor(private db: Db) {}

  async grantItem(
    playerId: string, 
    definitionId: string, 
    sourceEventId: string
  ): Promise<"granted" | "duplicate"> {
    const col = this.db.collection<InventoryItem>("inventoryItems");
    
    try {
      await col.insertOne({
        _id: `inv_${crypto.randomUUID()}`,
        playerId,
        definitionId,
        sourceEventId,
        grantedAt: new Date()
      });
      return "granted";
    } catch (err) {
      if ((err as Document)["code"] === 11000) {
        return "duplicate";
      }
      throw err;
    }
  }

  async ensureUniqueConstraint(): Promise<void> {
    const col = this.db.collection<InventoryItem>("inventoryItems");
    await col.createIndex(
      { playerId: 1, definitionId: 1, sourceEventId: 1 },
      { unique: true }
    );
  }
}
