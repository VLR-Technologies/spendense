import { financialOperationsEnabled } from "../deployment";

export const sessionCookieOptions = {
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
export function supabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url && !key) return { status: "missing" } as const;
  // Validate the key even if the URL is missing: never bundle elevated credentials.
  if (key?.startsWith("sb_secret_")) return { status: "unsafe-key" } as const;
  if (key && !key.startsWith("sb_publishable_")) {
    try {
      if (key.split(".").length !== 3) throw new Error();
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role === "service_role" || payload.role === "supabase_admin")
        return { status: "unsafe-key" } as const;
      if (payload.role !== "anon") throw new Error();
    } catch {
      return { status: "invalid" } as const;
    }
  }
  if (!url || !key) return { status: "incomplete" } as const;
  try {
    const parsed = new URL(url);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      parsed.hostname,
    );
    if (
      !(
        parsed.protocol === "https:" ||
        (parsed.protocol === "http:" && loopback)
      ) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/" ||
      key.trim() !== key ||
      key === "sb_publishable_"
    )
      return { status: "invalid" } as const;
  } catch {
    return { status: "invalid" } as const;
  }
  return { status: "ready", url, key } as const;
}

export function supabaseConfig() {
  if (!financialOperationsEnabled()) return null;
  const result = supabaseEnvironment();
  return result.status === "ready"
    ? { url: result.url, key: result.key }
    : null;
}
