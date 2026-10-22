import { defineConfig, devices } from "@playwright/test";

const mode = process.env.SPENDENSE_TEST_APP_MODE ?? "maintenance";
if (!["maintenance", "staging"].includes(mode))
  throw new Error("Deployment tests require a locked mode.");
const production = process.env.SPENDENSE_TEST_PRODUCTION === "1";
const baseURL = "http://127.0.0.1:3200";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "deployment.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: { baseURL, channel: "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: devices["Desktop Chrome"] },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    // Production tests use an already-built .next; run npm run build first.
    command: production
      ? "npm start -- --port 3200"
      : "npm run dev -- --port 3200",
    url: baseURL,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_APP_MODE: mode,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_APP_URL: baseURL,
      DAYWISE_TEST_DIST_DIR: production ? ".next" : ".next-deployment",
    },
    timeout: 120000,
  },
});
