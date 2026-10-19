import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Enforces that the index inventory in docs/architecture/index-inventory.md
// and the `inventory` array in scripts/verify-indexes.ts stay in sync.
// Both directions are checked:
//   - Every index in the script must appear in the markdown (catches "added
//     an index, forgot to document it").
//   - Every index named in the markdown must appear in the script (catches
//     "documented an index, forgot to create it" -- which is exactly the
//     failure mode when you add a feature but skip step 5).
describe("Index inventory is in sync with verify-indexes.ts", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const scriptSrc = fs.readFileSync(
    path.join(repoRoot, "scripts/verify-indexes.ts"),
    "utf-8"
  );
  const docSrc = fs.readFileSync(
    path.join(repoRoot, "docs/architecture/index-inventory.md"),
    "utf-8"
  );

  function namesFromScript(): Set<string> {
    const out = new Set<string>();
    const re = /name:\s*"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(scriptSrc)) !== null) {
      if (m[1]) out.add(m[1]);
    }
    return out;
  }

  // Markdown rows look like:
  // | `collection` | `index_name` | `{ spec }` | yes | ...
  // Column 2 is the index name in backticks.
  function namesFromDoc(): Set<string> {
    const out = new Set<string>();
    for (const line of docSrc.split(/\r?\n/)) {
      const m = line.match(/^\|\s*`[^`]+`\s*\|\s*`([^`]+)`\s*\|/);
      if (m && m[1] && m[1] !== "Index Name") out.add(m[1]);
    }
    return out;
  }

  it("every index in the script appears in the markdown", () => {
    const scriptNames = namesFromScript();
    expect(scriptNames.size).toBeGreaterThan(0);
    const docNames = namesFromDoc();
    for (const name of scriptNames) {
      if (!docNames.has(name)) {
        throw new Error(`Index "${name}" is in verify-indexes.ts but not documented in index-inventory.md`);
      }
    }
  });

  it("every index in the markdown appears in the script", () => {
    const scriptNames = namesFromScript();
    const docNames = namesFromDoc();
    expect(docNames.size).toBeGreaterThan(0);
    for (const name of docNames) {
      if (!scriptNames.has(name)) {
        throw new Error(`Index "${name}" is documented in index-inventory.md but not created by verify-indexes.ts`);
      }
    }
  });
});
