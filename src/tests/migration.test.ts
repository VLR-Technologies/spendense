import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DaywiseDatabase } from "@/lib/db";
import { LocalRepository } from "@/lib/repositories/local";
import { prepareMigration, manifest, canonical } from "@/lib/migration";
import { CloudRepository, domainJSON } from "@/lib/repositories/cloud";
import { validateBackup } from "@/lib/backup";
import { summarize } from "@/lib/finance";
import type { SupabaseClient } from "@supabase/supabase-js";
let db: DaywiseDatabase, repo: LocalRepository;
beforeEach(() => {
  db = new DaywiseDatabase(`migration-${crypto.randomUUID()}`);
  repo = new LocalRepository(db);
});
afterEach(async () => {
  await db.delete();
});
async function fixture() {
  const p = await repo.createProfile("Paise history");
  for (const month of ["2024-02", "2025-02", "2026-04", "2026-10"]) {
    await repo.saveIncome(p.id, month, 100001, "default");
    await repo.saveCommitment(
      {
        id: crypto.randomUUID(),
        profileId: p.id,
        yearMonth: month,
        name: "Rent",
        category: "Room Rent",
        amountMinor: 20003,
        origin: "recurring",
        paid: true,
        notes: "",
      },
      "future",
    );
    await repo.saveExpense({
      id: crypto.randomUUID(),
      profileId: p.id,
      date: `${month}-01`,
      amountMinor: 101,
      description: "Coffee",
      category: "Coffee",
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  await repo.addCategory(p.id, "Handmade");
  return repo.exportProfile(p.id);
}
describe("consented local migration preparation", () => {
  it("maps every parent/source consistently, preserves records and all allocations without touching IndexedDB", async () => {
    const b = await fixture();
    const prepared = await prepareMigration(b, "alice");
    expect(prepared.backup.profile.id).not.toBe(b.profile.id);
    expect(validateBackup(prepared.backup)).toEqual(prepared.backup);
    expect(manifest(prepared.backup)).toEqual(manifest(b));
    expect(await repo.exportProfile(b.profile.id)).toMatchObject({
      ...b,
      exportedAt: expect.any(String),
    });
    for (const p of b.plans) {
      const old = await repo.getMonth(b.profile.id, p.yearMonth);
      const mapped = {
        ...old,
        plan: prepared.backup.plans.find((x) => x.yearMonth === p.yearMonth)!,
        commitments: prepared.backup.commitments.filter(
          (c) => c.yearMonth === p.yearMonth && !c.excluded,
        ),
        expenses: prepared.backup.expenses.filter((e) =>
          e.date.startsWith(p.yearMonth),
        ),
      };
      const before = summarize(old, `${p.yearMonth}-28`),
        after = summarize(mapped, `${p.yearMonth}-28`);
      expect(
        after.days.map((d) => [
          d.gross,
          d.fixed,
          d.allowance,
          d.spent,
          d.remaining,
        ]),
      ).toEqual(
        before.days.map((d) => [
          d.gross,
          d.fixed,
          d.allowance,
          d.spent,
          d.remaining,
        ]),
      );
    }
  });
  it("has stable retry IDs/fingerprint across exports and collection ordering, with account isolation", async () => {
    const b = await fixture();
    const a = await prepareMigration(b, "alice");
    const retry = await prepareMigration(
      {
        ...b,
        exportedAt: new Date().toISOString(),
        expenses: [...b.expenses].reverse(),
      },
      "alice",
    );
    const other = await prepareMigration(b, "bob");
    expect(retry.fingerprint).toBe(a.fingerprint);
    expect(retry.backup.profile.id).toBe(a.backup.profile.id);
    expect(other.backup.profile.id).not.toBe(a.backup.profile.id);
    expect(other.backup.recurring[0].sourceId).not.toBe(
      a.backup.recurring[0].sourceId,
    );
  });
  it("rejects mixed ownership, missing parents, duplicates, corrupt money before upload", async () => {
    const b = await fixture();
    expect(() =>
      validateBackup({
        ...b,
        expenses: [{ ...b.expenses[0], profileId: "bob" }],
      }),
    ).toThrow(/mixed/);
    expect(() => validateBackup({ ...b, plans: [] })).toThrow(
      /no monthly plan/,
    );
    expect(() =>
      validateBackup({ ...b, expenses: [b.expenses[0], b.expenses[0]] }),
    ).toThrow(/duplicate/);
    expect(() => validateBackup({ ...b, recurring: [] })).toThrow(/source/);
    await expect(
      prepareMigration(
        { ...b, expenses: [{ ...b.expenses[0], amountMinor: 1.5 }] },
        "alice",
      ),
    ).rejects.toThrow();
  });
  it("keeps zero income, negative budgets and excluded/paid snapshot flags exact", async () => {
    const b = await fixture();
    const zero = {
      ...b,
      plans: b.plans.map((p) => ({ ...p, monthlyIncomeMinor: 0 })),
      commitments: b.commitments.map((c, i) => ({
        ...c,
        paid: true,
        excluded: i === 0,
        monthOverride: true,
      })),
    };
    const result = await prepareMigration(zero, "alice");
    expect(result.manifest).toEqual(manifest(zero));
    expect(result.backup.commitments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paid: true,
          excluded: true,
          monthOverride: true,
        }),
      ]),
    );
  });
  it("reports network failures without deleting local records or queuing writes", async () => {
    const b = await fixture();
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    const cloud = new CloudRepository(
      { rpc } as unknown as SupabaseClient,
      "alice",
    );
    await expect(cloud.migrate(b)).rejects.toThrow(/connection.*retry/);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect((await repo.exportProfile(b.profile.id)).expenses).toEqual(
      b.expenses,
    );
  });
  it("verifies returned receipts and converts database nullable fields/timestamps safely", async () => {
    expect(
      domainJSON({
        createdAt: "2026-10-22T10:00:00+00:00",
        sourceId: null,
        amountMinor: 101,
      }),
    ).toEqual({ createdAt: "2026-10-22T10:00:00.000Z", amountMinor: 101 });
    const b = await fixture();
    const cloud = new CloudRepository(
      {
        rpc: vi.fn().mockResolvedValue({ data: { manifest: {} }, error: null }),
      } as unknown as SupabaseClient,
      "alice",
    );
    await expect(cloud.migrate(b)).rejects.toThrow(/verification/);
    expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 }));
  });
});
