import { describe, it, expect, vi, afterEach } from "vitest";
const mocks = vi.hoisted(() => ({
  server: vi.fn(),
  browser: vi.fn(),
  google: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ serverClient: mocks.server }));
vi.mock("@/lib/supabase/browser", () => ({ browserClient: mocks.browser }));
vi.mock("@/lib/google-provider", () => ({
  requireGoogleProvider: mocks.google,
}));
import { GET as callback } from "@/app/auth/callback/route";
import { GET as identity } from "@/app/api/auth/route";
import { auth } from "@/lib/auth";
import { supabaseConfig, supabaseEnvironment } from "@/lib/supabase/config";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
describe("authentication boundaries", () => {
  it("disables cloud without credentials and refuses elevated browser keys without crashing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(supabaseConfig()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_forbidden");
    expect(supabaseConfig()).toBeNull();
    expect(supabaseEnvironment().status).toBe("unsafe-key");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      `a.${btoa(JSON.stringify({ role: "service_role" }))}.c`,
    );
    expect(supabaseConfig()).toBeNull();
    expect(supabaseEnvironment().status).toBe("unsafe-key");
  });
  it("exchanges the PKCE code and verifies claims before accepting a callback", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    const getClaims = vi
      .fn()
      .mockResolvedValue({ data: { claims: { sub: "alice" } }, error: null });
    mocks.server.mockResolvedValue({
      auth: { exchangeCodeForSession, getClaims },
    });
    const response = await callback(
      new Request(
        "http://localhost:3100/auth/callback?code=valid&next=https://evil.test",
        { headers: { host: "127.0.0.1:3100" } },
      ),
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid");
    expect(getClaims).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3100/dashboard",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects a callback with an unverified or expired session", async () => {
    mocks.server.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        getClaims: vi
          .fn()
          .mockResolvedValue({ data: null, error: new Error("expired") }),
      },
    });
    const response = await callback(
      new Request("http://localhost:3100/auth/callback?code=bad"),
    );
    expect(response.headers.get("location")).toContain("auth_error=callback");
  });
  it("does not exchange codes for cancelled OAuth or reveal provider descriptions", async () => {
    const exchangeCodeForSession = vi.fn();
    mocks.server.mockResolvedValue({ auth: { exchangeCodeForSession } });
    const response = await callback(
      new Request(
        "https://spendense.com/auth/callback?error=access_denied&error_description=private-provider-details&code=do-not-exchange",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "https://spendense.com/dashboard?auth_error=callback",
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("redirects a successful production code exchange straight to the canonical dashboard", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    mocks.server.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        getClaims: vi
          .fn()
          .mockResolvedValue({
            data: { claims: { sub: "verified" } },
            error: null,
          }),
      },
    });
    const response = await callback(
      new Request("https://www.spendense.com/auth/callback?code=valid"),
    );
    expect(response.headers.get("location")).toBe(
      "https://spendense.com/dashboard",
    );
  });
  it("sanitizes server-client construction failures", async () => {
    mocks.server.mockRejectedValue(new Error("private backend response"));
    const response = await callback(
      new Request("https://spendense.com/auth/callback?code=valid"),
    );
    expect(response.headers.get("location")).toBe(
      "https://spendense.com/dashboard?auth_error=callback",
    );
  });
  it("never accepts client identity as server authorization", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "verified", email: "verified@example.test" } },
      error: null,
    });
    mocks.server.mockResolvedValue({ auth: { getUser } });
    const response = await identity();
    expect(getUser).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({
      user: { id: "verified", email: "verified@example.test" },
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("distinguishes absent sessions from unavailable verification", async () => {
    mocks.server.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ error: { status: 401 } }) },
    });
    expect((await identity()).status).toBe(401);
    mocks.server.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ error: { status: 500 } }) },
    });
    expect((await identity()).status).toBe(503);
    mocks.server.mockResolvedValue(null);
    expect(await (await identity()).json()).toEqual({
      user: null,
      configured: false,
    });
  });
  it("sends Google and email login through the same origin-bound callback", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ error: null }),
      signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    mocks.browser.mockReturnValue({ auth: { signInWithOAuth, signInWithOtp } });
    await auth.signIn("google");
    await auth.signIn("email", "you@example.test");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "you@example.test",
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
  });
  it("does not report success on provider or sign-out failures", async () => {
    mocks.browser.mockReturnValue({
      auth: {
        signInWithOAuth: vi
          .fn()
          .mockResolvedValue({ error: { message: "Provider unavailable" } }),
        signOut: vi.fn().mockResolvedValue({ error: { message: "offline" } }),
      },
    });
    await expect(auth.signIn("google")).rejects.toThrow(
      "Could not start Google sign-in",
    );
    await expect(auth.signOut()).rejects.toThrow(/retry/);
  });
  it("signs up using the current origin and distinguishes confirmation from a session", async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ data: { session: null }, error: null });
    mocks.browser.mockReturnValue({ auth: { signUp } });
    await expect(
      auth.signUp(" you@example.test ", "long-password"),
    ).resolves.toEqual({ confirmationRequired: true });
    expect(signUp).toHaveBeenCalledWith({
      email: "you@example.test",
      password: "long-password",
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    signUp.mockResolvedValue({
      data: { session: { user: { id: "verified" } } },
      error: null,
    });
    await expect(
      auth.signUp("you@example.test", "long-password"),
    ).resolves.toEqual({ confirmationRequired: false });
  });
  it("stores customer names only through Supabase user metadata", async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ data: { session: null }, error: null });
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    mocks.browser.mockReturnValue({ auth: { signUp, updateUser } });
    await auth.signUp("alex@example.test", "long-password", "  Alex 王  ");
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ data: { full_name: "Alex 王" } }),
      }),
    );
    await auth.updateDisplayName("Élodie 李");
    expect(updateUser).toHaveBeenCalledWith({
      data: { full_name: "Élodie 李" },
    });
    await expect(auth.updateDisplayName(" ")).rejects.toThrow(/name/);
    updateUser.mockResolvedValue({ error: { message: "Session expired" } });
    await expect(auth.updateDisplayName("Alex")).rejects.toThrow(
      "Session expired",
    );
  });
  it("returns names only from the verified server user", async () => {
    mocks.server.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "a",
              email: "alex@example.test",
              user_metadata: { full_name: "Alex 王" },
            },
          },
          error: null,
        }),
      },
    });
    expect(await (await identity()).json()).toEqual({
      user: { id: "a", email: "alex@example.test", displayName: "Alex 王" },
    });
  });
  it("validates credentials before calling Supabase and preserves password whitespace", async () => {
    const signUp = vi.fn(),
      signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    mocks.browser.mockReturnValue({ auth: { signUp, signInWithPassword } });
    await expect(auth.signUp("bad", "long-password")).rejects.toThrow(/email/);
    await expect(auth.signUp("you@example.test", "short")).rejects.toThrow(/8/);
    expect(signUp).not.toHaveBeenCalled();
    await auth.signInWithPassword(" you@example.test ", " password ");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "you@example.test",
      password: " password ",
    });
  });
  it("reports password sign-in failures without revealing whether an account exists", async () => {
    mocks.browser.mockReturnValue({
      auth: {
        signInWithPassword: vi
          .fn()
          .mockResolvedValue({ error: { code: "invalid_credentials" } }),
      },
    });
    await expect(
      auth.signInWithPassword("you@example.test", "wrong"),
    ).rejects.toThrow(/Email or password is incorrect/);
  });
  it("allows a signed-in email-link user to set a new password", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    mocks.browser.mockReturnValue({ auth: { updateUser } });
    await expect(auth.updatePassword("short")).rejects.toThrow(/8/);
    expect(updateUser).not.toHaveBeenCalled();
    await auth.updatePassword("new-long-password");
    expect(updateUser).toHaveBeenCalledWith({ password: "new-long-password" });
  });
  it("recovers from a thrown provider network failure without leaking the callback code", async () => {
    mocks.server.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockRejectedValue(new Error("offline")),
      },
    });
    const response = await callback(
      new Request("http://localhost:3100/auth/callback?code=secret-code"),
    );
    expect(response.headers.get("location")).toContain("auth_error=callback");
    expect(response.headers.get("location")).not.toContain("secret-code");
    mocks.server.mockResolvedValue({
      auth: { getUser: vi.fn().mockRejectedValue(new Error("offline")) },
    });
    expect((await identity()).status).toBe(503);
  });
});
