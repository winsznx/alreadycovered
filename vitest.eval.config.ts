import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
  test: {
    include: ["tests/evaluation/**/*.eval.ts"],
    environment: "node",
    testTimeout: 120_000,
  },
});
