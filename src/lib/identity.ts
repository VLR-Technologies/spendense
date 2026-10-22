/** Display-only metadata. Authorization always uses the verified Supabase user ID. */
export type CustomerAccount = {
  id: string;
  email?: string;
  displayName?: string;
};
export function cleanDisplayName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, 200) || undefined;
}
export function customerName(
  account: CustomerAccount | null,
  guestName?: string,
  demo = false,
) {
  if (demo) return "Demo";
  if (account)
    return (
      cleanDisplayName(account.displayName) ??
      account.email?.split("@")[0] ??
      "Customer"
    );
  return cleanDisplayName(guestName) ?? "Guest";
}
export function customerInitial(name: string) {
  return Array.from(name)[0]?.toLocaleUpperCase() ?? "G";
}
