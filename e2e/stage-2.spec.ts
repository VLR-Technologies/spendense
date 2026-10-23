import { installDemoFixture } from "../scripts/lib/demo-fixture.cjs";
import { test, expect, type Page, type Locator } from "@playwright/test";
import fs from "node:fs/promises";

async function demo(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-22T12:00:00+02:00"));
  await page.goto("/");
  await installDemoFixture(page);
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Demo/,
    }),
  ).toBeVisible();
}
async function go(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator(".page-skeleton")).toHaveCount(0);
  await expect(page.locator("h1")).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function touchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.width)).toBeGreaterThanOrEqual(44);
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);
}

test("Stage 2 financial chain, calendar keyboard controls and nested sheet focus", async ({
  page,
}) => {
  await demo(page);
  const monthly = page.getByRole("region", {
    name: "Monthly budget calculation",
  });
  await expect(monthly).toContainText("₹1,00,000");
  await expect(monthly).toContainText("₹19,000");
  await expect(monthly).toContainText("₹81,000");
  await monthly.getByRole("button", { name: "Edit income" }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Edit monthly income",
  );
  await page.keyboard.press("Escape");
  await expect(
    monthly.getByRole("button", { name: "Edit income" }),
  ).toBeFocused();
  await page.getByText("About this amount", { exact: true }).click();
  await expect(page.locator(".allocation-help p")).toContainText(
    "not a bank balance",
  );
  await go(page, "/calendar");
  await page.getByLabel("Select month", { exact: true }).fill("2026-09");
  const first = page.locator('.full-calendar [data-date="2026-09-01"]');
  await expect(first).toBeVisible();
  await first.focus();
  await first.press("ArrowRight");
  await expect(
    page.locator('.full-calendar [data-date="2026-09-02"]'),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.locator('.full-calendar [data-date="2026-09-06"]'),
  ).toBeFocused();
  expect(
    await page.locator('.full-calendar [data-date][tabindex="0"]').count(),
  ).toBe(1);
  const date = page.locator('.full-calendar [data-date="2026-09-15"]');
  await date.click();
  let sheet = page.getByRole("dialog");
  await expect(sheet).toHaveAccessibleName("Tuesday, 15 September");
  await expect(sheet.locator(".day-breakdown dd")).toHaveText([
    "₹3,333.33",
    "₹633.33",
    "₹2,700",
    "₹500",
    "₹2,200",
  ]);
  await sheet.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(sheet).toHaveAccessibleName("Wednesday, 16 September");
  await sheet
    .getByRole("button", { name: "Previous day", exact: true })
    .click();
  await sheet
    .getByRole("button", { name: "Add an expense to this day" })
    .click();
  const form = page.getByRole("dialog").last();
  await expect(form.getByLabel("Expense date", { exact: true })).toHaveValue(
    "2026-09-15",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("button", { name: "Add an expense to this day" }),
  ).toBeFocused();
  await sheet
    .getByRole("button", { name: "Add an expense to this day" })
    .click();
  const addForm = page.getByRole("dialog").last();
  await addForm
    .getByRole("spinbutton", { name: "Expense amount" })
    .fill("12.34");
  await addForm
    .getByLabel("What was it for?")
    .fill("Stage 2 regression expense");
  await addForm
    .getByRole("button", { name: "Add expense", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(sheet.locator(".day-balance > strong")).toHaveText("₹2,187.66");
  const remove = sheet.getByRole("button", {
    name: "Delete Stage 2 regression expense",
  });
  await touchTarget(remove);
  await remove.click();
  await page.getByRole("button", { name: "Keep expense", exact: true }).click();
  await expect(remove).toBeVisible();
  await remove.click();
  await page
    .getByRole("button", { name: "Remove expense", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(remove).toHaveCount(0);
  await expect(sheet.locator(".day-balance > strong")).toHaveText("₹2,200");
  await sheet.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const close = sheet.getByRole("button", { name: "Close dialog" });
  const closeBox = await close.boundingBox();
  expect(closeBox!.y).toBeGreaterThanOrEqual(0);
  expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await close.click();
  await expect(date).toBeFocused();
  await page.locator('.full-calendar [data-date="2026-09-01"]').click();
  await expect(
    page.getByRole("button", { name: "Previous day", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.locator('.full-calendar [data-date="2026-09-30"]').click();
  await expect(
    page.getByRole("button", { name: "Next day", exact: true }),
  ).toBeDisabled();
});

test("Stage 2 screenshots and navigation in both themes", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await demo(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fs.mkdir("docs/screenshots/stage-2", { recursive: true });
  for (const theme of ["light", "dark"]) {
    await go(page, "/settings");
    await page.locator(`.theme-option.${theme}`).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await go(page, "/dashboard");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".recharts-pie-sector")).toHaveCount(5);
    await page.screenshot({
      path: `docs/screenshots/stage-2/${testInfo.project.name}-dashboard-${theme}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await noOverflow(page);
    if (testInfo.project.name === "mobile") {
      const nav = page.getByRole("navigation", { name: "Mobile navigation" });
      for (const link of await nav.getByRole("link").all())
        await touchTarget(link);
      await nav.getByRole("link", { name: "Calendar", exact: true }).click();
      await expect(
        nav.getByRole("link", { name: "Calendar", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    } else {
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Calendar", exact: true })
        .click();
    }
    await expect(page.locator(".full-calendar")).toBeVisible();
    await expect(
      page.locator('.full-calendar [aria-current="date"]'),
    ).toHaveAttribute("data-date", "2026-10-22");
    await page.screenshot({
      path: `docs/screenshots/stage-2/${testInfo.project.name}-calendar-${theme}.png`,
      fullPage: true,
      animations: "disabled",
    });
    if (testInfo.project.name === "mobile") {
      await page.locator(".full-calendar").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `docs/screenshots/stage-2/mobile-calendar-viewport-${theme}.png`,
        animations: "disabled",
      });
    }
    await noOverflow(page);
    await page.locator('.full-calendar [data-date="2026-10-31"]').click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.locator(".day-balance")).toContainText(
      "Projected remaining",
    );
    await expect(sheet.locator(".breakdown-remaining")).toContainText(
      "₹2,612.90",
    );
    await page.screenshot({
      path: `docs/screenshots/stage-2/${testInfo.project.name}-day-sheet-${theme}.png`,
      animations: "disabled",
    });
    await sheet.getByRole("button", { name: "Close dialog" }).click();
  }
  expect(errors).toEqual([]);
});

test("Stage 2 responsive layouts retain usable touch controls at narrow widths", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  test.skip(
    testInfo.project.name !== "mobile",
    "Narrow-width checks use the mobile project.",
  );
  await demo(page);
  for (const width of [320, 360, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of [
      "/dashboard",
      "/calendar",
      "/monthly-plan",
      "/expenses",
      "/insights",
      "/settings",
    ]) {
      await go(page, path);
      await noOverflow(page);
    }
    await go(page, "/calendar");
    await touchTarget(
      page.getByRole("button", { name: "Previous month", exact: true }),
    );
    await touchTarget(
      page.getByRole("button", { name: "Next month", exact: true }),
    );
    await touchTarget(
      page.getByRole("button", { name: "Add expense", exact: true }),
    );
    if (width < 768) {
      await touchTarget(page.locator(".full-calendar [data-date]").first());
      await expect(
        page.locator(".full-calendar .cell-spent").first(),
      ).toBeHidden();
      await page.locator(".full-calendar [data-date]").first().click();
      await touchTarget(page.getByRole("button", { name: "Close dialog" }));
      await touchTarget(
        page.getByRole("button", { name: "Add an expense to this day" }),
      );
      await page
        .getByRole("button", { name: "Add an expense to this day" })
        .click();
      const dialog = page.getByRole("dialog").last();
      await page.setViewportSize({ width, height: 500 });
      await dialog.getByLabel("What was it for?").fill("Keyboard layout check");
      await dialog
        .getByRole("button", { name: "Add expense", exact: true })
        .scrollIntoViewIfNeeded();
      const submit = await dialog
        .getByRole("button", { name: "Add expense", exact: true })
        .boundingBox();
      expect(submit!.y + submit!.height).toBeLessThanOrEqual(500);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width, height: 844 });
    }
  }
});

test("Stage 2 reads existing v1 history and recurring data without rewriting saved records", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-22T12:00:00+02:00"));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Continue as guest", exact: true }),
  ).toBeVisible();
  const profileId = "stage-1-profile";
  const createdAt = "2026-09-01T10:00:00.000Z";
  const fixture = {
    profiles: [
      {
        id: profileId,
        displayName: "Existing workspace",
        createdAt,
        demo: false,
        theme: "light",
        onboardingComplete: true,
      },
    ],
    incomes: [
      {
        id: "old-income",
        profileId,
        effectiveMonth: "2026-09",
        amountMinor: 10000003,
        currency: "INR",
      },
    ],
    recurring: [
      {
        id: "old-schedule",
        profileId,
        sourceId: "rent-source",
        effectiveMonth: "2026-09",
        name: "Existing rent",
        category: "Room Rent",
        amountMinor: 1900007,
        currency: "INR",
        frequency: "monthly",
        active: true,
        startMonth: "2026-09",
        notes: "Existing schedule",
        paymentDay: 5,
      },
    ],
    plans: [
      {
        id: "old-plan",
        profileId,
        yearMonth: "2026-09",
        monthlyIncomeMinor: 10000003,
        incomeOverride: true,
        createdAt,
      },
    ],
    commitments: [
      {
        id: "old-commitment",
        profileId,
        yearMonth: "2026-09",
        sourceId: "rent-source",
        name: "Existing rent",
        category: "Room Rent",
        amountMinor: 1900007,
        origin: "recurring",
        paid: true,
        notes: "Already paid",
        paymentDay: 5,
      },
    ],
    expenses: [
      {
        id: "old-expense",
        profileId,
        date: "2026-09-15",
        amountMinor: 50001,
        category: "Food",
        description: "Historical lunch",
        notes: "Preserve paise",
        createdAt,
        updatedAt: createdAt,
      },
    ],
  };
  await page.evaluate(
    async ({ fixture, profileId }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("daywise-local-v1");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          Object.keys(fixture),
          "readwrite",
        );
        for (const [store, rows] of Object.entries(fixture))
          for (const row of rows) transaction.objectStore(store).put(row);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
      localStorage.setItem("daywise-profile", profileId);
    },
    { fixture, profileId },
  );
  await go(page, "/dashboard");
  await expect(page.locator(".summary-value")).toHaveText("₹1,00,000.03");
  await page.getByLabel("Select month", { exact: true }).fill("2026-09");
  await expect(page.locator(".equation-result dd")).toHaveText("₹2,700");
  await go(page, "/calendar");
  // A full navigation resets the selected month to the current month, as in Stage 1.
  await page.getByLabel("Select month", { exact: true }).fill("2026-09");
  await page.locator('.full-calendar [data-date="2026-09-15"]').click();
  await expect(page.locator(".day-breakdown dd")).toHaveText([
    "₹3,333.33",
    "₹633.33",
    "₹2,700",
    "₹500.01",
    "₹2,199.99",
  ]);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator(".full-calendar")).toBeVisible();
  const preserved = await page.evaluate(async (fixture) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("daywise-local-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const entries = await Promise.all(
      Object.entries(fixture).map(async ([store, rows]) => {
        const result = await Promise.all(
          rows.map(
            (row) =>
              new Promise((resolve, reject) => {
                const request = database
                  .transaction(store)
                  .objectStore(store)
                  .get(row.id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              }),
          ),
        );
        return [store, result];
      }),
    );
    database.close();
    return Object.fromEntries(entries);
  }, fixture);
  expect(preserved).toEqual(fixture);
});
