import { z } from "zod";
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .refine(
    (s) => s >= "1900-01" && s <= "2200-12",
    "Choose a month between 1900 and 2200",
  );
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return (
      !isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === s &&
      s.slice(0, 7) >= "1900-01" &&
      s.slice(0, 7) <= "2200-12"
    );
  }, "Invalid calendar date");
const minor = z.number().int().min(0).max(100_000_000_000);
const base = { id: z.string().min(1), profileId: z.string().min(1) };
export const profileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().trim().min(1).max(50),
  createdAt: z.iso.datetime(),
  demo: z.boolean(),
  theme: z.enum(["light", "dark", "system"]),
  onboardingComplete: z.boolean(),
});
export const expenseSchema = z.object({
  ...base,
  date: dateSchema,
  amountMinor: minor.positive(),
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(100),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  notes: z.string().max(2000),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const commitmentSchema = z.object({
  ...base,
  yearMonth: monthSchema,
  sourceId: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  category: z.string().min(1).max(60),
  amountMinor: minor.positive(),
  origin: z.enum(["recurring", "one-time"]),
  paid: z.boolean(),
  monthOverride: z.boolean().optional(),
  excluded: z.boolean().optional(),
  paymentDay: z.number().int().min(1).max(31).optional(),
  notes: z.string().max(2000),
});
export const recurringSchema = z
  .object({
    ...base,
    sourceId: z.string().min(1),
    effectiveMonth: monthSchema,
    name: z.string().trim().min(1).max(100),
    category: z.string().min(1).max(60),
    amountMinor: minor.positive(),
    currency: z.literal("INR"),
    frequency: z.literal("monthly"),
    active: z.boolean(),
    startMonth: monthSchema,
    endMonth: monthSchema.optional(),
    paymentDay: z.number().int().min(1).max(31).optional(),
    notes: z.string().max(2000),
  })
  .refine(
    (r) => !r.endMonth || r.endMonth >= r.startMonth,
    "End month must follow start month",
  );
export const incomeSchema = z.object({
  ...base,
  effectiveMonth: monthSchema,
  amountMinor: minor,
  currency: z.literal("INR"),
});
export const planSchema = z.object({
  ...base,
  yearMonth: monthSchema,
  monthlyIncomeMinor: minor,
  incomeOverride: z.boolean(),
  createdAt: z.iso.datetime(),
});
export const categorySchema = z.object({
  ...base,
  name: z.string().trim().min(1).max(60),
  type: z.enum(["daily", "commitment"]),
});
export const backupSchema = z.object({
  format: z.literal("daywise"),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  profile: profileSchema,
  incomes: z.array(incomeSchema).max(10000),
  recurring: z.array(recurringSchema).max(20000),
  plans: z.array(planSchema).max(10000),
  commitments: z.array(commitmentSchema).max(100000),
  expenses: z.array(expenseSchema).max(100000),
  categories: z.array(categorySchema).max(1000),
});
export type Backup = z.infer<typeof backupSchema>;
