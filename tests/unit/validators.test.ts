import { describe, expect, it } from "vitest";
import { collectionValidators } from "../../src/infrastructure/mongodb/validators/schemas";
import { Document } from "mongodb";

describe("Collection Validators", () => {
  it("contains schemas for all required collections", () => {
    const expected = ["players", "playerIdentities", "matches"];
    for (const name of expected) {
      expect(collectionValidators[name]).toBeDefined();
      
      const schema = collectionValidators[name] as Document;
      expect(schema["$jsonSchema"]).toBeDefined();
    }
  });

  it("enforces additionalProperties: false on players", () => {
    const playerSchema = collectionValidators["players"]!["$jsonSchema"] as Document;
    expect(playerSchema["additionalProperties"]).toBe(false);
  });
});