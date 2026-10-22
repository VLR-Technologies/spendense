import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const go = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.locator(".page-skeleton")).toHaveCount(0);
};
test("guest-first complete local finance journey", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Make every.*day count/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Or create a named local profile" })
    .click();
  await page.getByLabel("Profile name", { exact: true }).fill("Personal test");
  await page
    .getByRole("button", { name: "Create local profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Let’s give your money a little direction.",
    }),
  ).toBeVisible();
  await page
    .getByRole("spinbutton", { name: "Monthly income amount" })
    .fill("100000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Add a monthly commitment" }).click();
  let dialog = page.getByRole("dialog").last();
  await dialog.getByLabel("Expense name", { exact: true }).fill("Room rent");
  await dialog
    .getByRole("spinbutton", { name: "Commitment amount" })
    .fill("10000");
  await dialog.getByRole("button", { name: "Save commitment" }).click();
  await page.getByRole("button", { name: "Add a monthly commitment" }).click();
  dialog = page.getByRole("dialog").last();
  await dialog
    .getByLabel("Expense name", { exact: true })
    .fill("Family support");
  await dialog
    .getByRole("spinbutton", { name: "Commitment amount" })
    .fill("2000");
  await dialog
    .getByLabel("Category", { exact: true })
    .selectOption("Other Mandatory Expense");
  await dialog.getByRole("button", { name: "Save commitment" }).click();
  await page.getByRole("button", { name: "See my daily allowance" }).click();
  await page.getByRole("button", { name: "Open my calendar" }).click();
  await expect(
    page.getByRole("heading", { name: "Your daily picture." }),
  ).toBeVisible();
  const firstDay = page.locator(".full-calendar [data-date]").first();
  const date = (await firstDay.getAttribute("data-date"))!;
  const allowance =
    8800000 /
    new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate();
  await firstDay.click();
  await page
    .getByRole("button", { name: "Add an expense to this day" })
    .click();
  dialog = page.getByRole("dialog").last();
  await dialog.getByRole("spinbutton", { name: "Expense amount" }).fill("500");
  await dialog.getByLabel("What was it for?").fill("Test lunch");
  await dialog
    .getByRole("button", { name: "Add expense", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit Test lunch" }),
  ).toBeVisible();
  const expected = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Math.ceil(allowance) - 50000) / 100);
  await expect(page.locator(".day-balance>strong")).toHaveText(expected);
  await page.getByRole("button", { name: "Edit Test lunch" }).click();
  dialog = page.getByRole("dialog").last();
  await dialog.getByRole("spinbutton", { name: "Expense amount" }).fill("450");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(
    page.locator(".full-calendar [data-date]").first(),
  ).not.toHaveAttribute("data-date", date);
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await expect(
    page.locator(`.full-calendar [data-date="${date}"]`),
  ).toHaveAccessibleName(/spent ₹450/);
  await go(page, "/expenses");
  await page
    .getByRole("textbox", { name: "Search expenses", exact: true })
    .fill("Test lunch");
  await expect(page.locator(".expense-row")).toHaveCount(1);
  if ((page.viewportSize()?.width ?? 0) > 1000) {
    await page
      .getByRole("textbox", { name: "Search expenses", exact: true })
      .fill("no matching expense");
    await expect(page.locator(".expense-row")).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Search this month's expenses" })
      .fill("Test lunch");
    await page
      .getByRole("textbox", { name: "Search this month's expenses" })
      .press("Enter");
    await expect(page.locator(".expense-row")).toHaveCount(1);
  }
  await go(page, "/settings");
  await page.locator(".theme-option.dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await downloadEvent;
  const path = testInfo.outputPath("backup.json");
  await download.saveAs(path);
  const backup = JSON.parse(await fs.readFile(path, "utf-8"));
  expect(backup.expenses[0].amountMinor).toBe(45000);
  expect(backup.recurring).toHaveLength(2);
  await page.getByLabel("Import backup file").setInputFiles(path);
  await expect(
    page.getByRole("heading", { name: "Replace an existing profile?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replace & restore profile" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Manage profiles" }).click();
  await page.getByLabel("Create a new profile").fill("Student test");
  await page
    .getByRole("button", { name: "Create local profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip setup for now" }).click();
  await go(page, "/expenses");
  await expect(page.getByText("A clean slate for your everyday")).toBeVisible();
  expect(
    await page
      .locator("body")
      .evaluate((e) => e.scrollWidth <= window.innerWidth),
  ).toBe(true);
});

test("demo dashboard, all views, and responsive screenshots", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(
    page.getByRole("heading", { name: "A good day starts here." }),
  ).toBeVisible();
  await expect(page.locator(".hero-amount")).toContainText("₹");
  await expect(page.locator(".expense-rows").first()).toBeVisible();
  await page.waitForTimeout(800);
  await fs.mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: `docs/screenshots/${testInfo.project.name}-dashboard.png`,
    fullPage: true,
  });
  for (const path of [
    "/calendar",
    "/monthly-plan",
    "/expenses",
    "/insights",
    "/settings",
  ]) {
    await go(page, path);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page
        .locator("body")
        .evaluate((e) => e.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.locator(".theme-option.dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await go(page, "/dashboard");
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `docs/screenshots/${testInfo.project.name}-dark.png`,
    fullPage: true,
  });
  await go(page, "/calendar");
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `docs/screenshots/${testInfo.project.name}-calendar.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("guest can skip setup and start from an empty budget", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continue as guest", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip setup for now" }).click();
  await expect(
    page.getByRole("heading", { name: "A good day starts here." }),
  ).toBeVisible();
  await expect(page.locator(".summary-value").first()).toHaveText("₹0");
  await go(page, "/settings");
  await page.getByLabel("Import backup file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"wrong":true}'),
  });
  await expect(page.locator(".toast[role=alert]")).toContainText(
    "isn’t a valid Spendense",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("monthly commitments support one-time conversion, pause, resume and payment metadata", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(
    page.getByRole("heading", { name: "A good day starts here." }),
  ).toBeVisible();
  await go(page, "/monthly-plan");
  const before = await page
    .locator(".plan-flow-item.net-flow strong")
    .innerText();
  await page
    .getByRole("button", { name: "Mark Room rent paid", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark Room rent unpaid", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".plan-flow-item.net-flow strong")).toHaveText(
    before,
  );
  await page
    .getByRole("button", { name: "Add one-time expense", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Expense name", { exact: true })
    .fill("Laptop repair");
  await dialog
    .getByRole("spinbutton", { name: "Commitment amount" })
    .fill("3000");
  await dialog.getByRole("button", { name: "Save commitment" }).click();
  await expect(
    page.getByRole("button", { name: "Edit Laptop repair" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Laptop repair" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Laptop repair" }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Recurring monthly", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Save commitment" }).click();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Laptop repair" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pause Laptop repair from this month" })
    .click();
  await page
    .getByRole("button", { name: "Pause commitment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Paused & scheduled" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit schedule", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Active from/).check();
  await dialog.getByRole("button", { name: "Save commitment" }).click();
  await expect(
    page.getByRole("button", { name: "Pause Laptop repair from this month" }),
  ).toBeVisible();
});

test("blocked browser storage shows an actionable recovery state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.indexedDB, "open", {
      value() {
        throw new DOMException("Storage access denied", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByText(
      "Browser storage is unavailable. Allow local storage and reload to use Spendense.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
});
