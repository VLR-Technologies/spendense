import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig, sessionCookieOptions } from "./config";
import { supabaseFetch } from "./fetch";
export async function serverClient() {
  const config = supabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: sessionCookieOptions,
    global: { fetch: supabaseFetch },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        // Called only from Route Handlers; Proxy handles refresh for pages.
        values.forEach(({ name, value, options }) =>
          store.set(name, value, options),
        );
      },
    },
  });
}
