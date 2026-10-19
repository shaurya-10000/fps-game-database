import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Static coverage check, NOT a failure-injection test.
// The real failure-injection integration tests are:
//   - canonical-result.test.ts
//   - ambiguous-commit.test.ts
//   - rating-atomicity.test.ts
// This file asserts those exist and actually reference the harness.
describe("Phase 9.1 - Failure injection coverage (static check)", () => {
  it("verifies all failure-injection tests actually exist and assert state", () => {
    const testsDir = path.join(__dirname);

    const requiredFiles = [
      "canonical-result.test.ts",
      "ambiguous-commit.test.ts",
      "rating-atomicity.test.ts",
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(testsDir, file);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("setFailurePoint");
      expect(content).toMatch(/expect.*(null|0|status)/);
    }
  });
});