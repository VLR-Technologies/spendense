import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
const cloud = process.env.DAYWISE_CLOUD_TEST === "1";
test("landing has three actions and a balanced illustrative card at five widths", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "The desktop project exercises the complete width matrix.",
  );
  await page.goto("/");
  await fs.mkdir("docs/screenshots/landing-oauth", { recursive: true });
  for (const width of [1440, 1024, 768, 390, 360])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      for (const name of ["Create account", "Sign in", "Continue as guest"]) {
        const action = page.getByRole("button", { name, exact: true });
        await expect(action).toBeVisible();
        expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await expect(
        page.getByRole("button", { name: /Try (the )?demo/i }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: /Try (the )?demo/i }),
      ).toHaveCount(0);
      await expect(
        page.getByLabel("Spendense sample budget preview"),
      ).toContainText("Illustrative example");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `docs/screenshots/landing-oauth/${width}-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
});
test("cancelled Google sign-in returns a friendly error with guest access", async ({
  page,
}) => {
  await page.goto(
    "/auth/callback?error=access_denied&error_description=private-provider-message&code=never-use",
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("cancelled");
  await expect(dialog).not.toContainText("private-provider-message");
  expect(page.url()).not.toContain("error_description");
  await dialog
    .getByRole("button", { name: "Continue as guest", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue as guest", exact: true }),
  ).toBeVisible();
});
test("disabled local Google provider stays in the app and preserves email and guest access", async ({
  page,
}) => {
  test.skip(
    !cloud,
    "Uses the real public settings of disposable local Supabase.",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Google sign-in is not enabled yet",
  );
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:3100");
});
test("Google button invokes the real SDK with provider google and PKCE (initiation only)", async ({
  page,
}) => {
  test.skip(!cloud, "Requires a configured disposable local Supabase client.");
  await page.goto("/");
  await page.route("**/auth/v1/settings", (route) =>
    route.fulfill({ json: { external: { google: true } } }),
  );
  let requestUrl = "";
  await page.route("**/auth/v1/authorize?**", async (route) => {
    requestUrl = route.request().url();
    await route.fulfill({
      contentType: "text/html",
      body: "OAuth initiation test only; no Google login has completed.",
    });
  });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByText(
      "OAuth initiation test only; no Google login has completed.",
    ),
  ).toBeVisible();
  const url = new URL(requestUrl);
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe(
    "http://127.0.0.1:3100/auth/callback",
  );
  expect(url.searchParams.get("code_challenge_method")).toBe("s256");
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
  expect(
    (await page.context().cookies()).some((c) =>
      c.name.includes("code-verifier"),
    ),
  ).toBe(true);
});
