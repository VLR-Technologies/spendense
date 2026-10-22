import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { DaywiseDatabase } from "@/lib/db";
import { LocalRepository, localAuth } from "@/lib/repositories/local";
import { summarize } from "@/lib/finance";
import type { MonthlyCommitment, DailyExpense } from "@/types";
let database: DaywiseDatabase;
let repo: LocalRepository;
let profileId: string;
const expense = (profileId: string, date = "2026-09-15"): DailyExpense => ({
  id: crypto.randomUUID(),
  profileId,
  date,
  amountMinor: 50000,
  category: "Food",
  description: "Lunch",
  notes: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
const commitment = (
  profileId: string,
  yearMonth = "2026-09",
): MonthlyCommitment => ({
  id: crypto.randomUUID(),
  profileId,
  yearMonth,
  name: "Rent",
  category: "Room Rent",
  amountMinor: 1000000,
  origin: "recurring",
  paid: false,
  notes: "",
});
beforeEach(async () => {
  database = new DaywiseDatabase(`test-${crypto.randomUUID()}`);
  repo = new LocalRepository(database);
  profileId = (await repo.createProfile("Personal")).id;
});
afterEach(async () => {
  await database.delete();
});
describe("local repository and history", () => {
  it("F: recurring defaults change forward without changing earlier saved plans", async () => {
    await repo.saveIncome(profileId, "2026-09", 10000000, "default");
    await repo.saveCommitment(commitment(profileId), "future");
    const september = await repo.getMonth(profileId, "2026-09");
    const october = await repo.getMonth(profileId, "2026-10");
    await repo.saveCommitment(
      { ...october.commitments[0], amountMinor: 1200000 },
      "future",
    );
    expect(summarize(await repo.getMonth(profileId, "2026-09")).fixed).toBe(
      summarize(september).fixed,
    );
    expect(summarize(await repo.getMonth(profileId, "2026-10")).fixed).toBe(
      1200000,
    );
    expect(summarize(await repo.getMonth(profileId, "2026-11")).fixed).toBe(
      1200000,
    );
  });
  it("H: profiles remain isolated across reads, edits, exports and deletes", async () => {
    const other = await repo.createProfile("Family");
    const e = expense(profileId);
    await repo.saveExpense(e);
    expect((await repo.getMonth(other.id, "2026-09")).expenses).toEqual([]);
    await expect(
      repo.saveExpense({ ...e, profileId: other.id }),
    ).rejects.toThrow("Profile mismatch");
    await repo.deleteExpense(other.id, e.id);
    expect((await repo.getMonth(profileId, "2026-09")).expenses).toHaveLength(
      1,
    );
    expect((await repo.exportProfile(other.id)).expenses).toEqual([]);
  });
  it("I: month overrides and one-time expenses stay in the selected month", async () => {
    await repo.saveIncome(profileId, "2026-09", 10000000, "default");
    await repo.saveIncome(profileId, "2026-10", 8000000, "month");
    await repo.saveCommitment(
      { ...commitment(profileId, "2026-10"), origin: "one-time" },
      "month",
    );
    await repo.saveExpense(expense(profileId, "2026-10-01"));
    const sep = await repo.getMonth(profileId, "2026-09");
    const oct = await repo.getMonth(profileId, "2026-10");
    const nov = await repo.getMonth(profileId, "2026-11");
    expect(sep.plan.monthlyIncomeMinor).toBe(10000000);
    expect(oct.plan.monthlyIncomeMinor).toBe(8000000);
    expect(oct.commitments).toHaveLength(1);
    expect(oct.expenses).toHaveLength(1);
    expect(nov.plan.monthlyIncomeMinor).toBe(10000000);
    expect(nov.commitments).toHaveLength(0);
    expect(nov.expenses).toHaveLength(0);
    await repo.saveIncome(profileId, "2026-10", 0, "reset");
    expect((await repo.getMonth(profileId, "2026-10")).plan).toMatchObject({
      monthlyIncomeMinor: 10000000,
      incomeOverride: false,
    });
  });
  it("income default revisions preserve older snapshots and future explicit overrides", async () => {
    await repo.saveIncome(profileId, "2026-09", 10000000, "default");
    await repo.getMonth(profileId, "2026-10");
    await repo.saveIncome(profileId, "2026-11", 20000000, "month");
    await repo.saveIncome(profileId, "2026-10", 12000000, "default");
    expect(
      (await repo.getMonth(profileId, "2026-09")).plan.monthlyIncomeMinor,
    ).toBe(10000000);
    expect(
      (await repo.getMonth(profileId, "2026-10")).plan.monthlyIncomeMinor,
    ).toBe(12000000);
    expect(
      (await repo.getMonth(profileId, "2026-11")).plan.monthlyIncomeMinor,
    ).toBe(20000000);
    expect(
      (await repo.getMonth(profileId, "2026-12")).plan.monthlyIncomeMinor,
    ).toBe(12000000);
  });
  it("opening the same month concurrently never duplicates recurring charges", async () => {
    await repo.saveCommitment(commitment(profileId), "future");
    await Promise.all(
      Array.from({ length: 5 }, () => repo.getMonth(profileId, "2026-10")),
    );
    expect(
      (await repo.getMonth(profileId, "2026-10")).commitments,
    ).toHaveLength(1);
    expect(
      await database.plans.where({ profileId, yearMonth: "2026-10" }).count(),
    ).toBe(1);
  });
  it("pause, resume and end-month schedules are deterministic", async () => {
    await repo.saveCommitment(commitment(profileId), "future", {
      endMonth: "2026-11",
    });
    const oct = await repo.getMonth(profileId, "2026-10");
    await repo.removeCommitment(oct.commitments[0], true);
    expect(
      (await repo.getMonth(profileId, "2026-09")).commitments,
    ).toHaveLength(1);
    expect(
      (await repo.getMonth(profileId, "2026-10")).commitments,
    ).toHaveLength(0);
    expect(
      (await repo.getMonth(profileId, "2026-11")).commitments,
    ).toHaveLength(0);
    await repo.saveCommitment(
      { ...oct.commitments[0], yearMonth: "2026-11" },
      "future",
      { active: true, endMonth: "2026-11" },
    );
    expect(
      (await repo.getMonth(profileId, "2026-11")).commitments,
    ).toHaveLength(1);
    expect(
      (await repo.getMonth(profileId, "2026-12")).commitments,
    ).toHaveLength(0);
  });
  it("single-month bill adjustments do not modify recurring defaults", async () => {
    await repo.saveCommitment(commitment(profileId), "future");
    const oct = await repo.getMonth(profileId, "2026-10");
    await repo.saveCommitment(
      { ...oct.commitments[0], amountMinor: 2000000 },
      "month",
    );
    expect(summarize(await repo.getMonth(profileId, "2026-10")).fixed).toBe(
      2000000,
    );
    expect(summarize(await repo.getMonth(profileId, "2026-11")).fixed).toBe(
      1000000,
    );
  });
  it("K: marking a recurring payment paid has no effect on total allocations", async () => {
    await repo.saveCommitment(commitment(profileId), "future");
    const data = await repo.getMonth(profileId, "2026-09");
    await repo.markPaid(data.commitments[0]);
    const updated = await repo.getMonth(profileId, "2026-09");
    expect(updated.commitments[0].paid).toBe(true);
    expect(summarize(updated).spendable).toBe(summarize(data).spendable);
  });
  it("L: saved data survives database close and reopen", async () => {
    await repo.saveIncome(profileId, "2026-09", 10000000, "default");
    await repo.saveCommitment(commitment(profileId), "future");
    await repo.saveExpense(expense(profileId));
    const before = await repo.getMonth(profileId, "2026-09");
    database.close();
    await database.open();
    expect(await repo.getMonth(profileId, "2026-09")).toEqual(before);
  });
  it("validates real dates and amounts before persistence", async () => {
    await expect(
      repo.saveExpense({ ...expense(profileId), date: "2026-02-30" }),
    ).rejects.toThrow();
    await expect(
      repo.saveExpense({ ...expense(profileId), amountMinor: 1.1 }),
    ).rejects.toThrow();
    await expect(repo.getMonth(profileId, "2026-13")).rejects.toThrow();
    expect(await database.expenses.count()).toBe(0);
  });
  it("expense reassignment removes the entry from the old month", async () => {
    const e = expense(profileId);
    await repo.saveExpense(e);
    await repo.saveExpense({ ...e, date: "2026-10-01", amountMinor: 40000 });
    expect((await repo.getMonth(profileId, "2026-09")).expenses).toHaveLength(
      0,
    );
    expect(
      (await repo.getMonth(profileId, "2026-10")).expenses[0].amountMinor,
    ).toBe(40000);
  });
});
describe("backup validation and restore", () => {
  it("retains future single-month overrides when an earlier recurring default changes", async () => {
    await repo.saveCommitment(commitment(profileId), "future");
    const october = await repo.getMonth(profileId, "2026-10");
    const november = await repo.getMonth(profileId, "2026-11");
    const september = await repo.getMonth(profileId, "2026-09");
    await repo.saveCommitment(
      { ...october.commitments[0], amountMinor: 1800000 },
      "month",
    );
    await repo.removeCommitment(november.commitments[0], false);
    await repo.saveCommitment(
      { ...september.commitments[0], amountMinor: 1200000 },
      "future",
    );
    expect(summarize(await repo.getMonth(profileId, "2026-10")).fixed).toBe(
      1800000,
    );
    expect(
      (await repo.getMonth(profileId, "2026-11")).commitments,
    ).toHaveLength(0);
    expect(summarize(await repo.getMonth(profileId, "2026-12")).fixed).toBe(
      1200000,
    );
  });
  it("demo data is isolated and contains the exact 30-day example", async () => {
    const demo = await repo.createProfile("Demo", true);
    const month = `${new Date().getFullYear()}-09`;
    const s = summarize(await repo.getMonth(demo.id, month));
    expect(s.income).toBe(10000000);
    expect(s.fixed).toBe(1900000);
    expect(s.days[14].allowance).toBe(270000);
    expect(s.days[14].spent).toBe(50000);
    expect(s.days[14].remaining).toBe(220000);
    expect((await repo.getMonth(profileId, month)).expenses).toHaveLength(0);
    await expect(repo.resetDemo(profileId)).rejects.toThrow("Only demo");
  });
  it("one-time commitments can become recurring without double allocation", async () => {
    const c = { ...commitment(profileId), origin: "one-time" as const };
    await repo.saveCommitment(c, "month");
    await repo.saveCommitment({ ...c, origin: "recurring" }, "future");
    expect(
      (await repo.getMonth(profileId, "2026-09")).commitments,
    ).toHaveLength(1);
    expect(
      (await repo.getMonth(profileId, "2026-10")).commitments,
    ).toHaveLength(1);
  });
  it("round-trips a full profile and rejects accidental duplicate imports", async () => {
    await repo.saveIncome(profileId, "2026-09", 10000000, "default");
    await repo.saveCommitment(commitment(profileId), "future");
    await repo.saveExpense(expense(profileId));
    await repo.addCategory(profileId, "Pets");
    const backup = await repo.exportProfile(profileId);
    await expect(repo.importProfile(backup, false)).rejects.toThrow(
      "already exists",
    );
    await repo.deleteProfile(profileId);
    await repo.importProfile(JSON.parse(JSON.stringify(backup)), false);
    expect((await repo.exportProfile(profileId)).expenses).toEqual(
      backup.expenses,
    );
    expect((await repo.getMonth(profileId, "2026-09")).commitments).toEqual(
      backup.commitments,
    );
    await repo.importProfile(backup, true);
    expect((await repo.getMonth(profileId, "2026-09")).expenses).toHaveLength(
      1,
    );
  });
  it("rejects mixed profiles, duplicate records, and incompatible files without changes", async () => {
    await repo.saveExpense(expense(profileId));
    const b = await repo.exportProfile(profileId);
    await expect(
      repo.importProfile({ ...b, version: 2 }, true),
    ).rejects.toThrow();
    await expect(
      repo.importProfile(
        { ...b, expenses: [...b.expenses, ...b.expenses] },
        true,
      ),
    ).rejects.toThrow("duplicate records");
    await expect(
      repo.importProfile(
        { ...b, expenses: [{ ...b.expenses[0], profileId: "wrong" }] },
        true,
      ),
    ).rejects.toThrow("mixed profile");
    expect((await repo.exportProfile(profileId)).expenses).toEqual(b.expenses);
  });
  it("rejects cross-profile ID collisions atomically", async () => {
    const e = expense(profileId);
    await repo.saveExpense(e);
    const other = await repo.createProfile("Family");
    const b = await repo.exportProfile(other.id);
    await expect(
      repo.importProfile(
        { ...b, expenses: [{ ...e, profileId: other.id }] },
        true,
      ),
    ).rejects.toThrow("conflict");
    expect((await repo.exportProfile(profileId)).expenses).toHaveLength(1);
    expect((await repo.exportProfile(other.id)).expenses).toHaveLength(0);
  });
});

describe("idempotent guest entry", () => {
  it("reuses a saved guest budget without changing its financial history", async () => {
    await repo.saveIncome(profileId, "2026-10", 1234567, "default");
    const before = summarize(await repo.getMonth(profileId, "2026-10"));
    const opened = await Promise.all(
      Array.from({ length: 5 }, () => repo.openGuestBudget()),
    );
    expect(new Set(opened.map((p) => p.id))).toEqual(new Set([profileId]));
    expect(await repo.profiles()).toHaveLength(1);
    expect(summarize(await repo.getMonth(profileId, "2026-10"))).toEqual(
      before,
    );
  });
  it("keeps demo and guest data separate and preserves every existing budget", async () => {
    const demo = await repo.openGuestBudget(true);
    const family = await repo.createProfile("Family");
    localAuth.selectLocalProfile(profileId);
    expect((await repo.openGuestBudget(true)).id).toBe(demo.id);
    expect((await repo.openGuestBudget()).id).toBe(profileId);
    expect((await repo.getMonth(profileId, "2026-10")).expenses).toHaveLength(
      0,
    );
    expect(
      (await repo.getMonth(demo.id, "2026-10")).expenses.length,
    ).toBeGreaterThan(0);
    expect((await repo.profiles()).map((p) => p.id)).toContain(family.id);
    expect(await repo.profiles()).toHaveLength(3);
  });
  it("creates only one default guest budget across concurrent first entry", async () => {
    await repo.deleteProfile(profileId);
    const opened = await Promise.all(
      Array.from({ length: 5 }, () => repo.openGuestBudget()),
    );
    expect(new Set(opened.map((p) => p.id)).size).toBe(1);
    expect(await repo.profiles()).toHaveLength(1);
  });
});
