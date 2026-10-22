import type {
  Profile,
  MonthData,
  DailyExpense,
  Theme,
  MonthlyCommitment,
  RecurringRevision,
  Category,
} from "@/types";
import type { Backup } from "@/lib/validation";
export interface AuthProvider {
  currentLocalProfile(): string | null;
  selectLocalProfile(id: string): void;
}
export interface UserRepository {
  profiles(): Promise<Profile[]>;
  createProfile(name: string, demo?: boolean): Promise<Profile>;
  updateProfile(
    id: string,
    values: {
      displayName?: string;
      theme?: Theme;
      onboardingComplete?: boolean;
    },
  ): Promise<void>;
}
export interface IncomeRepository {
  saveIncome(
    profileId: string,
    month: string,
    amountMinor: number,
    scope: "month" | "default" | "reset",
  ): Promise<void>;
}
export interface ExpenseRepository {
  saveExpense(expense: DailyExpense): Promise<void>;
  deleteExpense(profileId: string, id: string): Promise<void>;
}
export interface MonthlyPlanRepository {
  getMonth(profileId: string, month: string): Promise<MonthData>;
  saveCommitment(
    commitment: MonthlyCommitment,
    scope: "month" | "future",
    revision?: Partial<RecurringRevision>,
  ): Promise<void>;
}
export interface BackupRepository {
  exportProfile(profileId: string): Promise<Backup>;
  importProfile(input: unknown, replace: boolean): Promise<Profile>;
}
/** Complete storage boundary used by presentation and the composition root. */
export interface DaywiseRepository
  extends
    UserRepository,
    IncomeRepository,
    ExpenseRepository,
    MonthlyPlanRepository,
    BackupRepository {
  removeCommitment(c: MonthlyCommitment, future: boolean): Promise<void>;
  markPaid(c: MonthlyCommitment): Promise<void>;
  addCategory(profileId: string, name: string): Promise<void>;
  categories(profileId: string): Promise<Category[]>;
  deleteProfile(profileId: string): Promise<void>;
  resetDemo(profileId: string): Promise<void>;
}
