import { backupSchema, type Backup } from "./validation";

/** Full relational and safe-integer validation, shared by local restore and cloud import. */
export function validateBackup(input: unknown): Backup {
  const b = backupSchema.parse(input);
  const monthTotals = new Map<string, number>();
  for (const record of [
    ...b.commitments.filter((c) => !c.excluded),
    ...b.expenses,
  ]) {
    const month =
      "yearMonth" in record ? record.yearMonth : record.date.slice(0, 7);
    const total = (monthTotals.get(month) ?? 0) + record.amountMinor;
    if (!Number.isSafeInteger(total))
      throw new Error("Backup exceeds the supported financial range");
    monthTotals.set(month, total);
  }
  const sources = new Set(b.recurring.map((r) => r.sourceId));
  if (
    b.commitments.some(
      (c) =>
        c.origin === "recurring" && (!c.sourceId || !sources.has(c.sourceId)),
    )
  )
    throw new Error("Backup is missing a recurring source");
  const collections = [
    b.incomes,
    b.recurring,
    b.plans,
    b.commitments,
    b.expenses,
    b.categories,
  ];
  for (const records of collections) {
    if (records.some((r) => r.profileId !== b.profile.id))
      throw new Error("Backup contains mixed profile data");
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error("Backup contains duplicate records");
  }
  if (new Set(b.plans.map((p) => p.yearMonth)).size !== b.plans.length)
    throw new Error("Duplicate monthly plans");
  if (new Set(b.incomes.map((p) => p.effectiveMonth)).size !== b.incomes.length)
    throw new Error("Duplicate income revisions");
  if (
    new Set(b.recurring.map((p) => `${p.sourceId}:${p.effectiveMonth}`))
      .size !== b.recurring.length
  )
    throw new Error("Duplicate recurring revisions");
  if (
    new Set(b.categories.map((p) => `${p.type}:${p.name}`)).size !==
    b.categories.length
  )
    throw new Error("Duplicate categories");
  const planMonths = new Set(b.plans.map((p) => p.yearMonth));
  if (b.commitments.some((c) => !planMonths.has(c.yearMonth)))
    throw new Error("Commitment has no monthly plan");
  const recurringKeys = b.commitments
    .filter((c) => c.sourceId)
    .map((c) => `${c.yearMonth}:${c.sourceId}`);
  if (new Set(recurringKeys).size !== recurringKeys.length)
    throw new Error("Duplicate recurring charges");
  if (b.commitments.some((c) => c.origin === "one-time" && c.sourceId))
    throw new Error("One-time commitments cannot have a recurring source");
  return b;
}
