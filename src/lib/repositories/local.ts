import { requireFinancialOperations } from "@/lib/deployment";
import { validateBackup } from "@/lib/backup";
import { DaywiseDatabase, db } from "@/lib/db";
import type {
  Profile,
  MonthlyPlan,
  RecurringRevision,
  MonthlyCommitment,
  DailyExpense,
  MonthData,
  IncomeRevision,
} from "@/types";
import {
  backupSchema,
  categorySchema,
  commitmentSchema,
  expenseSchema,
  incomeSchema,
  monthSchema,
  profileSchema,
  recurringSchema,
  type Backup,
} from "@/lib/validation";
import { thisMonth, today, dateAt, daysInMonth } from "@/lib/dates";
import type {
  UserRepository,
  IncomeRepository,
  ExpenseRepository,
  MonthlyPlanRepository,
  BackupRepository,
  AuthProvider,
} from "./contracts";
const id = () => crypto.randomUUID();
const stamp = () => new Date().toISOString();
export function applicableIncome(
  revisions: IncomeRevision[],
  month: string,
): number {
  return (
    revisions
      .filter((r) => r.effectiveMonth <= month)
      .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0]
      ?.amountMinor ?? 0
  );
}
export function applicableRecurring(
  revisions: RecurringRevision[],
  month: string,
): RecurringRevision[] {
  const latest = new Map<string, RecurringRevision>();
  revisions
    .filter((r) => r.effectiveMonth <= month)
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
    .forEach((r) => latest.set(r.sourceId, r));
  return [...latest.values()].filter(
    (r) =>
      r.active && r.startMonth <= month && (!r.endMonth || r.endMonth >= month),
  );
}
export class LocalRepository
  implements
    UserRepository,
    IncomeRepository,
    ExpenseRepository,
    MonthlyPlanRepository,
    BackupRepository
{
  constructor(public database: DaywiseDatabase = db) {}
  profiles() {
    requireFinancialOperations();
    return this.database.profiles.toArray();
  }
  async createProfile(name: string, demo = false) {
    requireFinancialOperations();
    const profile = profileSchema.parse({
      id: id(),
      displayName: name,
      demo,
      createdAt: stamp(),
      theme: "light",
      onboardingComplete: demo,
    });
    await this.database.transaction("rw", this.tables(), async () => {
      await this.database.profiles.add(profile);
      if (demo) await this.seedDemo(profile.id);
    });
    return profile;
  }
  async updateProfile(
    profileId: string,
    values: Partial<
      Pick<Profile, "displayName" | "theme" | "onboardingComplete">
    >,
  ) {
    requireFinancialOperations();
    const p = await this.database.profiles.get(profileId);
    if (!p) throw new Error("Profile not found");
    await this.database.profiles.put(profileSchema.parse({ ...p, ...values }));
  }
  private tables() {
    return [
      this.database.profiles,
      this.database.incomes,
      this.database.recurring,
      this.database.plans,
      this.database.commitments,
      this.database.expenses,
      this.database.categories,
    ];
  }
  async getMonth(profileId: string, month: string): Promise<MonthData> {
    requireFinancialOperations();
    monthSchema.parse(month);
    return this.database.transaction("rw", this.tables(), async () => {
      if (!(await this.database.profiles.get(profileId)))
        throw new Error("Profile not found");
      const incomes = await this.database.incomes
        .where({ profileId })
        .toArray();
      const revisions = await this.database.recurring
        .where({ profileId })
        .toArray();
      const defaultIncomeMinor = applicableIncome(incomes, month);
      let plan = await this.database.plans
        .where({ profileId, yearMonth: month })
        .first();
      if (!plan) {
        plan = {
          id: id(),
          profileId,
          yearMonth: month,
          monthlyIncomeMinor: defaultIncomeMinor,
          incomeOverride: false,
          createdAt: stamp(),
        };
        await this.database.plans.add(plan);
        const commitments = applicableRecurring(revisions, month).map((r) =>
          this.materialize(r, month),
        );
        await this.database.commitments.bulkAdd(commitments);
      }
      return {
        plan,
        commitments: await this.database.commitments
          .where({ profileId, yearMonth: month })
          .filter((c) => !c.excluded)
          .toArray(),
        expenses: await this.database.expenses
          .where("[profileId+date]")
          .between(
            [profileId, `${month}-01`],
            [profileId, `${month}-31`],
            true,
            true,
          )
          .toArray(),
        recurring: revisions,
        defaultIncomeMinor,
      };
    });
  }
  private materialize(r: RecurringRevision, month: string): MonthlyCommitment {
    return {
      id: id(),
      profileId: r.profileId,
      yearMonth: month,
      sourceId: r.sourceId,
      name: r.name,
      category: r.category,
      amountMinor: r.amountMinor,
      origin: "recurring",
      paid: false,
      paymentDay: r.paymentDay,
      notes: r.notes,
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
    await this.getMonth(profileId, month);
    await this.database.transaction(
      "rw",
      [this.database.incomes, this.database.plans],
      async () => {
        const revisions = await this.database.incomes
          .where({ profileId })
          .toArray();
        if (scope === "default") {
          const previous = revisions.find((r) => r.effectiveMonth === month);
          await this.database.incomes.put({
            id: previous?.id ?? id(),
            profileId,
            effectiveMonth: month,
            amountMinor,
            currency: "INR",
          });
          const updated = await this.database.incomes
            .where({ profileId })
            .toArray();
          const plans = await this.database.plans
            .where({ profileId })
            .toArray();
          for (const p of plans)
            if (p.yearMonth >= month && !p.incomeOverride)
              await this.database.plans.update(p.id, {
                monthlyIncomeMinor: applicableIncome(updated, p.yearMonth),
              });
        }
        const plan = (await this.database.plans
          .where({ profileId, yearMonth: month })
          .first()) as MonthlyPlan;
        await this.database.plans.update(plan.id, {
          monthlyIncomeMinor:
            scope === "reset"
              ? applicableIncome(revisions, month)
              : amountMinor,
          incomeOverride: scope === "month",
        });
      },
    );
  }
  async saveExpense(input: DailyExpense) {
    requireFinancialOperations();
    const expense = expenseSchema.parse(input);
    const previous = await this.database.expenses.get(expense.id);
    if (previous && previous.profileId !== expense.profileId)
      throw new Error("Profile mismatch");
    if (!(await this.database.profiles.get(expense.profileId)))
      throw new Error("Profile not found");
    await this.database.expenses.put(expense);
  }
  async deleteExpense(profileId: string, expenseId: string) {
    requireFinancialOperations();
    await this.database.expenses.where({ id: expenseId, profileId }).delete();
  }
  async saveCommitment(
    input: MonthlyCommitment,
    scope: "month" | "future",
    options: Partial<RecurringRevision> = {},
  ) {
    requireFinancialOperations();
    const c = commitmentSchema.parse(input);
    await this.getMonth(c.profileId, c.yearMonth);
    await this.database.transaction("rw", this.tables(), async () => {
      const previous = await this.database.commitments.get(c.id);
      if (previous && previous.profileId !== c.profileId)
        throw new Error("Profile mismatch");
      if (scope === "future") {
        const sourceId = c.sourceId ?? id();
        const revisions = await this.database.recurring
          .where({ profileId: c.profileId, sourceId })
          .toArray();
        const existing = revisions.find(
          (r) => r.effectiveMonth === c.yearMonth,
        );
        const revision = recurringSchema.parse({
          id: existing?.id ?? id(),
          profileId: c.profileId,
          sourceId,
          effectiveMonth: c.yearMonth,
          name: c.name,
          category: c.category,
          amountMinor: c.amountMinor,
          currency: "INR",
          frequency: "monthly",
          active: true,
          startMonth: c.yearMonth,
          notes: c.notes,
          paymentDay: c.paymentDay,
          ...options,
        });
        await this.database.recurring.put(revision);
        await this.database.commitments.put({
          ...c,
          sourceId,
          origin: "recurring",
          monthOverride: false,
          excluded: false,
        });
        const plans = await this.database.plans
          .where({ profileId: c.profileId })
          .toArray();
        const all = await this.database.recurring
          .where({ profileId: c.profileId })
          .toArray();
        for (const plan of plans.filter((p) => p.yearMonth > c.yearMonth)) {
          const effective = applicableRecurring(all, plan.yearMonth).find(
            (r) => r.sourceId === sourceId,
          );
          const old = await this.database.commitments
            .where({ profileId: c.profileId, yearMonth: plan.yearMonth })
            .filter((x) => x.sourceId === sourceId)
            .first();
          if (effective && !old?.monthOverride)
            await this.database.commitments.put({
              ...this.materialize(effective, plan.yearMonth),
              id: old?.id ?? id(),
              paid: old?.paid ?? false,
            });
          else if (!effective && old)
            await this.database.commitments.delete(old.id);
        }
        if (
          !revision.active ||
          (revision.endMonth && revision.endMonth < c.yearMonth) ||
          revision.startMonth > c.yearMonth
        )
          await this.database.commitments.delete(c.id);
      } else
        await this.database.commitments.put({
          ...c,
          monthOverride: !!c.sourceId,
        });
    });
  }
  async removeCommitment(c: MonthlyCommitment, future: boolean) {
    requireFinancialOperations();
    if (future && c.sourceId)
      await this.saveCommitment(c, "future", { active: false });
    else if (c.sourceId)
      await this.database.commitments
        .where({ id: c.id, profileId: c.profileId })
        .modify({ excluded: true, monthOverride: true });
    else
      await this.database.commitments
        .where({ id: c.id, profileId: c.profileId })
        .delete();
  }
  async markPaid(c: MonthlyCommitment) {
    requireFinancialOperations();
    await this.database.commitments
      .where({ id: c.id, profileId: c.profileId })
      .modify({ paid: !c.paid });
  }
  async addCategory(profileId: string, name: string) {
    requireFinancialOperations();
    const c = categorySchema.parse({
      id: id(),
      profileId,
      name,
      type: "daily",
    });
    if (
      !(await this.database.categories
        .where({ profileId, type: "daily", name: c.name })
        .first())
    )
      await this.database.categories.add(c);
  }
  async categories(profileId: string) {
    requireFinancialOperations();
    return this.database.categories.where({ profileId }).toArray();
  }
  async exportProfile(profileId: string): Promise<Backup> {
    requireFinancialOperations();
    return this.database.transaction("r", this.tables(), async () =>
      backupSchema.parse({
        format: "daywise",
        version: 1,
        exportedAt: stamp(),
        profile: await this.database.profiles.get(profileId),
        incomes: await this.database.incomes.where({ profileId }).toArray(),
        recurring: await this.database.recurring.where({ profileId }).toArray(),
        plans: await this.database.plans.where({ profileId }).toArray(),
        commitments: await this.database.commitments
          .where({ profileId })
          .toArray(),
        expenses: await this.database.expenses.where({ profileId }).toArray(),
        categories: await this.database.categories
          .where({ profileId })
          .toArray(),
      }),
    );
  }
  async importProfile(input: unknown, replace: boolean): Promise<Profile> {
    requireFinancialOperations();
    const b = validateBackup(input);
    const collections = [
      b.incomes,
      b.recurring,
      b.plans,
      b.commitments,
      b.expenses,
      b.categories,
    ];
    await this.database.transaction("rw", this.tables(), async () => {
      const exists = await this.database.profiles.get(b.profile.id);
      if (exists && !replace)
        throw new Error(
          "This profile already exists. Confirm replacement to restore it.",
        );
      const tables = [
        this.database.incomes,
        this.database.recurring,
        this.database.plans,
        this.database.commitments,
        this.database.expenses,
        this.database.categories,
      ];
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        for (const record of collections[i]) {
          const collision = await table.get(record.id);
          if (collision && collision.profileId !== b.profile.id)
            throw new Error("Backup identifiers conflict with another profile");
        }
        await table.where({ profileId: b.profile.id }).delete();
      }
      await this.database.profiles.put(b.profile);
      await this.database.incomes.bulkPut(b.incomes);
      await this.database.recurring.bulkPut(b.recurring);
      await this.database.plans.bulkPut(b.plans);
      await this.database.commitments.bulkPut(b.commitments);
      await this.database.expenses.bulkPut(b.expenses);
      await this.database.categories.bulkPut(b.categories);
    });
    return b.profile;
  }
  async deleteProfile(profileId: string) {
    requireFinancialOperations();
    await this.database.transaction("rw", this.tables(), async () => {
      for (const table of this.tables().slice(1))
        await table.where({ profileId }).delete();
      await this.database.profiles.delete(profileId);
    });
  }
  async resetDemo(profileId: string) {
    requireFinancialOperations();
    const p = await this.database.profiles.get(profileId);
    if (!p?.demo) throw new Error("Only demo profiles can be reset");
    await this.database.transaction("rw", this.tables(), async () => {
      for (const table of this.tables().slice(1))
        await table.where({ profileId }).delete();
      await this.seedDemo(profileId);
    });
  }
  private async seedDemo(profileId: string) {
    const month = thisMonth();
    const demoMonths = [month, `${Number(month.slice(0, 4))}-09`]
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
    await this.database.incomes.add({
      id: id(),
      profileId,
      effectiveMonth: `${Number(month.slice(0, 4))}-01`,
      amountMinor: 10_000_000,
      currency: "INR",
    });
    for (const [name, category, amount, paymentDay] of [
      ["Room rent", "Room Rent", 10000, 1],
      ["Income tax", "Income Tax", 5000, 5],
      ["Health insurance", "Health Insurance", 4000, 10],
    ] as const) {
      await this.database.recurring.add({
        id: id(),
        profileId,
        sourceId: id(),
        effectiveMonth: `${Number(month.slice(0, 4))}-01`,
        name,
        category,
        amountMinor: amount * 100,
        currency: "INR",
        frequency: "monthly",
        active: true,
        startMonth: `${Number(month.slice(0, 4))}-01`,
        paymentDay,
        notes: "Sample commitment",
      });
    }
    for (const m of demoMonths) {
      await this.getMonth(profileId, m);
      const last = m === month ? Number(today().slice(-2)) : daysInMonth(m);
      for (let day = 1; day <= last; day++) {
        const samples: readonly (readonly [string, string, number])[] =
          (day === last && m === month) || (day === 15 && m.endsWith("-09"))
            ? ([
                ["Morning coffee", "Coffee", 150],
                ["Lunch at the café", "Food", 250],
                ["Metro ride", "Public transport", 100],
              ] as const)
            : [
                ["Lunch & a little more", "Food", 180 + ((day * 37) % 650)],
                ...(day % 3 === 0
                  ? [
                      [
                        "Weekly essentials",
                        "Groceries",
                        550 + ((day * 73) % 1800),
                      ] as const,
                    ]
                  : []),
                ...(day % 5 === 0
                  ? [
                      [
                        "Something for home",
                        "Shopping",
                        1800 + ((day * 31) % 1600),
                      ] as const,
                    ]
                  : []),
                ...(day % 2 === 0
                  ? [["Coffee break", "Coffee", 150] as const]
                  : []),
              ];
        for (const [description, category, amount] of samples)
          await this.saveExpense({
            id: id(),
            profileId,
            date: dateAt(m, day),
            amountMinor: amount * 100,
            description,
            category,
            notes: "Demo transaction",
            createdAt: stamp(),
            updatedAt: stamp(),
          });
      }
    }
  }
}
export const repository = new LocalRepository();
export const localAuth: AuthProvider = {
  currentLocalProfile: () => localStorage.getItem("daywise-profile"),
  selectLocalProfile: (profileId) =>
    localStorage.setItem("daywise-profile", profileId),
};
