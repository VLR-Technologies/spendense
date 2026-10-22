import { defineConfig, devices } from "@playwright/test";
const port = process.env.DAYWISE_TEST_PORT || "3100";
const baseURL = `http://127.0.0.1:${port}`;
const cloud = process.env.DAYWISE_CLOUD_TEST === "1";
if (
  cloud &&
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  )
)
  throw new Error(
    "Cloud browser tests must use the disposable local Supabase stack.",
  );
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/deployment.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    channel: "chrome",
    trace: "retain-on-failure",
    actionTimeout: 15000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    // Never let .env.local point automated guest tests at the hosted project.
    env: {
      DAYWISE_TEST_DIST_DIR: ".next-e2e",
      // Exercise the existing full app only in isolated browser test contexts.
      NEXT_PUBLIC_APP_MODE: "live",
      NEXT_PUBLIC_SUPABASE_URL: cloud
        ? process.env.NEXT_PUBLIC_SUPABASE_URL!
        : "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: cloud
        ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
        : "",
      NEXT_PUBLIC_APP_URL: baseURL,
    },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
