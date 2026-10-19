import { Document } from "mongodb";

export const collectionValidators: Record<string, Document> = {
  players: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "createdAt", "updatedAt", "status", "displayName"],
      properties: {
        _id: { bsonType: "string" }, 
        displayName: { bsonType: "string", minLength: 2, maxLength: 32 },
        status: { bsonType: "string", enum: ["active", "suspended", "banned"] },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
      additionalProperties: false, 
    },
  },
  playerIdentities: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "playerId", "provider", "providerId", "createdAt"],
      properties: {
        _id: { bsonType: "string" },
        playerId: { bsonType: "string" },
        provider: { bsonType: "string" },
        providerId: { bsonType: "string" },
        createdAt: { bsonType: "date" },
      },
      additionalProperties: false,
    },
  },
  matches: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "status", "contentVersion", "createdAt"],
      properties: {
        _id: { bsonType: "string" },
        status: { bsonType: "string", enum: ["created", "in_progress", "completed", "aborted"] },
        contentVersion: { bsonType: "int" },
        createdAt: { bsonType: "date" },
      },
      additionalProperties: false,
    },
  },
};