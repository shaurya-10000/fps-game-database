import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 10_000,
    hookTimeout: 10_000,
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/index.ts"]
    }
  }
});