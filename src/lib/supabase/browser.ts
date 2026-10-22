import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig, sessionCookieOptions } from "./config";
import { supabaseFetch } from "./fetch";
export function browserClient() {
  const config = supabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.key, {
    cookieOptions: sessionCookieOptions,
    global: { fetch: supabaseFetch },
  });
}
