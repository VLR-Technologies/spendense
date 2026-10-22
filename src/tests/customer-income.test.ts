import { describe, it, expect, vi } from "vitest";
import {
  defaultIncomeConfiguration as base,
  normalizeIncome,
  incomeConfigurationSchema,
} from "@/lib/customer-income";
import { CustomerRepository } from "@/lib/repositories/customer";
import type { SupabaseClient } from "@supabase/supabase-js";
describe("personal income estimates", () => {
  it.each(["2026-02", "2028-02", "2026-04", "2026-10"])(
    "keeps monthly paise exact in %s",
    (month) => {
      expect(
        normalizeIncome({ ...base, rateMinor: 1234567 }, month).amountMinor,
      ).toBe(1234567);
    },
  );
  it("rounds the annualized weekly estimate deterministically", () => {
    expect(
      normalizeIncome(
        { ...base, frequency: "weekly", rateMinor: 10001 },
        "2026-10",
      ),
    ).toEqual({
      amountMinor: 43338,
      explanation: expect.stringContaining("Annualized monthly estimate"),
    });
    expect(
      normalizeIncome({ ...base, frequency: "weekly", rateMinor: 1 }, "2026-10")
        .amountMinor,
    ).toBe(4);
  });
  it.each([
    ["2026-02", 20],
    ["2028-02", 21],
    ["2026-04", 22],
    ["2026-10", 22],
  ] as const)("counts selected paid weekdays in %s", (month, count) => {
    expect(
      normalizeIncome({ ...base, frequency: "daily", rateMinor: 12345 }, month)
        .amountMinor,
    ).toBe(count * 12345);
  });
  it("counts selected weekend days instead of assuming calendar days", () => {
    expect(
      normalizeIncome(
        { ...base, frequency: "daily", rateMinor: 100, workDays: [0, 6] },
        "2026-02",
      ).amountMinor,
    ).toBe(800);
  });
  it("requires a daily paid schedule and rejects duplicate weekdays", () => {
    expect(() =>
      normalizeIncome({ ...base, frequency: "daily", workDays: [] }, "2026-02"),
    ).toThrow("Select at least one paid working day.");
    expect(() =>
      normalizeIncome(
        { ...base, frequency: "daily", workDays: [1, 1] },
        "2026-02",
      ),
    ).toThrow();
  });
  it("uses business take-home without deducting costs twice", () => {
    const result = normalizeIncome(
      {
        ...base,
        category: "business",
        pattern: "seasonal",
        rateMinor: 5000000,
        revenueMinor: 20000000,
        costsMinor: 12000000,
      },
      "2026-10",
    );
    expect(result.amountMinor).toBe(5000000);
    expect(result.explanation).toContain("take-home");
  });
  it("accepts variable freelance income without a company", () => {
    expect(
      incomeConfigurationSchema.parse({
        ...base,
        category: "freelancer",
        pattern: "variable",
        organization: "",
      }),
    ).toMatchObject({ organization: "" });
  });
  it("bounds safe integer estimates and validates month/rates", () => {
    expect(() =>
      normalizeIncome(
        { ...base, frequency: "weekly", rateMinor: 100000000000 },
        "2026-10",
      ),
    ).toThrow(/exceeds/);
    expect(() =>
      normalizeIncome({ ...base, rateMinor: 0.1 }, "2026-10"),
    ).toThrow();
    expect(() => normalizeIncome(base, "2026-13")).toThrow(
      /valid budget month/,
    );
  });
});
describe("customer persistence", () => {
  it("scopes reads to the verified owner", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    expect(
      await new CustomerRepository(
        { from } as unknown as SupabaseClient,
        "owner-a",
      ).load(),
    ).toBeNull();
    expect(eq).toHaveBeenCalledWith("owner_id", "owner-a");
  });
  it("uses one idempotent atomic request and makes financial updates opt-in", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { configuration: base, revision: 1 },
      error: null,
    });
    await new CustomerRepository(
      { rpc } as unknown as SupabaseClient,
      "a",
    ).save({ configuration: base, requestId: "request", expectedRevision: 0 });
    expect(rpc).toHaveBeenCalledWith(
      "spendense_save_customer",
      expect.objectContaining({
        p_request: "request",
        p_profile: null,
        p_amount: null,
        p_expected_revision: 0,
      }),
    );
  });
  it.each([
    ["42P01", "service update"],
    ["40001", "another session"],
    ["offline", "retry"],
  ])("reports %s without replacing records", async (code, message) => {
    const rpc = vi.fn().mockResolvedValue({ error: { code }, data: null });
    await expect(
      new CustomerRepository({ rpc } as unknown as SupabaseClient, "a").save({
        configuration: base,
        requestId: "r",
        expectedRevision: 0,
      }),
    ).rejects.toThrow(message);
  });
});
