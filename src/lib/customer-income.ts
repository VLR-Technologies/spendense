import { z } from "zod";
import { daysInMonth, dateAt } from "./dates";

const minor = z.number().int().min(0).max(100_000_000_000);
export const incomeConfigurationSchema = z
  .object({
    category: z.enum(["salaried", "freelancer", "business", "other"]),
    organization: z.string().trim().max(120).default(""),
    occupation: z.string().trim().max(120).default(""),
    pattern: z.enum(["regular", "variable", "seasonal"]),
    frequency: z.enum(["monthly", "weekly", "daily"]),
    rateMinor: minor,
    workDays: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .refine(
        (v) => new Set(v).size === v.length,
        "Select each paid weekday only once.",
      ),
    revenueMinor: minor.nullable().default(null),
    costsMinor: minor.nullable().default(null),
    notes: z.string().trim().max(500).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.frequency === "daily" && !v.workDays.length)
      ctx.addIssue({
        code: "custom",
        message: "Select at least one paid working day.",
        path: ["workDays"],
      });
    if (v.category === "business" && v.frequency !== "monthly")
      ctx.addIssue({
        code: "custom",
        message: "Business budgeting uses monthly personal take-home income.",
        path: ["frequency"],
      });
  });
export type IncomeConfiguration = z.infer<typeof incomeConfigurationSchema>;
export type CustomerPreferences = {
  owner_id: string;
  configuration: IncomeConfiguration;
  completed_at: string;
  revision: number;
};
export const defaultIncomeConfiguration: IncomeConfiguration = {
  category: "salaried",
  organization: "",
  occupation: "",
  pattern: "regular",
  frequency: "monthly",
  rateMinor: 0,
  workDays: [1, 2, 3, 4, 5],
  revenueMinor: null,
  costsMinor: null,
  notes: "",
};
/** Budget estimation only. Existing monthly plans/revisions remain authoritative. */
export function normalizeIncome(input: IncomeConfiguration, month: string) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    month < "1900-01" ||
    month > "2200-12"
  )
    throw new Error("Choose a valid budget month.");
  const parsed = incomeConfigurationSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      parsed.error.issues[0]?.message ?? "Check your income details.",
    );
  const config = parsed.data;
  const count = daysInMonth(month);
  let amount: bigint;
  let explanation: string;
  if (config.frequency === "weekly") {
    amount = (BigInt(config.rateMinor) * 52n + 6n) / 12n;
    explanation =
      "Weekly rate × 52 ÷ 12, rounded to the nearest paise. Annualized monthly estimate, not actual cash received.";
  } else if (config.frequency === "daily") {
    const paidDays = Array.from({ length: count }, (_, i) =>
      new Date(`${dateAt(month, i + 1)}T12:00:00`).getDay(),
    ).filter((d) => config.workDays.includes(d)).length;
    amount = BigInt(config.rateMinor) * BigInt(paidDays);
    explanation = `Daily rate × ${paidDays} selected paid working days in this month. This is an estimate; holidays and unpaid leave are not deducted.`;
  } else {
    amount = BigInt(config.rateMinor);
    explanation =
      config.category === "business"
        ? "Confirmed monthly personal take-home. Business revenue and costs are excluded from personal budget deductions."
        : "Monthly personal income allocation. This does not verify income received.";
  }
  if (amount > 100_000_000_000n)
    throw new Error(
      "Estimated monthly income exceeds the supported amount. Enter a lower rate.",
    );
  return { amountMinor: Number(amount), explanation };
}
export const employmentLabels = {
  salaried: "Salaried Employee",
  freelancer: "Self-employed / Freelancer",
  business: "Business Owner",
  other: "Other / Variable income",
};
