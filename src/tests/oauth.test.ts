import { afterEach, describe, it, expect, vi } from "vitest";
import { googleCallbackUrl, callbackOrigin } from "@/lib/auth-redirect";
import { requireGoogleProvider } from "@/lib/google-provider";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Google canonical destinations", () => {
  it.each([
    "https://spendense.com",
    "https://www.spendense.com",
    "http://spendense.com",
    "http://www.spendense.com",
  ])("uses the www HTTPS callback from %s", (origin) => {
    expect(googleCallbackUrl(origin)).toBe(
      "https://www.spendense.com/auth/callback",
    );
    expect(callbackOrigin(new Request(`${origin}/auth/callback`))).toBe(
      "https://www.spendense.com",
    );
  });
  it("keeps isolated local PKCE on the local cookie origin", () => {
    expect(googleCallbackUrl("http://127.0.0.1:3100")).toBe(
      "http://127.0.0.1:3100/auth/callback",
    );
  });
  it.each(["http://localhost:3000", "https://spendense.com"])(
    "ignores stale application setting %s for production requests",
    (configured) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", configured);
      expect(
        callbackOrigin(new Request("https://www.spendense.com/auth/callback")),
      ).toBe("https://www.spendense.com");
    },
  );
  it.each(["spendense.com", "www.spendense.com"])(
    "keeps proxied production callbacks on www for Host %s",
    (host) => {
      vi.stubEnv("NODE_ENV", "production");
      expect(
        callbackOrigin(
          new Request("http://localhost/auth/callback", {
            headers: { host },
          }),
        ),
      ).toBe("https://www.spendense.com");
    },
  );
  it("rejects cross-origin or malformed configured callback destinations", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://evil.test");
    expect(
      callbackOrigin(new Request("https://preview.example.test/auth/callback")),
    ).toBe("https://preview.example.test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "broken");
    expect(
      callbackOrigin(new Request("https://preview.example.test/auth/callback")),
    ).toBe("https://preview.example.test");
  });
});
describe("public Google provider availability", () => {
  function configure() {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  }
  it("accepts an enabled provider using only public settings and the public API key", async () => {
    configure();
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ external: { google: true } }));
    vi.stubGlobal("fetch", fetch);
    await requireGoogleProvider();
    expect(fetch).toHaveBeenCalledWith(
      "https://test.supabase.co/auth/v1/settings",
      expect.objectContaining({
        headers: { apikey: "sb_publishable_test" },
        credentials: "omit",
        cache: "no-store",
      }),
    );
  });
  it("reports disabled Google without showing backend JSON", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ external: { google: false } })),
    );
    await expect(requireGoogleProvider()).rejects.toThrow(
      "Google sign-in is not enabled yet. Use email or continue as a guest.",
    );
  });
  it.each(["http", "json", "network"])(
    "sanitizes %s failures",
    async (kind) => {
      configure();
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      if (kind === "http")
        fetch.mockResolvedValue(
          new Response('{"private":"do-not-show"}', { status: 500 }),
        );
      else if (kind === "json")
        fetch.mockResolvedValue(new Response("invalid-json"));
      else fetch.mockRejectedValue(new Error("sensitive-backend-detail"));
      await expect(requireGoogleProvider()).rejects.toThrow(
        "Could not check Google sign-in availability. Retry, use email, or continue as a guest.",
      );
    },
  );
});
