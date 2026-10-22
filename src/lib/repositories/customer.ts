import type { SupabaseClient } from "@supabase/supabase-js";
import { requireFinancialOperations } from "../deployment";
import {
  incomeConfigurationSchema,
  type IncomeConfiguration,
  type CustomerPreferences,
} from "../customer-income";
export type CustomerSave = {
  configuration: IncomeConfiguration;
  requestId: string;
  expectedRevision: number;
  budget?: {
    id: string;
    month: string;
    amountMinor: number | null;
    scope: "month" | "default";
    expectedIncome: number;
    expectedOverride: boolean;
  };
};
export function customerStorageError(error: { code?: string }) {
  return new Error(
    ["42P01", "PGRST205", "PGRST202"].includes(error.code ?? "")
      ? "Personal & Income Details are not available until the service update is installed. Your existing budgets are unchanged."
      : error.code === "40001"
        ? "Your details or budget changed in another session. Reload and review before saving again."
        : "Could not save or load personal details. Check your connection and retry. Your existing budget has not been replaced.",
  );
}
export class CustomerRepository {
  constructor(
    private client: SupabaseClient,
    private owner: string,
  ) {}
  async load(): Promise<CustomerPreferences | null> {
    requireFinancialOperations();
    const { data, error } = await this.client
      .from("customer_financial_preferences")
      .select("owner_id,configuration,completed_at,revision")
      .eq("owner_id", this.owner)
      .maybeSingle();
    if (error) throw customerStorageError(error);
    if (!data) return null;
    const parsed = incomeConfigurationSchema.safeParse(data.configuration);
    if (!parsed.success)
      throw new Error(
        "Your income preferences could not be read. Existing budgets are unchanged. Retry or contact support.",
      );
    return { ...data, configuration: parsed.data };
  }
  async save(input: CustomerSave): Promise<CustomerPreferences> {
    requireFinancialOperations();
    const configuration = incomeConfigurationSchema.parse(input.configuration);
    const b = input.budget;
    const { data, error } = await this.client.rpc("spendense_save_customer", {
      p_configuration: configuration,
      p_request: input.requestId,
      p_expected_revision: input.expectedRevision,
      p_profile: b?.id ?? null,
      p_month: b?.month ?? null,
      p_amount: b?.amountMinor ?? null,
      p_scope: b?.scope ?? "month",
      p_expected_income: b?.expectedIncome ?? null,
      p_expected_override: b?.expectedOverride ?? null,
    });
    if (error) throw customerStorageError(error);
    return {
      ...data,
      configuration: incomeConfigurationSchema.parse(data.configuration),
    };
  }
}
