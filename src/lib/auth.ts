import { browserClient } from "./supabase/browser";
import { z } from "zod";
import {
  financialOperationsEnabled,
  requireFinancialOperations,
} from "./deployment";
export type Account = { id: string; email?: string };
const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(8).max(128);
function requiredClient() {
  requireFinancialOperations();
  const client = browserClient();
  if (!client)
    throw new Error(
      "Cloud sign-in is not configured on this installation. Guest mode is ready to use.",
    );
  return client;
}
function credentials(email: string, password: string, signup = false) {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) throw new Error("Enter a valid email address.");
  if (
    !(signup ? passwordSchema : z.string().min(1).max(128)).safeParse(password)
      .success
  )
    throw new Error(
      signup ? "Use a password with 8–128 characters." : "Enter your password.",
    );
  return { email: parsed.data, password };
}
export const auth = {
  configured: () => financialOperationsEnabled() && !!browserClient(),
  subscribe(callback: () => void) {
    if (!financialOperationsEnabled()) return () => {};
    const client = browserClient();
    const subscription = client?.auth.onAuthStateChange(() => {
      callback();
    }).data.subscription;
    return () => subscription?.unsubscribe();
  },
  async current(): Promise<Account | null> {
    if (!financialOperationsEnabled() || !browserClient()) return null;
    let response;
    try {
      response = await fetch("/api/auth", {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new Error(
        "Cannot verify your cloud session. Check your connection and retry.",
      );
    }
    if (response.status === 401) return null;
    if (!response.ok)
      throw new Error(
        "Cannot verify your cloud session. Check your connection and retry.",
      );
    return (await response.json()).user;
  },
  async signIn(provider: "google" | "email", email = "") {
    const client = requiredClient();
    const redirectTo = `${location.origin}/auth/callback`;
    const result =
      provider === "google"
        ? await client.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo },
          })
        : await client.auth.signInWithOtp({
            email: emailSchema.parse(email),
            options: { emailRedirectTo: redirectTo },
          });
    if (result.error) throw new Error(result.error.message);
  },
  async signUp(email: string, password: string) {
    const values = credentials(email, password, true);
    const { data, error } = await requiredClient().auth.signUp({
      ...values,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) throw new Error(error.message);
    // With email confirmation enabled, Supabase deliberately returns no session.
    return { confirmationRequired: !data.session };
  },
  async signInWithPassword(email: string, password: string) {
    const values = credentials(email, password);
    const { error } = await requiredClient().auth.signInWithPassword(values);
    if (error)
      throw new Error(
        error.code === "invalid_credentials"
          ? "Email or password is incorrect. Try again or use an email sign-in link."
          : error.message,
      );
  },
  async updatePassword(password: string) {
    if (!passwordSchema.safeParse(password).success)
      throw new Error("Use a password with 8–128 characters.");
    const { error } = await requiredClient().auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },
  async signOut() {
    requireFinancialOperations();
    const client = browserClient();
    const result = await client?.auth.signOut({ scope: "local" });
    if (result?.error)
      throw new Error("Could not sign out. Check your connection and retry.");
  },
};
