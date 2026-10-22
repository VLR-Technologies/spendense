"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronLeft,
  Plus,
  UserRound,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { cleanDisplayName } from "@/lib/identity";
import {
  defaultIncomeConfiguration,
  employmentLabels,
  normalizeIncome,
  type IncomeConfiguration,
} from "@/lib/customer-income";
import {
  CustomerRepository,
  type CustomerSave,
} from "@/lib/repositories/customer";
import { CloudRepository } from "@/lib/repositories/cloud";
import { browserClient } from "@/lib/supabase/browser";
import { thisMonth, daysInMonth, monthLabel } from "@/lib/dates";
import { preciseMoney, toMinor } from "@/lib/finance";
import { useApp } from "./provider";
import { CommitmentForm } from "./forms";
import { Logo } from "./logo";
import { AccountControls } from "./account";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

const headings = [
  "Tell us about yourself",
  "How do you earn?",
  "Income details",
  "Set up your budget",
];
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const categoryDescriptions = {
  salaried: "Fixed or regularly scheduled compensation",
  freelancer: "Independent work, clients, or contracts",
  business: "Income from operating a business",
  other: "Other sources or changing income",
};
const categoryIcons = {
  salaried: BriefcaseBusiness,
  freelancer: UserRound,
  business: Building2,
  other: Plus,
};

