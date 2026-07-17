import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "src/application/**/*.ts",
        "src/domain/**/*.ts",
        "src/discord/components/setupStore.ts",
        "src/discord/interactions/customIds.ts",
        "src/shared/**/*.ts"
      ],
      exclude: [
        "src/main.ts",
        "src/bootstrap.ts",
        "src/discord/client.ts",
        "src/discord/commands/register.ts"
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 75,
        statements: 85,
        "src/domain/**/*.ts": {
          lines: 95,
          functions: 95,
          branches: 85,
          statements: 95
        },
        "src/application/**/*.ts": {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90
        }
      }
    }
  }
});
