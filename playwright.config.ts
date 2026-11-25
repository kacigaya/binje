import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `NEXT_INSTANT_TEST=1 bunx next start -H 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}/en`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
