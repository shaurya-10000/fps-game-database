import { Db } from "mongodb";

export default {
  async up(db: Db): Promise<void> {
    // Example: Create a TTL index on a hypothetical 'sessions' collection
    // or just ensure a specific index exists.
    await db.collection("players").createIndex({ displayName: 1 }, { unique: true });
  }
};