import { defineConfig, devices } from "@playwright/test";

const testPort = process.env.E2E_PORT || "3000";
const testOrigin = `http://127.0.0.1:${testPort}`;

const productionServer = process.env.E2E_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: testOrigin,
    trace: "retain-on-failure",
    // Page-level API mocks must not be bypassed by the production PWA worker.
    serviceWorkers: "block"
  },
  webServer: {
    command: productionServer ? "npm run start" : "npm run dev -- --hostname 127.0.0.1",
    url: `${testOrigin}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      PORT: testPort,
      HOSTNAME: "127.0.0.1",
      GEMINI_API_KEY: "",
      FEEDBACK_EMAIL_ENABLED: "false",
      RESEND_API_KEY: "",
      DEMO_ACCESS_CODE: "e2e-demo-code",
      DEMO_SESSION_SECRET: "e2e-session-secret",
      DEMO_AUTH_RATE_LIMIT: "1000",
      RECOGNITION_RATE_LIMIT: "1000"
    }
  },
  projects: [
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 13"] }
    }
  ]
});
