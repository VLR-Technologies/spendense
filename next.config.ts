import type { NextConfig } from "next";
import { supabaseEnvironment } from "./src/lib/supabase/config";

// Public variables are bundled into JavaScript. Stop before bundling a secret.
const backend = supabaseEnvironment();
if (backend.status === "unsafe-key")
  throw new Error(
    "Unsafe NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Use only a browser-safe publishable or legacy anon key, or leave it empty for maintenance.",
  );
if (backend.status === "invalid" || backend.status === "incomplete") {
  console.warn(
    "Supabase configuration is incomplete or invalid; cloud access is disabled for this build.",
  );
  // Do not inline unrecognised credential values into the browser bundle.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
}
for (const name of Object.keys(process.env)) {
  if (
    /^NEXT_PUBLIC_.*(?:PASSWORD|SECRET|SERVICE_ROLE|PRIVATE_KEY|ACCESS_TOKEN)/.test(
      name,
    ) &&
    process.env[name]
  )
    throw new Error(
      `Remove the sensitive public environment variable ${name} before building.`,
    );
}
const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.DAYWISE_TEST_DIST_DIR || ".next",
  devIndicators: false,
  turbopack: { root: process.cwd() },
};
export default config;
