import { defineConfig, devices } from "@playwright/test";

const productionServer = process.env.E2E_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    // Page-level API mocks must not be bypassed by the production PWA worker.
    serviceWorkers: "block"
  },
  webServer: {
    command: productionServer ? "npm run start" : "npm run dev",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      DEMO_ACCESS_CODE: "e2e-access",
      DEMO_SESSION_SECRET: "e2e-session-secret-with-at-least-thirty-two-chars",
      GEMINI_API_KEY: ""
    }
  },
  projects: [
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 13"] }
    }
  ]
});
