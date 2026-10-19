import { describe, expect, it } from "vitest";

describe("toolchain baseline", () => {
  it("loads and asserts deterministically", () => {
    expect(1 + 1).toBe(2);
  });

  it("has a strict compiler (typeof check sanity)", () => {
    const value: unknown = { a: 1 };
    expect(typeof value).toBe("object");
  });
});