export function CustomerOnboarding({
  editing = false,
  onDone,
}: {
  editing?: boolean;
  onDone?: () => void;
}) {
  const {
    account,
    customerPreferences,
    setCustomerPreferences,
    repository,
    profile,
    data,
    month,
    setMonth,
    selectProfile,
    refresh,
    notify,
    refreshCustomer,
    error: budgetError,
  } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(0);
  useEffect(() => {
    if (previousStep.current !== step) headingRef.current?.focus();
    previousStep.current = step;
  }, [step]);
  const [name, setName] = useState(account?.displayName ?? "");
  const [preferred, setPreferred] = useState(account?.preferredName ?? "");
  const [config, setConfig] = useState<IncomeConfiguration>(
    customerPreferences?.configuration ?? { ...defaultIncomeConfiguration },
  );
  const [rate, setRate] = useState(String(config.rateMinor / 100));
  const [revenue, setRevenue] = useState(
    config.revenueMinor === null ? "" : String(config.revenueMinor / 100),
  );
  const [costs, setCosts] = useState(
    config.costsMinor === null ? "" : String(config.costsMinor / 100),
  );
  const [allocation, setAllocation] = useState("");
  const [apply, setApply] = useState(false);
  const [scope, setScope] = useState<"month" | "default">("month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [addBill, setAddBill] = useState(false);
  const [done, setDone] = useState(false);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const saving = useRef(false);
  if (!account) return null;
  const selectedMonth = month < thisMonth() ? thisMonth() : month;
  let estimate: ReturnType<typeof normalizeIncome> | null = null;
  let estimateError = "";
  try {
    estimate = normalizeIncome(
      { ...config, rateMinor: toMinor(rate) },
      selectedMonth,
    );
  } catch (e) {
    estimateError =
      e instanceof Error ? e.message : "Check your income and paid days.";
  }
  const fixed =
    data?.commitments.reduce((sum, item) => sum + item.amountMinor, 0) ?? 0;
  let preview = data?.plan.monthlyIncomeMinor ?? 0;
  try {
    if (apply) preview = toMinor(allocation);
  } catch {
    /* Input validation reports this on submit. */
  }
  const change = <K extends keyof IncomeConfiguration>(
    key: K,
    value: IncomeConfiguration[K],
  ) => setConfig((c) => ({ ...c, [key]: value }));
  async function next(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    setError("");
    if (step === 0 && (!cleanDisplayName(name) || name.trim().length > 200)) {
      setError("Enter your full name (1–200 characters).");
      return;
    }
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    if (step === 2) {
      try {
        const configuration = {
          ...config,
          rateMinor: toMinor(rate),
          revenueMinor: revenue === "" ? null : toMinor(revenue),
          costsMinor: costs === "" ? null : toMinor(costs),
        };
        const normalized = normalizeIncome(configuration, selectedMonth);
        saving.current = true;
        setBusy(true);
        setConfig(configuration);
        // Reuse an existing authorized budget. The repository makes initial creation idempotent.
        if (!editing && !profile && repository instanceof CloudRepository) {
          const budget = await repository.openPersonalBudget();
          selectProfile(budget.id);
          refresh();
        }
        setMonth(selectedMonth);
        setAllocation(String(normalized.amountMinor / 100));
        setApply(false);
        setStep(3);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Check your income details.");
      } finally {
        saving.current = false;
        setBusy(false);
      }
      return;
    }
    if ((!editing || apply) && (!profile || !data || month !== selectedMonth)) {
      setError("Wait for your budget to load, then retry.");
      return;
    }
    try {
      saving.current = true;
      setBusy(true);
      const client = browserClient();
      if (!client) throw new Error("Cloud account unavailable. Retry sign-in.");
      const input: Omit<CustomerSave, "requestId"> = {
        configuration: config,
        expectedRevision: customerPreferences?.revision ?? 0,
        budget:
          profile && data && (!editing || apply)
            ? {
                id: profile.id,
                month: selectedMonth,
                amountMinor: apply ? toMinor(allocation) : null,
                scope,
                expectedIncome: data.plan.monthlyIncomeMinor,
                expectedOverride: data.plan.incomeOverride,
              }
            : undefined,
      };
      const payload = JSON.stringify(input);
      if (request.current?.payload !== payload)
        request.current = { payload, id: crypto.randomUUID() };
      // Name remains authoritative in Auth. A failed preferences transaction stays retryable.
      await auth.updateDisplayName(name, preferred);
      const saved = await new CustomerRepository(client, account!.id).save({
        ...input,
        requestId: request.current.id,
      });
      setDone(true);
      refresh();
      notify(editing ? "Personal & Income Details saved" : "Setup complete");
      // Keep completion visible briefly before opening the dashboard; completion is already durable.
      setCustomerPreferences(saved, input.budget?.id);
      if (onDone) onDone();
      else router.replace("/dashboard");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Retry when connected.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const content = done ? (
    <div className="customer-complete" role="status">
      <Check size={28} />
      <h1>Setup complete</h1>
      <p>Opening your financial dashboard…</p>
    </div>
  ) : (
    <>
      <div className="customer-step-label">
        {editing ? "Edit personal details" : "Account setup"} · Step {step + 1}{" "}
        of 4
      </div>
      <div className="onboarding-progress" aria-label={`Step ${step + 1} of 4`}>
        {headings.map((h, i) => (
          <span key={h} className={i <= step ? "done" : ""} />
        ))}
      </div>
      <h1 tabIndex={-1} key={step} ref={headingRef}>
        {headings[step]}
      </h1>
      {budgetError && (
        <div className="error-banner" role="alert">
          {budgetError}
          <Button variant="secondary" onClick={refresh}>
            Retry budget
          </Button>
        </div>
      )}
      <form className="stack-form" onSubmit={next}>
        {step === 0 && (
          <>
            <label className="field">
              Full name
              <input
                autoComplete="name"
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              Verified account email
              <input
                type="email"
                value={account.email ?? ""}
                readOnly
                autoComplete="email"
              />
            </label>
            <label className="field">
              Preferred display name (optional)
              <input
                autoComplete="nickname"
                maxLength={200}
                value={preferred}
                onChange={(e) => setPreferred(e.target.value)}
              />
            </label>
            <p className="account-note">
              Your full name appears on your financial overview. Optional
              details can be added later.
            </p>
          </>
        )}
        {step === 1 && (
          <fieldset className="customer-categories">
            <legend className="sr-only">Employment category</legend>
            {Object.entries(employmentLabels).map(([key, label]) => {
              const value = key as IncomeConfiguration["category"];
              const Icon = categoryIcons[value];
              return (
                <label
                  key={key}
                  className={`customer-category ${config.category === key ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="employment"
                    value={key}
                    checked={config.category === key}
                    onChange={() =>
                      setConfig((c) => ({
                        ...c,
                        category: value,
                        frequency:
                          value === "business" ? "monthly" : c.frequency,
                      }))
                    }
                  />
                  <Icon size={24} />
                  <span>
                    <strong>{label}</strong>
                    <span>{categoryDescriptions[value]}</span>
                  </span>
                  {config.category === key && <Check size={20} />}
                </label>
              );
            })}
          </fieldset>
        )}
        {step === 2 && (
          <>
            <div className="customer-fields">
              <label className="field">
                {config.category === "salaried"
                  ? "Company / employer (optional)"
                  : "Business / trading name (optional)"}
                <input
                  maxLength={120}
                  value={config.organization}
                  onChange={(e) => change("organization", e.target.value)}
                />
              </label>
              <label className="field">
                {config.category === "salaried"
                  ? "Job title (optional)"
                  : config.category === "business"
                    ? "Industry (optional)"
                    : "Profession / service (optional)"}
                <input
                  maxLength={120}
                  value={config.occupation}
                  onChange={(e) => change("occupation", e.target.value)}
                />
              </label>
            </div>
            {config.category !== "salaried" && (
              <label className="field">
                Income pattern
                <select
                  aria-label="Income pattern"
                  value={config.pattern}
                  onChange={(e) =>
                    change(
                      "pattern",
                      e.target.value as IncomeConfiguration["pattern"],
                    )
                  }
                >
                  <option value="regular">Regular</option>
                  <option value="variable">Variable</option>
                  {config.category === "business" && (
                    <option value="seasonal">Seasonal</option>
                  )}
                </select>
              </label>
            )}
            {config.category !== "business" && (
              <label className="field">
                Income frequency
                <select
                  aria-label="Income frequency"
                  value={config.frequency}
                  onChange={(e) =>
                    change(
                      "frequency",
                      e.target.value as IncomeConfiguration["frequency"],
                    )
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </label>
            )}
            {config.category === "business" && (
              <div className="customer-fields">
                <label className="field">
                  Monthly business revenue (optional, ₹)
                  <input
                    inputMode="decimal"
                    type="number"
                    min="0"
                    max="1000000000"
                    step="0.01"
                    value={revenue}
                    onChange={(e) => setRevenue(e.target.value)}
                  />
                </label>
                <label className="field">
                  Monthly operating costs (optional, ₹)
                  <input
                    inputMode="decimal"
                    type="number"
                    min="0"
                    max="1000000000"
                    step="0.01"
                    value={costs}
                    onChange={(e) => setCosts(e.target.value)}
                  />
                </label>
              </div>
            )}
            <label className="field">
              {config.category === "business"
                ? "Monthly personal take-home income (₹)"
                : `${config.frequency === "daily" ? "Daily" : config.frequency === "weekly" ? "Weekly" : "Monthly"} personal income (₹)`}
              <input
                required
                inputMode="decimal"
                type="number"
                min="0"
                max="1000000000"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>
            {config.frequency === "daily" && (
              <fieldset className="paid-weekdays">
                <legend>Paid working days</legend>
                {weekdays.map((label, day) => (
                  <label key={label}>
                    <input
                      type="checkbox"
                      checked={config.workDays.includes(day)}
                      onChange={(e) =>
                        change(
                          "workDays",
                          e.target.checked
                            ? [...config.workDays, day].sort()
                            : config.workDays.filter((d) => d !== day),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
            {config.category !== "salaried" && (
              <label className="field">
                Notes (optional)
                <textarea
                  maxLength={500}
                  value={config.notes}
                  onChange={(e) => change("notes", e.target.value)}
                />
              </label>
            )}
            <div className="customer-estimate">
              <span>
                Estimated monthly income · {monthLabel(selectedMonth)}
              </span>
              <strong>
                {estimate ? preciseMoney(estimate.amountMinor) : "—"}
              </strong>
              <p>{estimate?.explanation ?? estimateError}</p>
              {config.category === "business" && (
                <p>
                  Revenue and operating costs are context only. Personal
                  take-home is the amount used for budgeting.
                </p>
              )}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <label className="field">
              Budget month
              <input
                required
                type="month"
                min={thisMonth()}
                max="2200-12"
                value={selectedMonth}
                onChange={(e) => {
                  if (
                    /^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value) &&
                    e.target.value >= thisMonth() &&
                    e.target.value <= "2200-12"
                  ) {
                    setMonth(e.target.value);
                    setApply(false);
                  }
                }}
              />
            </label>
            <div className="customer-estimate">
              <div className="simple-row">
                <span>Existing income allocation</span>
                <strong>
                  {data
                    ? preciseMoney(data.plan.monthlyIncomeMinor)
                    : "Loading…"}
                </strong>
              </div>
              <div className="simple-row">
                <span>Estimated monthly income</span>
                <strong>
                  {estimate ? preciseMoney(estimate.amountMinor) : "—"}
                </strong>
              </div>
              <p>{estimate?.explanation}</p>
            </div>
            <label className="check-field">
              <input
                type="checkbox"
                disabled={!data || !profile}
                checked={apply}
                onChange={(e) => setApply(e.target.checked)}
              />
              Apply a confirmed income allocation to this budget
            </label>
            {apply ? (
              <>
                <label className="field">
                  Confirmed monthly allocation (₹)
                  <input
                    required
                    inputMode="decimal"
                    type="number"
                    min="0"
                    max="1000000000"
                    step="0.01"
                    value={allocation}
                    onChange={(e) => setAllocation(e.target.value)}
                  />
                </label>
                <label className="field">
                  Apply income to
                  <select
                    aria-label="Apply income to"
                    value={scope}
                    onChange={(e) =>
                      setScope(e.target.value as "month" | "default")
                    }
                  >
                    <option value="month">
                      This month only (monthly override)
                    </option>
                    <option value="default">
                      Default from this month onward
                    </option>
                  </select>
                </label>
                <p className="account-note">
                  {scope === "default"
                    ? "Replaces the default from the selected month and updates future months that follow it. Explicit monthly overrides are kept."
                    : "Replaces only the selected month’s allocation. Your future default is kept."}{" "}
                  Past months are unchanged.
                </p>
              </>
            ) : (
              <p className="account-note">
                Keep your existing monthly allocation. Saving personal details
                alone does not change income revisions or monthly overrides.
              </p>
            )}
            <div className="customer-commitments">
              <h2>Fixed commitments</h2>
              {data?.commitments.length ? (
                data.commitments.map((c) => (
                  <div className="simple-row" key={c.id}>
                    <span>
                      {c.name}
                      {c.origin === "recurring" ? " · Recurring" : ""}
                    </span>
                    <strong>{preciseMoney(c.amountMinor)}</strong>
                  </div>
                ))
              ) : (
                <p className="account-note">
                  No commitments recorded for this month.
                </p>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={!data}
                onClick={() => setAddBill(true)}
              >
                <Plus size={16} />
                Add recurring expense
              </Button>
            </div>
            <div className="customer-estimate">
              <span>
                Daily allowance preview · {daysInMonth(selectedMonth)} days
              </span>
              <strong>
                {preciseMoney((preview - fixed) / daysInMonth(selectedMonth))}
              </strong>
              <p>
                Confirmed allocation minus commitments, spread across the month.
                Individual days may differ by a paise. This is an allocation,
                not verified income received or a bank balance.
              </p>
            </div>
          </>
        )}
        {error && (
          <div role="alert" className="form-error">
            {error}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                refresh();
                refreshCustomer();
                setError(
                  "Budget reloaded. Review the allocation before saving again.",
                );
              }}
            >
              Reload budget
            </Button>
          </div>
        )}
        <div className="form-actions">
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
            >
              <ChevronLeft size={16} />
              Back
            </Button>
          )}
          <Button
            type="submit"
            disabled={
              busy ||
              (step === 3 &&
                (!editing || apply) &&
                (!data || month !== selectedMonth))
            }
          >
            {busy
              ? "Saving…"
              : step === 3
                ? editing
                  ? "Save details"
                  : "Complete setup"
                : "Save and continue"}
          </Button>
        </div>
      </form>
      <Dialog
        open={addBill}
        onClose={() => setAddBill(false)}
        title="Add a monthly commitment"
      >
        <CommitmentForm onDone={() => setAddBill(false)} />
      </Dialog>
    </>
  );
  if (editing) return <div className="customer-edit">{content}</div>;
  return (
    <div className="welcome customer-welcome">
      <header>
        <Logo />
        <AccountControls />
      </header>
      <main id="main-content" className="customer-onboarding panel">
        {content}
      </main>
    </div>
  );
}

export function PersonalIncomeDetails() {
  const {
    account,
    mode,
    customerPreferences,
    customerStatus,
    customerError,
    refreshCustomer,
    month,
  } = useApp();
  const [editing, setEditing] = useState(false);
  if (!account || mode !== "cloud") return null;
  const config = customerPreferences?.configuration;
  let estimate = "—";
  try {
    if (config)
      estimate = preciseMoney(normalizeIncome(config, month).amountMinor);
  } catch {
    /* Existing plans remain available if an estimate is out of range. */
  }
  return (
    <section className="panel settings-panel personal-income">
      <div className="panel-heading">
        <h2>Personal & Income Details</h2>
        <Button
          variant="secondary"
          size="sm"
          disabled={customerStatus !== "ready"}
          onClick={() => setEditing(true)}
        >
          Edit details
        </Button>
      </div>
      {customerStatus === "loading" ? (
        <p role="status">Loading personal details…</p>
      ) : customerError ? (
        <div role="alert">
          <p>{customerError}</p>
          <Button variant="secondary" onClick={refreshCustomer}>
            Retry personal details
          </Button>
        </div>
      ) : (
        <dl className="customer-details">
          <div>
            <dt>Full name</dt>
            <dd>{account.displayName ?? "Add your full name"}</dd>
          </div>
          <div>
            <dt>Verified account email</dt>
            <dd>{account.email}</dd>
          </div>
          <div>
            <dt>Employment category</dt>
            <dd>
              {config ? employmentLabels[config.category] : "Not supplied"}
            </dd>
          </div>
          {config?.organization && (
            <div>
              <dt>Company / business</dt>
              <dd>{config.organization}</dd>
            </div>
          )}
          <div>
            <dt>Income frequency</dt>
            <dd>{config?.frequency ?? "—"}</dd>
          </div>
          <div>
            <dt>Personal income rate</dt>
            <dd>{config ? preciseMoney(config.rateMinor) : "—"}</dd>
          </div>
          <div>
            <dt>Estimated monthly income</dt>
            <dd>{estimate}</dd>
          </div>
          <div>
            <dt>Profile status</dt>
            <dd>{customerPreferences ? "Complete" : "Needs completion"}</dd>
          </div>
        </dl>
      )}
      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Personal & Income Details"
        wide
      >
        <CustomerOnboarding editing onDone={() => setEditing(false)} />
      </Dialog>
    </section>
  );
}
