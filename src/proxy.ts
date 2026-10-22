import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig, sessionCookieOptions } from "@/lib/supabase/config";
import { supabaseFetch } from "@/lib/supabase/fetch";
import { financialOperationsEnabled } from "@/lib/deployment";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!financialOperationsEnabled()) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  const config = supabaseConfig();
  if (!config) return response;
  const sessionHeaders = new Headers();
  const client = createServerClient(config.url, config.key, {
    cookieOptions: sessionCookieOptions,
    global: { fetch: supabaseFetch },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        const previousCookies = response.cookies.getAll();
        response = NextResponse.next({ request });
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          sessionHeaders.set(name, value),
        );
        sessionHeaders.forEach((value, name) =>
          response.headers.set(name, value),
        );
      },
    },
  });
  try {
    await client.auth.getClaims();
  } catch {
    /* Guest routes remain available during outages. */
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp)$).*)",
  ],
};
