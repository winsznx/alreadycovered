import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Source files use NodeNext-style ".js" specifiers pointing at ".ts"
    // siblings; Vite needs to be told to also try ".ts" when resolving them.
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
  },
});
