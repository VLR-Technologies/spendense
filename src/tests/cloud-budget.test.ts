import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types";
import { CloudRepository } from "@/lib/repositories/cloud";
function fixture() {
  const records = new Map<string, Profile & { owner_id: string }>();
  const insert = vi.fn(async (record: Profile & { owner_id: string }) => {
    if (records.has(record.id)) return { error: { code: "23505" } };
    records.set(record.id, record);
    return { error: null };
  });
  const client = {
    from: vi.fn(() => ({
      insert,
      select: () => ({
        eq: (_field: string, owner: string) => ({
          order: async () => ({
            data: [...records.values()].filter((p) => p.owner_id === owner),
            error: null,
          }),
        }),
      }),
    })),
  } as unknown as SupabaseClient;
  return { records, insert, client };
}
describe("first account budget creation", () => {
  it("reuses existing budgets and never creates on repeat account entry", async () => {
    const f = fixture();
    const repo = new CloudRepository(f.client, "alice");
    const first = await repo.openPersonalBudget();
    expect((await repo.openPersonalBudget()).id).toBe(first.id);
    expect(f.insert).toHaveBeenCalledOnce();
    expect(f.records.size).toBe(1);
  });
  it("deduplicates concurrent first creation and keeps account ownership separate", async () => {
    const f = fixture();
    const alice = new CloudRepository(f.client, "alice");
    const results = await Promise.all(
      Array.from({ length: 5 }, () => alice.openPersonalBudget()),
    );
    expect(new Set(results.map((p) => p.id)).size).toBe(1);
    expect(f.records.size).toBe(1);
    const bob = await new CloudRepository(f.client, "bob").openPersonalBudget();
    expect(bob.id).not.toBe(results[0].id);
    expect(await alice.profiles()).toHaveLength(1);
    expect(f.records.size).toBe(2);
  });
});
