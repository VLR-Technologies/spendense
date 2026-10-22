"use client";
import Link from "next/link";
import { customerName, customerInitial } from "@/lib/identity";
import { ProfileDialog } from "./forms";
import { profileDisplayName } from "@/lib/branding";
import { useEffect, useState, useId } from "react";
import { Cloud, HardDrive, Download, Check, Mail } from "lucide-react";
import { useApp } from "./provider";
import { auth } from "@/lib/auth";
import { accountMigration } from "@/lib/account-migration";
import { downloadFile } from "@/lib/download";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
type Review = Awaited<ReturnType<typeof accountMigration.review>>;
export function AccountControls({
  expanded = false,
  landing = false,
}: {
  expanded?: boolean;
  landing?: boolean;
}) {
  const {
    account,
    mode,
    switchMode,
    recheckAccount,
    authError,
    localProfiles,
    selectProfile,
    refresh,
    showImportResult,
    profiles,
    profile,
    guestName,
    setGuestName,
  } = useApp();
  const identity = customerName(account, guestName, !account && profile?.demo);
  const [fullName, setFullName] = useState("");
  const [editName, setEditName] = useState<string | null>(null);
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const passwordHint = useId();
  const [password, setPassword] = useState("");
  const [emailFlow, setEmailFlow] = useState<"signin" | "signup" | "link">(
    "signin",
  );
  const [changingPassword, setChangingPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [source, setSource] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [consent, setConsent] = useState(false);
  const configured = auth.configured();
  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.has("auth_error")) {
      void Promise.resolve().then(() => {
        setError(
          "This sign-in link expired or could not be verified. Request a new link or try Google again.",
        );
        setOpen(true);
      });
      url.searchParams.delete("auth_error");
      history.replaceState(null, "", url);
    }
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not connect. Retry when you are online.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {expanded ? (
        <section className="panel settings-panel account-setting">
          <div className="account-identity">
            <span className="avatar avatar-large">
              {customerInitial(identity)}
            </span>
            <div>
              <h2>
                {account
                  ? "My Account"
                  : profile?.demo
                    ? "Demo Mode"
                    : "Guest Mode"}
              </h2>
              <strong className="identity-name" title={identity}>
                {identity}
              </strong>
              <p>
                {account?.email ??
                  (profile?.demo
                    ? "Sample records stored separately in this browser."
                    : "Saved in this browser. Guest data is not synchronized.")}
              </p>
            </div>
          </div>
          {(account || !profile?.demo) && (
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  if (account) {
                    await auth.updateDisplayName(
                      editName ?? account.displayName ?? "",
                    );
                    recheckAccount();
                  } else {
                    setGuestName?.(editName ?? guestName ?? "");
                    setMessage("Preferred name saved.");
                  }
                });
              }}
            >
              <label className="field">
                {account
                  ? "Customer display name"
                  : "Preferred guest name (optional)"}
                <input
                  autoComplete="name"
                  value={
                    editName ??
                    (account ? (account.displayName ?? "") : (guestName ?? ""))
                  }
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={200}
                  required={!!account}
                />
              </label>
              <Button type="submit" variant="secondary" disabled={busy}>
                {busy ? "Saving…" : "Save display name"}
              </Button>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p role="status" className="account-success">
                  {message}
                </p>
              )}
            </form>
          )}
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {account ? "Storage & imports" : "Sign in"}
          </Button>
        </section>
      ) : landing && !account ? (
        <div className="auth-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setEmailFlow("signin");
              setOpen(true);
            }}
          >
            Sign in
          </Button>
          <Button
            onClick={() => {
              setEmailFlow("signup");
              setOpen(true);
            }}
          >
            Create account
          </Button>
        </div>
      ) : (
        <button
          className="account-button"
          onClick={() => setOpen(true)}
          aria-label={account ? "Manage account" : "Sign in"}
        >
          <span className="avatar avatar-small" aria-hidden="true">
            {customerInitial(
              account ? identity : profile?.demo ? "Demo" : "Guest",
            )}
          </span>
          <span className="account-trigger-name" title={identity}>
            {account
              ? identity
              : profile?.demo
                ? "Demo · Sign in"
                : "Guest · Sign in"}
          </span>
        </button>
      )}
      <ProfileDialog open={budgetsOpen} onClose={() => setBudgetsOpen(false)} />
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setSigningOut(false);
            setPassword("");
            setChangingPassword(false);
          }
        }}
        title={
          account
            ? signingOut
              ? "Sign out of Spendense?"
              : expanded
                ? "Storage & imports"
                : "My Account"
            : emailFlow === "signup"
              ? "Create your account"
              : emailFlow === "link"
                ? "Email sign-in link"
                : "Sign in to Spendense"
        }
        description={
          account
            ? account.email
            : "Access your budgets across devices. Guest records stay separate."
        }
      >
        {(error || authError) && (
          <p className="form-error" role="alert">
            {error || authError}
          </p>
        )}
        {message && (
          <p className="account-success" role="status">
            <Check size={16} />
            {message}
          </p>
        )}
        {!account ? (
          <div className="stack-form">
            {!configured && (
              <p className="account-note">
                Cloud sign-in is not configured or is unavailable on this
                installation. You can continue as a guest on this device.
              </p>
            )}
            <Button
              variant="secondary"
              disabled={busy || !configured}
              onClick={() => run(() => auth.signIn("google"))}
            >
              Continue with Google
            </Button>
            <div className="account-divider">or use your email</div>
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  if (emailFlow === "link") {
                    await auth.signIn("email", email);
                    setMessage(
                      "Check your inbox for a sign-in link. Open it in this browser.",
                    );
                  } else if (emailFlow === "signup") {
                    const result = await auth.signUp(email, password, fullName);
                    setPassword("");
                    if (result.confirmationRequired)
                      setMessage(
                        "Check your inbox to confirm your email. Open the link in this browser, then sign in.",
                      );
                    else recheckAccount();
                  } else {
                    await auth.signInWithPassword(email, password);
                    setPassword("");
                    recheckAccount();
                  }
                });
              }}
            >
              {emailFlow === "signup" && (
                <label className="field">
                  Full name
                  <input
                    autoComplete="name"
                    maxLength={200}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                  />
                </label>
              )}
              <label className="field">
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              {emailFlow !== "link" && (
                <label className="field">
                  Password
                  <input
                    type="password"
                    aria-label="Password"
                    aria-describedby={
                      emailFlow === "signup" ? passwordHint : undefined
                    }
                    autoComplete={
                      emailFlow === "signup"
                        ? "new-password"
                        : "current-password"
                    }
                    minLength={emailFlow === "signup" ? 8 : 1}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {emailFlow === "signup" && (
                    <small id={passwordHint}>Use at least 8 characters.</small>
                  )}
                </label>
              )}
              <Button disabled={busy || !configured} type="submit">
                <Mail size={16} />
                {busy
                  ? "Connecting…"
                  : emailFlow === "link"
                    ? "Email me a sign-in link"
                    : emailFlow === "signup"
                      ? "Create account"
                      : "Sign in with email"}
              </Button>
            </form>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setEmailFlow(emailFlow === "signup" ? "signin" : "signup");
                setPassword("");
                setError("");
                setMessage("");
              }}
            >
              {emailFlow === "signup"
                ? "Already have an account? Sign in"
                : "Create an account"}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setEmailFlow(emailFlow === "link" ? "signin" : "link");
                setPassword("");
                setError("");
                setMessage("");
              }}
            >
              {emailFlow === "link"
                ? "Use a password instead"
                : "Forgot your password? Use an email link"}
            </button>
            {authError && (
              <Button variant="secondary" onClick={recheckAccount}>
                Retry connection
              </Button>
            )}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setPassword("");
                setOpen(false);
              }}
            >
              Continue as guest
            </button>
          </div>
        ) : signingOut ? (
          <div className="stack-form">
            <p className="account-note">
              Saved cloud records remain in your account. Local profiles and
              backups stay on this device. Cloud changes are saved only when a
              save succeeds; failed changes are not queued.
            </p>
            <div className="form-actions">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setSigningOut(false)}
              >
                Stay signed in
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await auth.signOut();
                    recheckAccount();
                  })
                }
              >
                {busy ? "Signing out…" : "Sign out"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="stack-form">
            {!expanded && (
              <>
                <div className="account-identity">
                  <span className="avatar avatar-large">
                    {customerInitial(identity)}
                  </span>
                  <div>
                    <strong className="identity-name" title={identity}>
                      {identity}
                    </strong>
                    <p className="account-note">
                      {mode === "cloud"
                        ? "Personal finance account"
                        : "Viewing separate browser records"}
                    </p>
                  </div>
                </div>
                <Link
                  className="button button-secondary"
                  href="/settings"
                  onClick={() => setOpen(false)}
                >
                  My Account & Settings
                </Link>
                {profiles.length > 1 && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setOpen(false);
                      setBudgetsOpen(true);
                    }}
                  >
                    Manage Budgets
                  </Button>
                )}
              </>
            )}
            {expanded && !review && (
              <>
                <div className="workspace-modes" aria-label="Storage mode">
                  {(["local", "cloud"] as const).map((m) => (
                    <button
                      key={m}
                      aria-pressed={mode === m}
                      onClick={() => switchMode(m)}
                    >
                      {m === "cloud" ? (
                        <Cloud size={17} />
                      ) : (
                        <HardDrive size={17} />
                      )}{" "}
                      {m === "cloud" ? "Cloud budgets" : "Guest storage"}
                    </button>
                  ))}
                </div>
                <p className="account-note">
                  {mode === "cloud"
                    ? "Cloud budgets belong to this account. A connection is required."
                    : "Guest Mode: these separate records stay in this browser. Signing in never uploads them."}
                </p>
              </>
            )}
            {expanded && localProfiles.length > 0 && (
              <>
                {!review && (
                  <>
                    <label className="field">
                      Import a local profile
                      <select
                        aria-label="Import a local profile"
                        value={source}
                        disabled={busy}
                        onChange={(e) => {
                          setSource(e.target.value);
                          setReview(null);
                          setDownloaded(false);
                          setConsent(false);
                        }}
                      >
                        <option value="">Choose a profile</option>
                        {localProfiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {profileDisplayName(p)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="account-note">
                      Imports create a separate cloud profile. Existing cloud
                      histories are never merged or replaced. The local original
                      is kept.
                    </p>
                  </>
                )}
                {!review && (
                  <Button
                    variant="secondary"
                    disabled={!source || busy}
                    onClick={() =>
                      run(async () => {
                        setReview(await accountMigration.review(source));
                      })
                    }
                  >
                    Review import
                  </Button>
                )}
                {review && (
                  <div className="migration-review stack-form">
                    <strong>{profileDisplayName(review.backup.profile)}</strong>
                    <p className="account-note">
                      {review.backup.plans.length} monthly plans ·{" "}
                      {review.backup.commitments.length} commitments ·{" "}
                      {review.backup.expenses.length} expenses. Revisions and
                      categories are included.
                    </p>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        downloadFile(
                          JSON.stringify(review.backup, null, 2),
                          `Spendense-local-backup-${review.backup.profile.id}.json`,
                        );
                        setDownloaded(true);
                      }}
                    >
                      <Download size={16} />
                      {downloaded
                        ? "Download backup again"
                        : "1. Download local backup"}
                    </Button>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={consent}
                        disabled={busy}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      I saved my backup and agree to upload this profile to{" "}
                      {account.email ?? "my account"}.
                    </label>
                    <Button
                      disabled={!downloaded || !consent || busy}
                      onClick={() =>
                        run(async () => {
                          const result = await accountMigration.import(
                            review.backup,
                            account.id,
                          );
                          if (!result.repeated) {
                            setOpen(false);
                            showImportResult({
                              name: profileDisplayName(result.profile),
                              plans: review.backup.plans.length,
                              commitments: review.backup.commitments.length,
                              expenses: review.backup.expenses.length,
                            });
                          }
                          if (mode === "cloud") {
                            selectProfile(result.profile.id);
                            refresh();
                          }
                          setReview(null);
                          setConsent(false);
                          setDownloaded(false);
                          setMessage(
                            result.repeated
                              ? "Already imported. No duplicate was created."
                              : "Import verified: record counts and exact monthly totals match. Your local copy is kept. Open Cloud to use it.",
                          );
                        })
                      }
                    >
                      {busy
                        ? "Importing & verifying…"
                        : "2. Import separate cloud profile"}
                    </Button>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        setReview(null);
                        setDownloaded(false);
                        setConsent(false);
                      }}
                    >
                      Choose another profile
                    </button>
                  </div>
                )}
              </>
            )}
            {!review &&
              (changingPassword ? (
                <form
                  className="stack-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await auth.updatePassword(password);
                      setPassword("");
                      setChangingPassword(false);
                      setMessage("Password updated.");
                    });
                  }}
                >
                  <label className="field">
                    New password
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                  <Button type="submit" disabled={busy}>
                    Save password
                  </Button>
                </form>
              ) : (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setChangingPassword(true)}
                >
                  Change password
                </button>
              ))}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setSigningOut(true)}
            >
              Sign out
            </button>
          </div>
        )}
      </Dialog>
    </>
  );
}
