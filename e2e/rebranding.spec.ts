import { test, expect } from "@playwright/test";

test("Spendense branding preserves an existing demo profile and financial records", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-22T12:00:00+02:00"));
  await page.goto("/");
  await expect(page.locator(".welcome .brand")).toHaveText("Spendense.");
  await expect(page).toHaveTitle("Spendense — Make every day count.");
  await expect(page.locator('meta[name="application-name"]')).toHaveAttribute(
    "content",
    "Spendense",
  );
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("daywise-local-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(
        ["profiles", "incomes", "plans"],
        "readwrite",
      );
      tx.objectStore("profiles").put({
        id: "legacy-demo",
        displayName: "Daywise demo",
        demo: true,
        theme: "dark",
        onboardingComplete: true,
        createdAt: "2026-10-01T00:00:00.000Z",
      });
      tx.objectStore("incomes").put({
        id: "legacy-income",
        profileId: "legacy-demo",
        effectiveMonth: "2026-10",
        amountMinor: 12345,
        currency: "INR",
      });
      tx.objectStore("plans").put({
        id: "legacy-plan",
        profileId: "legacy-demo",
        yearMonth: "2026-10",
        monthlyIncomeMinor: 12345,
        incomeOverride: false,
        createdAt: "2026-10-01T00:00:00.000Z",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    database.close();
    localStorage.setItem("daywise-profile", "legacy-demo");
    localStorage.setItem("daywise-theme", "dark");
  });
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹123.45");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/settings");
  await expect(page.getByLabel("Profile name", { exact: true })).toHaveValue(
    "Spendense demo",
  );
  expect(await page.locator("body").innerText()).not.toMatch(/daywise/i);
  const saved = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("daywise-local-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = database.transaction(["profiles", "plans"]);
    const read = (store: string, id: string) =>
      new Promise<unknown>((resolve, reject) => {
        const request = tx.objectStore(store).get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const profile = await read("profiles", "legacy-demo");
    const plan = await read("plans", "legacy-plan");
    database.close();
    return {
      profile,
      plan,
      selection: localStorage.getItem("daywise-profile"),
    };
  });
  expect(saved.profile).toMatchObject({
    id: "legacy-demo",
    displayName: "Daywise demo",
    theme: "dark",
  });
  expect(saved.plan).toMatchObject({
    id: "legacy-plan",
    monthlyIncomeMinor: 12345,
  });
  expect(saved.selection).toBe("legacy-demo");
});
