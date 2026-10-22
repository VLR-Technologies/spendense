import type { SupabaseClient } from "@supabase/supabase-js";
import type { DaywiseRepository } from "./contracts";
import type {
  Profile,
  DailyExpense,
  MonthlyCommitment,
  RecurringRevision,
  MonthData,
} from "@/types";
import {
  backupSchema,
  profileSchema,
  expenseSchema,
  commitmentSchema,
  incomeSchema,
  categorySchema,
  monthSchema,
} from "@/lib/validation";
import { prepareMigration, canonical } from "@/lib/migration";
import { requireFinancialOperations } from "@/lib/deployment";

/** Normalise Postgres timestamps and nullable optional fields before domain validation. */
export function domainJSON(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(domainJSON);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k, v]) => v !== null && k !== "owner_id")
        .map(([k, v]) => [
          k,
          ["createdAt", "updatedAt", "exportedAt"].includes(k) &&
          typeof v === "string"
            ? new Date(v).toISOString()
            : domainJSON(v),
        ]),
    );
  return value;
}
function cloudError(error: { code?: string; message?: string }) {
  if (
    ["42P01", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(
      error.code ?? "",
    )
  )
    return new Error(
      "Cloud storage is not ready. Contact the Spendense operator or use a separate local workspace. Your records have not been replaced.",
    );
  if (["42501", "PGRST301", "PGRST302", "PGRST303"].includes(error.code ?? ""))
    return new Error(
      "Cloud access expired or this workspace is unavailable. Sign in again or switch to Local.",
    );
  if (error.code === "23505")
    return new Error(
      error.message?.includes("already imported")
        ? error.message
        : "This record already exists. Refresh before retrying; histories were not merged.",
    );
  return new Error(
    "Cloud operation failed. Check your connection and retry. No offline changes were queued.",
  );
}
export class CloudRepository implements DaywiseRepository {
  constructor(
    private client: SupabaseClient,
    readonly owner: string,
  ) {
    requireFinancialOperations();
  }
  private async rpc(name: string, args: Record<string, unknown>) {
    requireFinancialOperations();
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw cloudError(error);
    return data;
  }
  async profiles() {
    requireFinancialOperations();
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("owner_id", this.owner)
      .order("createdAt");
    if (error) throw cloudError(error);
    return (data ?? []).map((p) => profileSchema.parse(domainJSON(p)));
  }
  async createProfile(name: string, demo = false) {
    requireFinancialOperations();
    if (demo) throw new Error("Try demo data in Local mode.");
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      displayName: name,
      createdAt: new Date().toISOString(),
      demo: false,
      theme: "light",
      onboardingComplete: false,
    });
    const { error } = await this.client
      .from("profiles")
      .insert({ ...profile, owner_id: this.owner });
    if (error) throw cloudError(error);
    return profile;
  }
  async updateProfile(
    id: string,
    values: Partial<
      Pick<Profile, "displayName" | "theme" | "onboardingComplete">
    >,
  ) {
    requireFinancialOperations();
    const validated = profileSchema
      .pick({ displayName: true, theme: true, onboardingComplete: true })
      .partial()
      .parse(values);
    const { data, error } = await this.client
      .from("profiles")
      .update(validated)
      .eq("id", id)
      .eq("owner_id", this.owner)
      .select("id")
      .single();
    if (error || !data) throw cloudError(error ?? { code: "42501" });
  }
  async getMonth(profileId: string, month: string): Promise<MonthData> {
    requireFinancialOperations();
    monthSchema.parse(month);
    const b = backupSchema.parse(
      domainJSON(
        await this.rpc("daywise_month", { p_id: profileId, p_month: month }),
      ),
    );
    const plan = b.plans.find((p) => p.yearMonth === month);
    if (!plan) throw new Error("Cloud month is unavailable. Retry loading it.");
    return {
      plan,
      recurring: b.recurring,
      commitments: b.commitments.filter(
        (c) => c.yearMonth === month && !c.excluded,
      ),
      expenses: b.expenses.filter((e) => e.date.startsWith(month)),
      defaultIncomeMinor:
        [...b.incomes]
          .filter((i) => i.effectiveMonth <= month)
          .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0]
          ?.amountMinor ?? 0,
    };
  }
  async saveIncome(
    profileId: string,
    month: string,
    amountMinor: number,
    scope: "month" | "default" | "reset",
  ) {
    requireFinancialOperations();
    incomeSchema.parse({
      id: "validation",
      profileId,
      effectiveMonth: month,
      amountMinor,
      currency: "INR",
    });
    await this.rpc("daywise_income", {
      p_id: profileId,
      p_month: month,
      p_amount: amountMinor,
      p_scope: scope,
    });
  }
  async saveCommitment(
    c: MonthlyCommitment,
    scope: "month" | "future",
    options: Partial<RecurringRevision> = {},
  ) {
    requireFinancialOperations();
    await this.rpc("daywise_commitment", {
      p_record: commitmentSchema.parse(c),
      p_scope: scope,
      p_options: options,
    });
  }
  async saveExpense(expense: DailyExpense) {
    requireFinancialOperations();
    const { error } = await this.client
      .from("daily_expenses")
      .upsert({ ...expenseSchema.parse(expense), owner_id: this.owner });
    if (error) throw cloudError(error);
  }
  async deleteExpense(profileId: string, id: string) {
    requireFinancialOperations();
    const { error } = await this.client
      .from("daily_expenses")
      .delete()
      .eq("id", id)
      .eq("profileId", profileId)
      .eq("owner_id", this.owner);
    if (error) throw cloudError(error);
  }
  async markPaid(c: MonthlyCommitment) {
    requireFinancialOperations();
    // Explicit target state makes retrying an interrupted save idempotent.
    await this.rpc("daywise_set_paid", {
      p_id: c.profileId,
      p_commitment: c.id,
      p_paid: !c.paid,
    });
  }
  async removeCommitment(c: MonthlyCommitment, future: boolean) {
    requireFinancialOperations();
    await this.rpc("daywise_remove", {
      p_id: c.profileId,
      p_commitment: c.id,
      p_future: future,
    });
  }
  async addCategory(profileId: string, name: string) {
    requireFinancialOperations();
    const category = categorySchema.parse({
      id: crypto.randomUUID(),
      profileId,
      name,
      type: "daily",
    });
    const { error } = await this.client
      .from("categories")
      .upsert(
        { ...category, owner_id: this.owner },
        { onConflict: "profileId,type,name", ignoreDuplicates: true },
      );
    if (error) throw cloudError(error);
  }
  async categories(profileId: string) {
    requireFinancialOperations();
    const { data, error } = await this.client
      .from("categories")
      .select("*")
      .eq("profileId", profileId)
      .eq("owner_id", this.owner);
    if (error) throw cloudError(error);
    return (data ?? []).map((c) => categorySchema.parse(domainJSON(c)));
  }
  async exportProfile(profileId: string) {
    requireFinancialOperations();
    return backupSchema.parse(
      domainJSON(await this.rpc("daywise_export", { p_id: profileId })),
    );
  }
  async migrate(input: unknown) {
    requireFinancialOperations();
    const prepared = await prepareMigration(input, this.owner);
    const result = await this.rpc("daywise_import", {
      p_backup: prepared.backup,
      p_source: prepared.source,
      p_fingerprint: prepared.fingerprint,
      p_manifest: prepared.manifest,
      p_owner: this.owner,
    });
    if (canonical(result.manifest) !== canonical(prepared.manifest))
      throw new Error(
        "Import verification failed. Keep your local backup and retry.",
      );
    const profiles = await this.profiles();
    const profile = profiles.find((p) => p.id === result.profileId);
    if (!profile)
      throw new Error(
        "Import receipt found, but its workspace is unavailable. Keep the local copy.",
      );
    return {
      profile,
      repeated: !!result.repeated,
      manifest: prepared.manifest,
    };
  }
  async importProfile(input: unknown, replace: boolean) {
    requireFinancialOperations();
    if (replace)
      throw new Error(
        "Cloud imports create a separate profile. Switch to Local to replace a local backup.",
      );
    return (await this.migrate(input)).profile;
  }
  async deleteProfile(id: string) {
    requireFinancialOperations();
    const { data, error } = await this.client
      .from("profiles")
      .delete()
      .eq("id", id)
      .eq("owner_id", this.owner)
      .select("id")
      .single();
    if (error || !data) throw cloudError(error ?? { code: "42501" });
  }
  async resetDemo(): Promise<void> {
    requireFinancialOperations();
    throw new Error("Reset demo data in Local mode.");
  }
}
