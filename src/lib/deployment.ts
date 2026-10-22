export type AppMode = "maintenance" | "staging" | "live";

/** Public configuration is fixed by next build. Missing/unknown values stay locked. */
export function appMode(): AppMode {
  const mode = process.env.NEXT_PUBLIC_APP_MODE;
  return mode === "live" || mode === "staging" ? mode : "maintenance";
}

export function financialOperationsEnabled() {
  return appMode() === "live";
}

export function requireFinancialOperations() {
  if (!financialOperationsEnabled())
    throw new Error(
      "Spendense is in maintenance mode. Financial operations are paused.",
    );
}
