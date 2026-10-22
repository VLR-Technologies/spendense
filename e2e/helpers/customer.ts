import { expect, type Page } from "@playwright/test";
export async function completeCustomerSetup(
  page: Page,
  monthly?: string,
  rent?: string,
) {
  await page.locator(".customer-onboarding, .daily-hero").first().waitFor();
  if (!(await page.locator(".customer-onboarding").isVisible())) return;
  const name = page.getByLabel("Full name", { exact: true });
  if (!(await name.inputValue())) await name.fill("Test Customer");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  if (monthly)
    await page
      .getByLabel("Monthly personal income (₹)", { exact: true })
      .fill(monthly);
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  if (monthly) {
    await page
      .getByLabel("Apply a confirmed income allocation to this budget")
      .check();
    await page
      .getByLabel("Apply income to", { exact: true })
      .selectOption("default");
  }
  if (rent) {
    await page.getByRole("button", { name: "Add recurring expense" }).click();
    const form = page.getByRole("dialog").last();
    await form.getByLabel("Expense name", { exact: true }).fill("Cloud rent");
    await form
      .getByRole("spinbutton", { name: "Commitment amount" })
      .fill(rent);
    await form.getByRole("button", { name: "Save commitment" }).click();
  }
  await page
    .getByRole("button", { name: "Complete setup", exact: true })
    .click();
  await expect(page.locator(".hero-customer")).toBeVisible();
}
export async function editCustomerName(page: Page, name: string) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Full name", { exact: true })
    .fill(name);
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save and continue", exact: true })
      .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save details", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
