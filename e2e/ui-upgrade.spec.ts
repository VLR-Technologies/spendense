import { test, expect } from "@playwright/test";

test("prominent authentication, explicit guest identity, and stable guest entry", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of [
    "Sign in",
    "Create account",
    "Continue as guest",
    "Try demo",
  ]) {
    const action = page.getByRole("button", { name, exact: true });
    await expect(action).toBeVisible();
    expect((await action.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Create your account",
  );
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveAttribute(
    "autocomplete",
    "name",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Continue as guest", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip setup for now" }).click();
  await expect(page.locator(".customer-greeting")).toContainText("Guest");
  await expect(page.locator(".hero-customer")).toHaveText(
    "Guest’s Daily Budget",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Switch.*profile/ }),
  ).toHaveCount(0);
  const profiles = () =>
    page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("daywise-local-v1");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const list = await new Promise<unknown[]>((resolve, reject) => {
        const r = db.transaction("profiles").objectStore("profiles").getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      db.close();
      return list;
    });
  const before = await profiles();
  expect(before).toHaveLength(1);
  await page.reload();
  await expect(page.locator(".hero-customer")).toHaveText(
    "Guest’s Daily Budget",
  );
  expect(await profiles()).toEqual(before);
  // Test-only re-entry, preserving IndexedDB records.
  await page.evaluate(() => localStorage.removeItem("daywise-profile"));
  await page.reload();
  await page
    .getByRole("button", { name: "Continue as guest", exact: true })
    .click();
  await expect(page.locator(".hero-customer")).toHaveText(
    "Guest’s Daily Budget",
  );
  expect(await profiles()).toEqual(before);
  await page.goto("/settings");
  await page.getByLabel("Preferred guest name (optional)").fill("Élodie 王");
  await page
    .getByRole("button", { name: "Save display name", exact: true })
    .click();
  await page.goto("/dashboard");
  await expect(page.locator(".hero-customer")).toHaveText(
    "Élodie 王’s Daily Budget",
  );
  await expect(page.locator(".page-heading")).toContainText("Guest Mode");
});

test("responsive visual hierarchy, themes and large amounts", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.goto("/settings");
      await page.locator(`.theme-option.${theme}`).click();
      await page.goto("/dashboard");
      await expect(page.locator(".hero-customer")).toHaveText(
        "Demo’s Daily Budget",
      );
      const layout = await page.evaluate(() => {
        const hero = document.querySelector(".daily-hero")!;
        const amount = hero.querySelector(".hero-amount")!;
        const nav = document.querySelector(".topbar")!;
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          bodyFont: parseFloat(getComputedStyle(document.body).fontSize),
          amountContained:
            amount.getBoundingClientRect().right <=
            hero.getBoundingClientRect().right,
          accountCount: nav.querySelectorAll(".account-button").length,
        };
      });
      expect(layout).toEqual({
        overflow: false,
        bodyFont: 15,
        amountContained: true,
        accountCount: 1,
      });
      const contrast = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const channel = (v: number) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        const luminance = (color: string) => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          return (
            0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
          );
        };
        const ratio = (a: string, b: string) => {
          const x = luminance(a),
            y = luminance(b);
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        };
        const token = (name: string) => style.getPropertyValue(name).trim();
        return [
          ["body", ratio(token("--text"), token("--surface"))],
          ["supporting", ratio(token("--muted"), token("--surface"))],
          ["success", ratio(token("--positive"), token("--positive-bg"))],
          ["error", ratio(token("--negative"), token("--negative-bg"))],
          ["link", ratio(token("--accent-dark"), token("--surface"))],
        ] as [string, number][];
      });
      for (const [label, ratio] of contrast)
        expect(ratio, `${theme} ${label} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  }
  await page.goto("/settings");
  await page.locator(".theme-option.system").click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("button", { name: "Manage Budgets", exact: true })
    .click();
  await page.getByLabel("Create a new budget").fill("Separate guest budget");
  await page
    .getByRole("button", { name: "Create guest budget", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Monthly income amount" })
    .fill("1000000000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Skip setup for now" }).click();
  await page.goto("/dashboard");
  await expect(page.locator(".hero-amount")).toContainText("₹");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("narrow-large-amount.png"),
    fullPage: true,
  });
});
