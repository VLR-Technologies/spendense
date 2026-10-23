/** Isolated QA contexts only; existing demo support stays out of the landing UI. */
exports.installDemoFixture = async function installDemoFixture(page) {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const fixture = JSON.parse(
    await readFile(resolve(__dirname, "../../e2e/fixtures/demo.json"), "utf8"),
  );
  if (!["127.0.0.1", "localhost"].includes(new URL(page.url()).hostname))
    throw new Error("Demo fixtures require a local QA server.");
  await page
    .getByRole("button", { name: "Continue as guest", exact: true })
    .waitFor();
  await page.evaluate(async (backup) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("daywise-local-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stores = {
      profiles: [backup.profile],
      incomes: backup.incomes,
      recurring: backup.recurring,
      plans: backup.plans,
      commitments: backup.commitments,
      expenses: backup.expenses,
      categories: backup.categories,
    };
    await new Promise((resolve, reject) => {
      const tx = database.transaction(Object.keys(stores), "readwrite");
      for (const [store, records] of Object.entries(stores))
        for (const record of records) tx.objectStore(store).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    database.close();
    localStorage.setItem("daywise-profile", backup.profile.id);
  }, fixture);
  await page.reload();
  await page.locator(".hero-customer").waitFor();
};
