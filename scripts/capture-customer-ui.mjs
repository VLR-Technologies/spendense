import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const dir = "docs/screenshots/customer-onboarding/after";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const evidence = [];
for (const width of [1440, 1024, 768, 390, 360]) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
    timezoneId: "Europe/Berlin",
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3300");
  await page.getByRole("button", { name: "Try demo", exact: true }).waitFor();
  await page.screenshot({
    path: `${dir}/${width}-welcome.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  await page.locator(".hero-amount").waitFor();
  const baseline = await page.locator(".budget-equation dd").allTextContents();
  for (const route of [
    "dashboard",
    "calendar",
    "monthly-plan",
    "expenses",
    "insights",
    "settings",
  ]) {
    await page.goto(`http://127.0.0.1:3300/${route}`);
    await page.locator("h1").waitFor();
    await page.locator(".page-skeleton").waitFor({ state: "hidden" });
    evidence.push({
      width,
      route,
      theme: "light",
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
    if (["dashboard", "settings"].includes(route))
      await page.screenshot({
        path: `${dir}/${width}-${route}.png`,
        fullPage: true,
        animations: "disabled",
      });
  }
  await page.locator(".theme-option.dark").click();
  await page.locator('html[data-theme="dark"]').waitFor();
  await page.goto("http://127.0.0.1:3300/dashboard");
  await page.locator(".hero-amount").waitFor();
  const current = await page.locator(".budget-equation dd").allTextContents();
  if (JSON.stringify(current) !== JSON.stringify(baseline))
    throw new Error("Theme or navigation changed financial values");
  await page.screenshot({
    path: `${dir}/${width}-dashboard-dark.png`,
    fullPage: true,
    animations: "disabled",
  });
  evidence.push({
    width,
    route: "dashboard",
    theme: "dark",
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    financialValues: current,
  });
  await context.close();
}
await browser.close();
await fs.writeFile(`${dir}/validation.json`, JSON.stringify(evidence, null, 2));
console.log(
  JSON.stringify({
    layouts: evidence.length,
    overflows: evidence.filter((x) => x.overflow).length,
  }),
);
if (evidence.some((x) => x.overflow)) process.exitCode = 1;
