import { test, expect } from "@playwright/test";

test("locked Spendense routes never open records, authenticate, or show sample money", async ({
  page,
  request,
}) => {
  const serviceRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      /^\/(?:api\/auth|rest\/v1|auth\/v1)(?:\/|$)/.test(url.pathname)
    )
      serviceRequests.push(req.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    // Fail loudly if mounting a financial workspace opens browser records.
    indexedDB.open = () => {
      throw new Error("Locked preview opened IndexedDB");
    };
    localStorage.setItem("daywise-profile", "existing-profile-must-stay");
  });
  for (const route of [
    "/",
    "/dashboard",
    "/calendar",
    "/monthly-plan",
    "/expenses",
    "/insights",
    "/settings",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    await expect(page).toHaveTitle("Spendense — Make every day count.");
    await expect(page.getByRole("status")).toContainText(
      "You cannot enter, import, or change financial data",
    );
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("button")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toMatch(/daywise|₹/i);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() => localStorage.getItem("daywise-profile")),
    ).toBe("existing-profile-must-stay");
  }
  const identity = await request.get("/api/auth");
  expect(identity.status()).toBe(503);
  expect(identity.headers()["cache-control"]).toContain("no-store");
  expect(await identity.json()).toEqual({
    user: null,
    configured: false,
    maintenance: true,
  });
  const callback = await request.get("/auth/callback?code=do-not-exchange");
  expect(callback.status()).toBe(503);
  expect(await callback.text()).not.toContain("do-not-exchange");
  expect(serviceRequests).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/deployment-${test.info().project.name}.png`,
    fullPage: true,
  });
});
