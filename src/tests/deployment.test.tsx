import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appMode, financialOperationsEnabled } from "@/lib/deployment";
import { AppProvider } from "@/components/provider";
import { auth } from "@/lib/auth";
import { db, DaywiseDatabase } from "@/lib/db";
import { LocalRepository } from "@/lib/repositories/local";
import { CloudRepository } from "@/lib/repositories/cloud";
import { supabaseConfig, supabaseEnvironment } from "@/lib/supabase/config";
import { browserClient } from "@/lib/supabase/browser";
import { serverClient } from "@/lib/supabase/server";
import { supabaseFetch } from "@/lib/supabase/fetch";
import { GET as identity } from "@/app/api/auth/route";
import { GET as callback } from "@/app/auth/callback/route";
import { proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("deployment lock", () => {
  it.each([undefined, "", "invalid", "LIVE", "maintenance", "staging"])(
    "keeps %s locked and never mounts a workspace",
    (mode) => {
      vi.stubEnv("NEXT_PUBLIC_APP_MODE", mode);
      expect(financialOperationsEnabled()).toBe(false);
      expect(appMode()).toBe(mode === "staging" ? "staging" : "maintenance");
      const current = vi.spyOn(auth, "current");
      const subscribe = vi.spyOn(auth, "subscribe");
      const open = vi.spyOn(db, "open");
      render(
        <AppProvider>
          <div>Financial workspace mounted</div>
        </AppProvider>,
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "You cannot enter, import, or change financial data",
      );
      expect(
        screen.queryByText("Financial workspace mounted"),
      ).not.toBeInTheDocument();
      expect(current).not.toHaveBeenCalled();
      expect(subscribe).not.toHaveBeenCalled();
      expect(open).not.toHaveBeenCalled();
    },
  );

  it.each(["maintenance", "staging"])(
    "blocks clients and direct authentication requests in %s even with configuration",
    async (mode) => {
      vi.stubEnv("NEXT_PUBLIC_APP_MODE", mode);
      // Unit-only configuration; no SDK client or network request may be created.
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://unit.example.test");
      vi.stubEnv(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "sb_publishable_unit_fixture",
      );
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      expect(supabaseConfig()).toBeNull();
      expect(browserClient()).toBeNull();
      expect(await serverClient()).toBeNull();
      expect(await auth.current()).toBeNull();
      expect(auth.configured()).toBe(false);
      await expect(auth.signIn("google")).rejects.toThrow(/paused/);
      await expect(
        auth.signUp("test@example.test", "unit-password"),
      ).rejects.toThrow(/paused/);
      await expect(auth.signOut()).rejects.toThrow(/paused/);
      const response = await identity();
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        user: null,
        maintenance: true,
      });
      expect(
        (
          await callback(
            new Request("https://app.example.test/auth/callback?code=private"),
          )
        ).status,
      ).toBe(503);
      const forwarded = await proxy(
        new NextRequest("https://app.example.test/calendar"),
      );
      expect(forwarded.status).toBe(200);
      expect(forwarded.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("refuses local reads and writes while keeping existing records intact", async () => {
    const database = new DaywiseDatabase(`deployment-${crypto.randomUUID()}`);
    const repository = new LocalRepository(database);
    try {
      const profile = await repository.createProfile(
        "Existing local workspace",
      );
      await repository.saveIncome(profile.id, "2026-10", 12345, "month");
      const before = await repository.exportProfile(profile.id);
      vi.stubEnv("NEXT_PUBLIC_APP_MODE", "maintenance");
      expect(() => repository.profiles()).toThrow(/paused/);
      await expect(repository.getMonth(profile.id, "2026-10")).rejects.toThrow(
        /paused/,
      );
      await expect(repository.createProfile("New")).rejects.toThrow(/paused/);
      await expect(
        repository.saveIncome(profile.id, "2026-10", 999, "month"),
      ).rejects.toThrow(/paused/);
      await expect(repository.importProfile(before, true)).rejects.toThrow(
        /paused/,
      );
      await expect(repository.deleteProfile(profile.id)).rejects.toThrow(
        /paused/,
      );
      vi.stubEnv("NEXT_PUBLIC_APP_MODE", "live");
      const after = await repository.exportProfile(profile.id);
      expect({ ...after, exportedAt: "" }).toEqual({
        ...before,
        exportedAt: "",
      });
    } finally {
      await database.delete();
    }
  });

  it("guards existing cloud repository instances and reports missing migrations without fallback data", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    const from = vi.fn();
    const client = { rpc, from } as unknown as SupabaseClient;
    const repository = new CloudRepository(client, "unit-owner");
    await expect(repository.getMonth("profile", "2026-10")).rejects.toThrow(
      /Cloud storage is not ready/,
    );
    rpc.mockClear();
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "staging");
    expect(() => new CloudRepository(client, "unit-owner")).toThrow(/paused/);
    await expect(repository.getMonth("profile", "2026-10")).rejects.toThrow(
      /paused/,
    );
    await expect(repository.createProfile("New")).rejects.toThrow(/paused/);
    await expect(repository.profiles()).rejects.toThrow(/paused/);
    await expect(repository.deleteProfile("profile")).rejects.toThrow(/paused/);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});

describe("unavailable backend", () => {
  it.each([
    "invalid",
    "javascript:alert(1)",
    "http://remote.example.test",
    "https://user:password@example.test",
    "https://example.test?key=private",
  ])("disables malformed/unsafe URL %s", (url) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_unit_fixture",
    );
    expect(supabaseEnvironment().status).toBe("invalid");
    expect(browserClient()).toBeNull();
  });

  it("aborts a stalled service request and preserves caller cancellation", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            signals.push(init.signal);
            init.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      ),
    );
    const stalled = expect(
      supabaseFetch("https://unit.example.test"),
    ).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(8000);
    await stalled;
    expect(signals[0].aborted).toBe(true);
    const controller = new AbortController();
    const cancelled = expect(
      supabaseFetch("https://unit.example.test", { signal: controller.signal }),
    ).rejects.toThrow("aborted");
    controller.abort();
    await cancelled;
    expect(signals[1].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
