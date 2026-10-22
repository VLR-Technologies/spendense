import type { Page } from "@playwright/test";
// Local integration fixtures only. SSR may split an Auth cookie after metadata grows.
export async function readLocalSession(page: Page) {
  const parts = (await page.context().cookies()).filter(
    (c) => c.name.includes("auth-token") && !c.name.includes("code-verifier"),
  );
  if (!parts.length) throw new Error("Missing local fixture session");
  parts.sort(
    (a, b) =>
      Number(a.name.match(/\.(\d+)$/)?.[1] ?? 0) -
      Number(b.name.match(/\.(\d+)$/)?.[1] ?? 0),
  );
  const cookie = parts[0];
  const name = cookie.name.replace(/\.\d+$/, "");
  const session = JSON.parse(
    Buffer.from(
      parts
        .map((c) => c.value)
        .join("")
        .replace(/^base64-/, ""),
      "base64url",
    ).toString(),
  );
  return { cookie, name, session };
}
export async function writeLocalSession(
  page: Page,
  fixture: Awaited<ReturnType<typeof readLocalSession>>,
) {
  const encoded = `base64-${Buffer.from(JSON.stringify(fixture.session)).toString("base64url")}`;
  await page.context().clearCookies({ name: /auth-token/ });
  const chunks = encoded.match(/.{1,3000}/g)!;
  await page
    .context()
    .addCookies(
      chunks.map((value, i) => ({
        ...fixture.cookie,
        name: chunks.length === 1 ? fixture.name : `${fixture.name}.${i}`,
        value,
      })),
    );
}
