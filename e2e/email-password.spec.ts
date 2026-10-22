import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import fs from "node:fs/promises";

const cloud = process.env.DAYWISE_CLOUD_TEST === "1";
const password = "Spendense-test-password-2026!";
async function signUp(page: Page, request: APIRequestContext, email: string) {
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("confirm your email");
  // The local stack enables confirmation, matching hosted Supabase's default.
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
    page.getByRole("button", { name: "Create cloud profile", exact: true }),
  ).toBeVisible();
}
async function signOut(page: Page) {
  await page
    .getByRole("button", { name: "Manage account", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }).first(),
  ).toBeVisible();
}

test("email/password confirmation, cloud financial history, two accounts and password recovery", async ({
  page,
  request,
}, info) => {
  test.skip(!cloud, "Requires the disposable local Supabase stack.");
  test.setTimeout(120000);
  const email = `password-${info.project.name}-${Date.now()}@example.test`;
  await page.clock.setFixedTime(new Date("2026-10-22T12:00:00+02:00"));
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹81,000");
  await signUp(page, request, email);
  // Signing up and confirming uploads no guest records.
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create cloud profile", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Monthly income amount" })
    .fill("100000.01");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Add a monthly commitment" }).click();
  const form = page.getByRole("dialog").last();
  await form.getByLabel("Expense name", { exact: true }).fill("Cloud rent");
  await form
    .getByRole("spinbutton", { name: "Commitment amount" })
    .fill("10000.03");
  await form.getByRole("button", { name: "Save commitment" }).click();
  await page.getByRole("button", { name: "See my daily allowance" }).click();
  await page.getByRole("button", { name: "Open my calendar" }).click();
  await page.goto("/monthly-plan");
  await expect(page.locator(".commitment-row")).toContainText("₹10,000.03");
  await page
    .getByRole("button", { name: "Mark Cloud rent paid", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark Cloud rent unpaid", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".net-flow")).toContainText("₹89,999.98");
  await page.getByLabel("Select month", { exact: true }).fill("2026-11");
  await expect(page.locator(".commitment-row")).toContainText("₹10,000.03");
  await page
    .getByRole("button", { name: "Edit Cloud rent", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Commitment amount" })
    .fill("11000.07");
  await page
    .getByRole("button", { name: "Save commitment", exact: true })
    .click();
  await expect(page.locator(".commitment-row")).toContainText("₹11,000.07");
  await page.getByLabel("Select month", { exact: true }).fill("2026-10");
  await expect(page.locator(".commitment-row")).toContainText("₹10,000.03");
  await expect(
    page.getByRole("button", { name: "Mark Cloud rent unpaid", exact: true }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Expense amount" }).fill("12.34");
  await page
    .getByLabel("What was it for?", { exact: true })
    .fill("Cloud lunch");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add expense", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Expense added");
  await page.reload();
  await expect(
    page.getByText("Cloud lunch", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/settings");
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backup = JSON.parse(
    await fs.readFile((await (await downloadEvent).path())!, "utf8"),
  );
  expect(backup.expenses[0].amountMinor).toBe(1234);
  expect(
    backup.plans.find((p: { yearMonth: string }) => p.yearMonth === "2026-10")
      .monthlyIncomeMinor,
  ).toBe(10000001);
  expect(
    backup.commitments.find(
      (c: { yearMonth: string }) => c.yearMonth === "2026-10",
    ),
  ).toMatchObject({ amountMinor: 1000003, paid: true });
  expect(
    backup.commitments.find(
      (c: { yearMonth: string }) => c.yearMonth === "2026-11",
    ).amountMinor,
  ).toBe(1100007);
  await signOut(page);
  // The original demo still lives in IndexedDB after authenticated cloud CRUD.
  await page.goto("/dashboard");
  await expect(
    page.getByRole("region", { name: "Monthly budget calculation" }),
  ).toContainText("₹81,000");
  await signUp(page, request, `other-${email}`);
  await expect(page.getByText("Cloud lunch", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Cloud rent", { exact: true })).toHaveCount(0);
  await signOut(page);
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page
    .getByRole("button", { name: "Sign in with email", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Email or password is incorrect",
  );
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Sign in with email", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Manage account", exact: true }).first(),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByText("Cloud lunch", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Manage account", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await page
    .getByLabel("New password", { exact: true })
    .fill(`${password}-new`);
  await page
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Manage account", exact: true }).first(),
  ).toBeVisible();
  await signOut(page);
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(`${password}-new`);
  await page
    .getByRole("button", { name: "Sign in with email", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Manage account", exact: true }).first(),
  ).toBeVisible();
});
