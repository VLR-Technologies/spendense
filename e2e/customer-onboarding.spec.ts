import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
const cloud = process.env.DAYWISE_CLOUD_TEST === "1";
const password = "Customer-onboarding-local-2026!";
const screenshots = "docs/screenshots/customer-onboarding/after";
async function register(page: Page, request: APIRequestContext, email: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Élodie 王 – Customer");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("confirm your email");
  let link = "";
  await expect
    .poll(
      async () => {
        const messages = await (
          await request.get("http://127.0.0.1:54324/api/v1/messages")
        ).json();
        const message = messages.messages?.find(
          (m: { To: { Address: string }[] }) =>
            m.To?.some((t) => t.Address === email),
        );
        if (!message) return false;
        const detail = await (
          await request.get(
            `http://127.0.0.1:54324/api/v1/message/${message.ID}`,
          )
        ).json();
        link =
          (detail.HTML as string)
            ?.match(/href="([^"]+)"/)?.[1]
            ?.replaceAll("&amp;", "&") ?? "";
        return !!link;
      },
      { timeout: 15000 },
    )
    .toBe(true);
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Tell us about yourself", exact: true }),
  ).toBeVisible();
}
async function next(page: Page) {
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
}
async function shot(page: Page, name: string) {
  await fs.mkdir(screenshots, { recursive: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${screenshots}/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
test("customer categories, paid weekdays, retry, once-only setup and settings", async ({
  page,
  request,
}, info) => {
  test.skip(!cloud, "Disposable local Supabase is required.");
  test.setTimeout(120000);
  const email = `onboarding-${info.project.name}-${Date.now()}@example.test`;
  await register(page, request, email);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Élodie 王 – Customer",
  );
  await expect(page.getByLabel("Verified account email")).toHaveAttribute(
    "readonly",
    "",
  );
  await page
    .getByLabel("Preferred display name (optional)")
    .pressSequentially("Ellie");
  await expect(
    page.getByLabel("Preferred display name (optional)"),
  ).toBeFocused();
  await expect(
    page.getByLabel("Preferred display name (optional)"),
  ).toHaveValue("Ellie");
  await shot(page, `${info.project.name}-personal`);
  await next(page);
  await shot(page, `${info.project.name}-categories`);
  if (info.project.name === "desktop") {
    const original = page.viewportSize()!;
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await shot(page, `${width}-categories`);
    }
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await shot(page, "desktop-categories-dark");
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });
    await page.setViewportSize(original);
  }
  await page.getByRole("radio", { name: /Self-employed/ }).check();
  await next(page);
  await expect(
    page.getByLabel("Profession / service (optional)"),
  ).toBeVisible();
  await page
    .getByLabel("Income pattern", { exact: true })
    .selectOption("variable");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("radio", { name: /Business Owner/ }).check();
  await next(page);
  await expect(
    page.getByLabel("Monthly business revenue (optional, ₹)"),
  ).toBeVisible();
  await expect(
    page.getByLabel("Monthly personal take-home income (₹)"),
  ).toBeVisible();
  await expect(
    page.getByLabel("Income frequency", { exact: true }),
  ).toHaveCount(0);
  await shot(page, `${info.project.name}-business`);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("radio", { name: /Salaried Employee/ }).check();
  await next(page);
  await page
    .getByLabel("Income frequency", { exact: true })
    .selectOption("daily");
  await page
    .getByLabel("Daily personal income (₹)", { exact: true })
    .fill("1000.01");
  await expect(
    page.getByRole("group", { name: "Paid working days" }),
  ).toBeVisible();
  await shot(page, `${info.project.name}-daily-income`);
  await next(page);
  await page
    .getByLabel("Apply a confirmed income allocation to this budget")
    .check();
  await page.getByLabel("Confirmed monthly allocation (₹)").fill("22000.22");
  await shot(page, `${info.project.name}-budget-review`);
  let attempts = 0;
  await page.route("**/rest/v1/rpc/spendense_save_customer", async (route) => {
    attempts++;
    if (attempts === 1)
      await route.fulfill({ status: 503, json: { code: "unavailable" } });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Complete setup", exact: true })
    .click();
  await expect(
    page.locator(".customer-onboarding").getByRole("alert"),
  ).toContainText("retry");
  await expect(
    page.getByRole("button", { name: "Complete setup", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const state = { legacy: false, observer: new MutationObserver(() => {}) };
    state.observer = new MutationObserver(() => {
      if (
        Array.from(document.querySelectorAll('[role="dialog"]')).some((el) =>
          el.textContent?.includes("Set your monthly income"),
        )
      )
        state.legacy = true;
    });
    (
      window as unknown as { customerSetupProbe: typeof state }
    ).customerSetupProbe = state;
    state.observer.observe(document.body, { subtree: true, childList: true });
  });
  await page
    .getByRole("button", { name: "Complete setup", exact: true })
    .click();
  await expect(page.locator(".hero-customer")).toHaveText(
    "Élodie 王 – Customer",
  );
  await expect(page.locator(".hero-budget-label")).toHaveText(
    "Available today",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const probe = (
        window as unknown as {
          customerSetupProbe: { legacy: boolean; observer: MutationObserver };
        }
      ).customerSetupProbe;
      probe.observer.disconnect();
      return probe.legacy;
    }),
  ).toBe(false);
  await expect(page.locator(".budget-equation")).toContainText("₹22,000.22");
  await page.reload();
  await expect(page.locator(".hero-customer")).toHaveText(
    "Élodie 王 – Customer",
  );
  await expect(page.locator(".customer-onboarding")).toHaveCount(0);
  await shot(page, `${info.project.name}-customer-dashboard`);
  await page.goto("/settings");
  await expect(page.locator(".personal-income")).toContainText("Complete");
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await next(page);
  await next(page);
  await page
    .getByLabel("Income frequency", { exact: true })
    .selectOption("weekly");
  await page.getByLabel("Weekly personal income (₹)").fill("12345.67");
  await expect(page.locator(".customer-estimate")).toContainText(
    "Annualized monthly estimate",
  );
  await next(page);
  await expect(
    page.getByLabel("Apply a confirmed income allocation to this budget"),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await shot(page, `${info.project.name}-income-settings`);
  await page.locator(".theme-option.dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await shot(page, `${info.project.name}-income-settings-dark`);
  await page.goto("/dashboard");
  await expect(page.locator(".budget-equation")).toContainText("₹22,000.22");
  await shot(page, `${info.project.name}-customer-dashboard-dark`);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  await client.auth.signInWithPassword({ email, password });
  const { data: budgets } = await client.from("profiles").select("id");
  expect(budgets).toHaveLength(1);
  const { data: preferences } = await client
    .from("customer_financial_preferences")
    .select("revision,configuration");
  expect(preferences).toHaveLength(1);
  expect(preferences![0].revision).toBe(2);
});

test("legacy customer completes missing name once without replacing financial history", async ({
  page,
  request,
}, info) => {
  test.skip(!cloud, "Disposable local Supabase is required.");
  test.setTimeout(120000);
  const email = `legacy-onboarding-${info.project.name}-${Date.now()}@example.test`;
  await register(page, request, email);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  await client.auth.signInWithPassword({ email, password });
  await client.auth.updateUser({ data: { full_name: "", name: "" } });
  const id = crypto.randomUUID();
  const inserted = await client.from("profiles").insert({
    id,
    displayName: "Existing household budget",
    onboardingComplete: true,
  });
  expect(inserted.error).toBeNull();
  const income = await client.rpc("daywise_income", {
    p_id: id,
    p_month: "2024-02",
    p_amount: 9999999,
    p_scope: "default",
  });
  expect(income.error).toBeNull();
  const { data: before } = await client
    .from("income_revisions")
    .select("*")
    .eq("profileId", id);
  await page.reload();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Legacy Customer 李");
  await next(page);
  await next(page);
  await page.getByLabel("Monthly personal income (₹)").fill("123456.78");
  await next(page);
  await expect(
    page.getByLabel("Apply a confirmed income allocation to this budget"),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Complete setup", exact: true })
    .click();
  await expect(page.locator(".hero-customer")).toHaveText("Legacy Customer 李");
  await expect(page.locator(".budget-equation")).toContainText("₹99,999.99");
  await page.reload();
  await expect(page.locator(".hero-customer")).toHaveText("Legacy Customer 李");
  const { data: after } = await client
    .from("income_revisions")
    .select("*")
    .eq("profileId", id);
  expect(after).toEqual(before);
  expect((await client.from("profiles").select("id")).data).toHaveLength(1);
});

test("missing customer migration preserves an existing budget and supports retry", async ({
  page,
  request,
}, info) => {
  test.skip(!cloud, "Disposable local Supabase is required.");
  test.setTimeout(120000);
  const email = `migration-order-${info.project.name}-${Date.now()}@example.test`;
  await register(page, request, email);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  expect(
    (await client.auth.signInWithPassword({ email, password })).error,
  ).toBeNull();
  const id = crypto.randomUUID();
  expect(
    (
      await client.from("profiles").insert({
        id,
        displayName: "Migration compatibility budget",
        onboardingComplete: true,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await client.rpc("daywise_income", {
        p_id: id,
        p_month: "2024-02",
        p_amount: 7654321,
        p_scope: "default",
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await client.from("daily_expenses").insert({
        profileId: id,
        date: "2024-02-29",
        amountMinor: 12345,
        category: "Food",
        description: "Synthetic migration fixture",
      })
    ).error,
  ).toBeNull();
  const history = async () => ({
    incomes: (
      await client.from("income_revisions").select("*").eq("profileId", id)
    ).data,
    expenses: (
      await client.from("daily_expenses").select("*").eq("profileId", id)
    ).data,
  });
  const before = await history();
  // Simulate an older API schema without modifying even the local database.
  await page.route("**/rest/v1/customer_financial_preferences?**", (route) =>
    route.fulfill({ status: 404, json: { code: "PGRST205" } }),
  );
  await page.reload();
  await expect(page.locator(".hero-customer")).toHaveText(
    "Élodie 王 – Customer",
  );
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "service update",
  );
  await expect(page.locator(".budget-equation")).toContainText("₹76,543.21");
  await expect(page.locator(".local-badge")).toHaveCount(0);
  expect(await history()).toEqual(before);
  await page.unroute("**/rest/v1/customer_financial_preferences?**");
  await page.getByRole("button", { name: "Retry personal details" }).click();
  await expect(
    page.getByRole("heading", { name: "Tell us about yourself", exact: true }),
  ).toBeVisible();
  await next(page);
  await next(page);
  await next(page);
  await page.route("**/rest/v1/rpc/spendense_save_customer", (route) =>
    route.fulfill({ status: 404, json: { code: "PGRST202" } }),
  );
  await page
    .getByRole("button", { name: "Complete setup", exact: true })
    .click();
  await expect(
    page.locator(".customer-onboarding").getByRole("alert"),
  ).toContainText("service update");
  expect(await history()).toEqual(before);
  expect((await client.from("profiles").select("id")).data).toHaveLength(1);
  expect(
    (await client.from("customer_financial_preferences").select("*")).data,
  ).toHaveLength(0);
  await page.unroute("**/rest/v1/rpc/spendense_save_customer");
  await page
    .getByRole("button", { name: "Complete setup", exact: true })
    .click();
  await expect(page.locator(".hero-customer")).toHaveText(
    "Élodie 王 – Customer",
  );
  expect(await history()).toEqual(before);
  expect((await client.from("profiles").select("id")).data).toHaveLength(1);
});
