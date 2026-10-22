import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { financialOperationsEnabled } from "@/lib/deployment";
export async function GET(request: Request) {
  if (!financialOperationsEnabled())
    return new Response("Spendense sign-in is paused during maintenance.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store", "Retry-After": "3600" },
    });
  const url = new URL(request.url);
  // Next's local server may normalise request.url to localhost. Keep the
  // browser's loopback host so host-only PKCE/session cookies survive redirects.
  const localHost = request.headers.get("host");
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV !== "production" &&
    localHost &&
    /^(127\.0\.0\.1|localhost):\d+$/.test(localHost)
      ? `http://${localHost}`
      : url.origin);
  const code = url.searchParams.get("code");
  const client = await serverClient();
  if (code && client) {
    try {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data, error: verified } = await client.auth.getClaims();
        if (!verified && data?.claims.sub)
          return NextResponse.redirect(new URL("/dashboard", origin), {
            headers: { "Cache-Control": "private, no-store" },
          });
      }
    } catch {
      // Network failures use the same recoverable error as invalid codes.
      // Never include provider details, tokens or codes in the destination URL.
    }
  }
  return NextResponse.redirect(
    new URL("/dashboard?auth_error=callback", origin),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
