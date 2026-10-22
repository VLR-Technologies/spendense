import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const phase = process.argv[2] ?? "after";
if (!["before", "after"].includes(phase))
  throw new Error("Use before or after");
const dir = `docs/screenshots/ui-upgrade/${phase}`;
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const evidence = [];
for (const width of [1440, 1024, 768, 390, 360]) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
    timezoneId: "Europe/Berlin",
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3300");
  await page
    .getByRole("button", { name: "Continue as guest", exact: true })
    .waitFor();
  await page.screenshot({
    path: `${dir}/${width}-welcome.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: /^Try (the )?demo$/ }).click();
  await page.locator(".hero-amount").waitFor();
  await page
    .getByRole("region", { name: "Monthly budget calculation" })
    .waitFor();
  await page.screenshot({
    path: `${dir}/${width}-dashboard.png`,
    fullPage: true,
    animations: "disabled",
  });
  if (phase === "after" && [1440, 390].includes(width))
    await page.screenshot({
      path: `${dir}/${width}-dashboard-viewport.png`,
      fullPage: false,
      animations: "disabled",
    });
  const values = await page.locator(".budget-equation dd").allTextContents();
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
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    evidence.push({
      width,
      route,
      theme: "light",
      overflow,
      values: route === "dashboard" ? values : undefined,
    });
    if (phase === "after")
      await page.screenshot({
        path: `${dir}/${width}-${route}.png`,
        fullPage: true,
        animations: "disabled",
      });
  }
  await page.locator(".theme-option.dark").click();
  await page.goto("http://127.0.0.1:3300/dashboard");
  await page.locator(".hero-amount").waitFor();
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
  });
  await context.close();
}
await fs.writeFile(`${dir}/validation.json`, JSON.stringify(evidence, null, 2));
if (phase === "after") {
  const baseline = JSON.parse(
    await fs.readFile(
      "docs/screenshots/ui-upgrade/before/validation.json",
      "utf8",
    ),
  );
  for (const row of evidence.filter((row) => row.values)) {
    const original = baseline.find(
      (item) => item.width === row.width && item.values,
    );
    if (JSON.stringify(row.values) !== JSON.stringify(original.values))
      throw new Error(`Financial baseline changed at ${row.width}px`);
  }
}
await browser.close();
console.log(JSON.stringify(evidence));
if (evidence.some((x) => x.overflow)) process.exitCode = 1;
