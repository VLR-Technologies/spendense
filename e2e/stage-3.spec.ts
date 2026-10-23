import { installDemoFixture } from "../scripts/lib/demo-fixture.cjs";
import { readLocalSession, writeLocalSession } from "./helpers/session";
import { completeCustomerSetup } from "./helpers/customer";
import { createClient } from "@supabase/supabase-js";
import os from "node:os";
import pathModule from "node:path";
import {
  chromium,
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import fs from "node:fs/promises";
const cloud = process.env.DAYWISE_CLOUD_TEST === "1";
async function account(page: Page) {
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Storage & imports", exact: true })
    .click();
}
async function signIn(page: Page, request: APIRequestContext, email: string) {
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Forgot your password? Use an email link" })
    .click();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");
  let link = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(
          "http://127.0.0.1:54324/api/v1/messages",
        );
        const body = await response.json();
        const message = body.messages?.find(
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
  await completeCustomerSetup(page);
  await expect(
    page.getByRole("button", { name: "Manage account", exact: true }).first(),
  ).toBeVisible();
}
async function screenshot(page: Page, name: string) {
  await expect(page.locator(".toast")).toHaveCount(0);
  await fs.mkdir("docs/screenshots/stage-3", { recursive: true });
  await page.screenshot({
    path: `docs/screenshots/stage-3/${name}.png`,
    fullPage: false,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test("optional sign-in preserves guest access and reports missing configuration", async ({
  page,
}, info) => {
  test.skip(cloud, "This check exercises the unconfigured guest installation.");
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("not configured");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeDisabled();
  await screenshot(page, `${info.project.name}-sign-in-light`);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await screenshot(page, `${info.project.name}-sign-in-dark`);
  await page
    .getByRole("button", { name: "Continue as guest", exact: true })
    .click();
  await installDemoFixture(page);
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Demo/,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹1,00,000");
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Expense amount" }).fill("1.01");
  await page
    .getByLabel("What was it for?", { exact: true })
    .fill("Offline paise");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add expense", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Expense added");
  await page.context().setOffline(false);
});
test("expired callback provides an actionable sign-in error", async ({
  page,
}) => {
  await page.goto("/auth/callback?code=invalid-test-code");
  await expect(page.getByRole("dialog")).toContainText("expired");
  await page
    .getByRole("button", { name: "Continue as guest", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue as guest", exact: true }),
  ).toBeVisible();
});
test("local email authentication, consented import, retry, account isolation, refresh and cross-device persistence", async ({
  page,
  request,
}, info) => {
  test.skip(
    !cloud,
    "Run npm run test:cloud against the disposable local Supabase stack.",
  );
  test.setTimeout(180000);
  const email = `daywise-${info.project.name}-${Date.now()}@example.test`;
  await page.goto("/");
  await installDemoFixture(page);
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹81,000");
  await signIn(page, request, email);
  await expect(page.locator(".hero-customer")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹0");
  // No automatic upload, even after a real email login.
  await account(page);
  await expect(page.getByRole("dialog")).toContainText(email);
  await screenshot(page, `${info.project.name}-account-light`);
  await page
    .getByLabel("Import a local profile", { exact: true })
    .selectOption({ label: "Spendense demo" });
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "2. Import separate cloud profile" }),
  ).toBeDisabled();
  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "1. Download local backup" }).click();
  const download = await backupDownload;
  const path = await download.path();
  const original = JSON.parse(await fs.readFile(path!, "utf8"));
  await page.getByRole("checkbox").check();
  await screenshot(page, `${info.project.name}-migration-review`);
  await page
    .getByRole("button", { name: "2. Import separate cloud profile" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Import verified", exact: true }),
  ).toBeVisible();
  await screenshot(page, `${info.project.name}-migration-result`);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹81,000");
  await account(page);
  await page
    .getByLabel("Import a local profile", { exact: true })
    .selectOption({ label: "Spendense demo" });
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await page.getByRole("button", { name: "1. Download local backup" }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "2. Import separate cloud profile" })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "No duplicate",
  );
  await screenshot(page, `${info.project.name}-migration-retry`);
  await page.getByRole("button", { name: "Close dialog" }).click();
  for (const route of [
    "/dashboard",
    "/calendar",
    "/monthly-plan",
    "/expenses",
    "/insights",
    "/settings",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".error-banner")).toHaveCount(0);
  }
  // Export the cloud workspace and verify exact record counts and paise.
  const exportedDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const exported = await exportedDownload;
  const saved = JSON.parse(await fs.readFile((await exported.path())!, "utf8"));
  for (const key of [
    "incomes",
    "recurring",
    "plans",
    "commitments",
    "expenses",
    "categories",
  ]) {
    expect(saved[key].length).toBe(original[key].length);
    const total = (items: Record<string, number>[]) =>
      items.reduce(
        (a, r) => a + (r.amountMinor ?? r.monthlyIncomeMinor ?? 0),
        0,
      );
    expect(total(saved[key])).toBe(total(original[key]));
  }
  await page.getByLabel("Import backup file", { exact: true }).setInputFiles({
    name: "existing-history.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(original)),
  });
  await expect(page.getByRole("dialog")).toContainText(
    `Upload a separate cloud profile to ${email}`,
  );
  await expect(
    page.getByRole("button", { name: "Import profile", exact: true }),
  ).toBeDisabled();
  const fileBackup = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download import backup", exact: true })
    .click();
  await fileBackup;
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: "Import profile", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await account(page);
  await screenshot(page, `${info.project.name}-account-dark`);
  await page.getByRole("button", { name: "Close dialog" }).click();
  // A separate browser context signs in independently and reads the same backend records.
  const disk = await fs.mkdtemp(
    pathModule.join(os.tmpdir(), "daywise-browser-"),
  );
  const second = await chromium.launchPersistentContext(disk, {
    channel: "chrome",
    headless: true,
  });
  const device = await second.newPage();
  await device.goto("http://127.0.0.1:3100/");
  await signIn(device, request, email);
  await expect(
    device.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹81,000");
  await second.close();
  const restarted = await chromium.launchPersistentContext(disk, {
    channel: "chrome",
    headless: true,
  });
  const reopened = await restarted.newPage();
  await reopened.goto("http://127.0.0.1:3100/dashboard");
  await expect(
    reopened.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹81,000");
  await restarted.close();
  await fs.rm(disk, { recursive: true, force: true });
  // Expiry of the stored session refreshes cookies server-side from its refresh token.
  const fixture = await readLocalSession(page);
  const stored = fixture.session;
  stored.expires_at = 1;
  await writeLocalSession(page, fixture);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const renewed = await readLocalSession(page);
  expect(renewed.session.expires_at).toBeGreaterThan(1);
  // Unavailable cloud operations show an error and can be retried.
  await page.route("**/rest/v1/rpc/daywise_month", (route) => route.abort());
  await page.goto("/dashboard");
  await expect(page.locator(".error-banner")).toContainText("retry");
  await page.unroute("**/rest/v1/rpc/daywise_month");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹81,000");
  await account(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Sign out of Spendense?",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }).first(),
  ).toBeVisible();
  await page.goto("/dashboard");
  // Local data survived the import and logout.
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹81,000");
  await signIn(page, request, `other-${email}`);
  await expect(page.locator(".hero-customer")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹0");
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).not.toContainText("₹81,000");
  // Real authenticated HTTP requests cannot bypass database ownership.
  const bobSession = (await readLocalSession(page)).session;
  const attacker = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${bobSession.access_token}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  expect(
    (await attacker.from("profiles").select("*").eq("id", saved.profile.id))
      .data,
  ).toEqual([]);
  expect(
    (
      await attacker
        .from("profiles")
        .update({ displayName: "forbidden" })
        .eq("id", saved.profile.id)
        .select("id")
    ).data,
  ).toEqual([]);
  expect(
    (
      await attacker
        .from("daily_expenses")
        .delete()
        .eq("profileId", saved.profile.id)
        .select("id")
    ).data,
  ).toEqual([]);
  expect(
    (await attacker.rpc("daywise_export", { p_id: saved.profile.id })).error
      ?.code,
  ).toBe("42501");
  expect(
    (
      await attacker.rpc("daywise_import", {
        p_backup: {},
        p_source: "malicious",
        p_fingerprint: "a".repeat(64),
        p_manifest: {},
        p_owner: stored.user.id,
      })
    ).error?.code,
  ).toBe("42501");
  expect(
    (
      await attacker.from("daily_expenses").insert({
        profileId: saved.profile.id,
        owner_id: bobSession.user.id,
        date: "2026-10-01",
        amountMinor: 1,
        category: "x",
        description: "forbidden",
      })
    ).error?.code,
  ).toBe("23503");
  const anonymous = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect((await anonymous.from("daily_expenses").select("*")).error?.code).toBe(
    "42501",
  );
  await account(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }).first(),
  ).toBeVisible();
  await signIn(page, request, email);
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹81,000");
  const invalid = await readLocalSession(page);
  invalid.session.access_token = "invalid.jwt.token";
  invalid.session.refresh_token = "expired-invalid";
  invalid.session.expires_at = 1;
  await writeLocalSession(page, invalid);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹81,000");
});
