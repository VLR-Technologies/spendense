import type { Profile } from "@/types";

/** Display the renamed built-in demo without rewriting stored profiles/backups. */
export function profileDisplayName(
  profile: Pick<Profile, "demo" | "displayName">,
) {
  return profile.demo && profile.displayName === "Daywise demo"
    ? "Spendense demo"
    : profile.displayName;
}
