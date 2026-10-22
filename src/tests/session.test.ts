import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));
import { proxy } from "@/proxy";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("SSR session refresh", () => {
  it("forwards refreshed cookies to the request and response with SDK cache headers", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const getClaims = vi.fn();
    mocks.createServerClient.mockImplementation((_url, _key, options) => {
      getClaims.mockImplementation(async () => {
        options.cookies.setAll(
          [
            {
              name: "auth-token",
              value: "refreshed",
              options: { path: "/", sameSite: "lax" },
            },
          ],
          {
            "Cache-Control": "private, no-store",
            Pragma: "no-cache",
            Expires: "0",
          },
        );
        // The SDK only supplies cache headers on the first write in a request.
        options.cookies.setAll(
          [{ name: "verifier", value: "", options: { path: "/", maxAge: 0 } }],
          {},
        );
        return { data: { claims: { sub: "alice" } }, error: null };
      });
      return { auth: { getClaims } };
    });
    const request = new NextRequest("https://app.test/dashboard", {
      headers: { cookie: "auth-token=expired" },
    });
    const response = await proxy(request);
    expect(getClaims).toHaveBeenCalledOnce();
    expect(request.cookies.get("auth-token")?.value).toBe("refreshed");
    expect(response.cookies.get("auth-token")?.value).toBe("refreshed");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
  });
  it("keeps guest routes available when the auth server cannot refresh", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    mocks.createServerClient.mockReturnValue({
      auth: { getClaims: vi.fn().mockRejectedValue(new Error("offline")) },
    });
    const response = await proxy(new NextRequest("https://app.test/dashboard"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("location")).toBeNull();
  });
});
