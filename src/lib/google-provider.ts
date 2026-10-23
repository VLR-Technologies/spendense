import { supabaseConfig } from "./supabase/config";
import { supabaseFetch } from "./supabase/fetch";
/** Public capability check: never redirect customers to disabled-provider raw JSON. */
export async function requireGoogleProvider() {
  const config = supabaseConfig();
  if (!config)
    throw new Error(
      "Cloud sign-in is not configured. You can continue as a guest.",
    );
  let settings;
  try {
    const response = await supabaseFetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key },
      cache: "no-store",
      credentials: "omit",
    });
    if (!response.ok) throw new Error();
    settings = await response.json();
    if (typeof settings?.external?.google !== "boolean") throw new Error();
  } catch {
    throw new Error(
      "Could not check Google sign-in availability. Retry, use email, or continue as a guest.",
    );
  }
  if (!settings.external.google)
    throw new Error(
      "Google sign-in is not enabled yet. Use email or continue as a guest.",
    );
}
