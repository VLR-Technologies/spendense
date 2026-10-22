import { validateBackup } from "./backup";
import type { Backup } from "./validation";
import { sum } from "./finance";
export const collections = [
  "incomes",
  "recurring",
  "plans",
  "commitments",
  "expenses",
  "categories",
] as const;
export function manifest(b: Backup) {
  return {
    counts: Object.fromEntries(collections.map((k) => [k, b[k].length])),
    totals: Object.fromEntries(
      collections
        .filter((k) => k !== "categories")
        .map((k) => [
          k,
          sum(
            b[k].map((r) =>
              "amountMinor" in r
                ? r.amountMinor
                : "monthlyIncomeMinor" in r
                  ? r.monthlyIncomeMinor
                  : 0,
            ),
          ),
        ]),
    ),
    months: Object.fromEntries(
      b.plans.map((p) => [
        p.yearMonth,
        {
          income: p.monthlyIncomeMinor,
          fixed: sum(
            b.commitments
              .filter((c) => c.yearMonth === p.yearMonth && !c.excluded)
              .map((c) => c.amountMinor),
          ),
          spent: sum(
            b.expenses
              .filter((e) => e.date.startsWith(p.yearMonth))
              .map((e) => e.amountMinor),
          ),
        },
      ]),
    ),
  };
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
async function digest(text: string) {
  const bytes = new TextEncoder().encode(text);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function prepareMigration(input: unknown, owner: string) {
  const original = validateBackup(input);
  // Export time and array order don't change an import's identity.
  const fingerprint = await digest(
    canonical({
      ...original,
      exportedAt: undefined,
      ...Object.fromEntries(
        collections.map((k) => [
          k,
          [...original[k]].sort((a, b) =>
            a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
          ),
        ]),
      ),
    }),
  );
  const map = async (namespace: string, localId: string) => {
    const hash = await digest(
      canonical(["daywise-v1", owner, original.profile.id, namespace, localId]),
    );
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  };
  const profileId = await map("profile", original.profile.id);
  const backup: Backup = {
    ...original,
    profile: { ...original.profile, id: profileId },
  };
  for (const key of collections) {
    // Each collection retains its precise domain type.
    const mapped = await Promise.all(
      original[key].map(async (r) => ({
        ...r,
        id: await map(key, r.id),
        profileId,
        ...("sourceId" in r && r.sourceId
          ? { sourceId: await map("source", r.sourceId) }
          : {}),
      })),
    );
    Object.assign(backup, { [key]: mapped });
  }
  const expected = manifest(backup);
  if (canonical(expected) !== canonical(manifest(original)))
    throw new Error("Migration changed financial totals.");
  return {
    backup,
    source: original.profile.id,
    fingerprint,
    manifest: expected,
  };
}
