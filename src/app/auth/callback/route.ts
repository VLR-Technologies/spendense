import { callbackOrigin } from "@/lib/auth-redirect";
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
  const origin = callbackOrigin(request);
  const failed = () =>
    NextResponse.redirect(new URL("/dashboard?auth_error=callback", origin), {
      headers: { "Cache-Control": "private, no-store" },
    });
  const code = url.searchParams.get("code");
  // Provider cancellation/errors never reach code exchange or expose provider details.
  if (url.searchParams.has("error") || !code) return failed();
  let client;
  try {
    client = await serverClient();
  } catch {
    return failed();
  }
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
  return failed();
}
