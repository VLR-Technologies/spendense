export type Theme = "light" | "dark" | "system";
export type Profile = {
  id: string;
  displayName: string;
  createdAt: string;
  demo: boolean;
  theme: Theme;
  onboardingComplete: boolean;
};
export type IncomeRevision = {
  id: string;
  profileId: string;
  effectiveMonth: string;
  amountMinor: number;
  currency: "INR";
};
export type RecurringRevision = {
  id: string;
  profileId: string;
  sourceId: string;
  effectiveMonth: string;
  name: string;
  category: string;
  amountMinor: number;
  currency: "INR";
  frequency: "monthly";
  active: boolean;
  startMonth: string;
  endMonth?: string;
  paymentDay?: number;
  notes: string;
};
export type MonthlyCommitment = {
  id: string;
  profileId: string;
  yearMonth: string;
  sourceId?: string;
  name: string;
  category: string;
  amountMinor: number;
  origin: "recurring" | "one-time";
  paid: boolean;
  monthOverride?: boolean;
  excluded?: boolean;
  paymentDay?: number;
  notes: string;
};
export type MonthlyPlan = {
  id: string;
  profileId: string;
  yearMonth: string;
  monthlyIncomeMinor: number;
  incomeOverride: boolean;
  createdAt: string;
};
export type DailyExpense = {
  id: string;
  profileId: string;
  date: string;
  amountMinor: number;
  category: string;
  description: string;
  time?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
export type Category = {
  id: string;
  profileId: string;
  name: string;
  type: "daily" | "commitment";
};
export type MonthData = {
  plan: MonthlyPlan;
  commitments: MonthlyCommitment[];
  expenses: DailyExpense[];
  recurring: RecurringRevision[];
  defaultIncomeMinor: number;
};
export type DaySummary = {
  date: string;
  day: number;
  gross: number;
  fixed: number;
  allowance: number;
  spent: number;
  remaining: number;
  future: boolean;
  expenses: DailyExpense[];
};
