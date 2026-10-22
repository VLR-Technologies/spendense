import { spawnSync, spawn } from "node:child_process";
// Query a disposable LOCAL stack. Do not forward elevated credentials to Next.js.
const status = spawnSync("npx", ["supabase", "status", "--output", "json"], {
  encoding: "utf8",
});
if (status.status !== 0) {
  process.stderr.write("Start local Supabase first: npm run db:start\n");
  process.exit(1);
}
const config = JSON.parse(status.stdout);
if (!config.API_URL?.startsWith("http://127.0.0.1:"))
  throw new Error(
    "Cloud integration tests require the local disposable stack.",
  );
const child = spawn("npx", ["playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: config.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      config.PUBLISHABLE_KEY || config.ANON_KEY,
    DAYWISE_CLOUD_TEST: "1",
    DAYWISE_TEST_PORT: "3100",
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
  },
});
child.on("exit", (code) => process.exit(code ?? 1));
