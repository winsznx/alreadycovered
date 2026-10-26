import { defineConfig } from "@playwright/test";

const PORT = 4321;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node apps/service/dist/index.js`,
    url: `http://127.0.0.1:${PORT}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ALREADY_COVERED_PORT: String(PORT),
      ALREADY_COVERED_DATA_DIR: ".e2e-data",
      LOG_LEVEL: "silent",
    },
  },
});
