import Dexie, { type EntityTable } from "dexie";
import type {
  Profile,
  IncomeRevision,
  RecurringRevision,
  MonthlyPlan,
  MonthlyCommitment,
  DailyExpense,
  Category,
} from "@/types";
export class DaywiseDatabase extends Dexie {
  profiles!: EntityTable<Profile, "id">;
  incomes!: EntityTable<IncomeRevision, "id">;
  recurring!: EntityTable<RecurringRevision, "id">;
  plans!: EntityTable<MonthlyPlan, "id">;
  commitments!: EntityTable<MonthlyCommitment, "id">;
  expenses!: EntityTable<DailyExpense, "id">;
  categories!: EntityTable<Category, "id">;
  constructor(name = "daywise-local-v1") {
    super(name);
    this.version(1).stores({
      profiles: "id",
      incomes: "id, profileId, [profileId+effectiveMonth]",
      recurring:
        "id, profileId, [profileId+sourceId], [profileId+effectiveMonth]",
      plans: "id, profileId, &[profileId+yearMonth]",
      commitments: "id, profileId, [profileId+yearMonth]",
      expenses: "id, profileId, [profileId+date]",
      categories: "id, profileId, &[profileId+type+name]",
    });
  }
}
export const db = new DaywiseDatabase();
