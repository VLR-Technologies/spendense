"use client";
import { profileDisplayName } from "@/lib/branding";
import { useRef, useState } from "react";
import {
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  ShieldCheck,
  LockKeyhole,
  UserRound,
  Plus,
  RotateCcw,
  Trash2,
  Check,
  Database,
  Info,
} from "lucide-react";
import { PersonalIncomeDetails } from "./customer-onboarding";
import { AccountControls } from "./account";
import { useApp } from "./provider";
import { type Backup } from "@/lib/validation";
import { validateBackup } from "@/lib/backup";
import { downloadFile } from "@/lib/download";
import { today } from "@/lib/dates";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { ProfileDialog } from "./forms";
import type { Theme } from "@/types";
export function SettingsPage() {
  const {
    repository,
    mode,
    account,
    showImportResult,
    profile,
    profiles,
    act,
    selectProfile,
    notify,
  } = useApp();
  const [name, setName] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "reset" | null>(null);
  const [busy, setBusy] = useState(false);
  const [cloudBackupSaved, setCloudBackupSaved] = useState(false);
  const [cloudImportConsent, setCloudImportConsent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!profile) return null;
  const exists =
    mode === "local" &&
    backup &&
    profiles.some((p) => p.id === backup.profile.id);
  async function readBackup(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      notify("This backup is too large. Maximum file size is 20 MB.", true);
      return;
    }
    try {
      setBackup(validateBackup(JSON.parse(await file.text())));
      setCloudBackupSaved(false);
      setCloudImportConsent(false);
    } catch {
      notify(
        "That file isn’t a valid Spendense v1 backup. Nothing was changed.",
        true,
      );
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
          <p>Account, budgets, and data preferences.</p>
        </div>
      </div>
      <div className="settings-layout">
        <div className="settings-main">
          <AccountControls expanded />
          <PersonalIncomeDetails />
          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <UserRound size={18} />
                  {mode === "cloud"
                    ? "Cloud budget"
                    : profile.demo
                      ? "Demo budget"
                      : "Guest budget"}
                </h2>
                <p>
                  {mode === "cloud"
                    ? "Budget names organize financial records separately from your customer identity."
                    : "This budget is stored in your browser and is separate from a registered account."}
                </p>
              </div>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await act(
                    () =>
                      repository.updateProfile(profile.id, {
                        displayName: name ?? profile.displayName,
                      }),
                    "Budget name saved",
                  )
                )
                  setName(null);
              }}
            >
              <div className="profile-edit">
                <span className="avatar avatar-large">
                  {profileDisplayName(profile)[0]}
                </span>
                <label className="field">
                  Budget name
                  <input
                    value={name ?? profileDisplayName(profile)}
                    maxLength={50}
                    required
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <Button type="submit" variant="secondary" size="sm">
                  Save name
                </Button>
              </div>
            </form>
            <div className="setting-row">
              <div>
                <strong>Budget management</strong>
                <p>Keep personal, student, and family budgets separate.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setProfileOpen(true)}
              >
                <Plus size={15} />
                Manage Budgets
              </Button>
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <Sun size={18} />
                  Appearance
                </h2>
                <p>Choose light, dark, or your system theme.</p>
              </div>
            </div>
            <div className="theme-options">
              {[
                { value: "light", name: "Light", icon: Sun },
                { value: "dark", name: "Dark", icon: Moon },
                { value: "system", name: "System", icon: Monitor },
              ].map((t) => (
                <button
                  key={t.value}
                  className={`theme-option ${t.value} ${profile.theme === t.value ? "selected" : ""}`}
                  aria-pressed={profile.theme === t.value}
                  onClick={() =>
                    act(
                      () =>
                        repository.updateProfile(profile.id, {
                          theme: t.value as Theme,
                        }),
                      `${t.name} theme selected`,
                    )
                  }
                >
                  <div className="theme-preview">
                    <span />
                    <div>
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                  <span>
                    <t.icon size={15} />
                    {t.name}
                    {profile.theme === t.value && <Check size={14} />}
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <Database size={18} />
                  Backup & restore
                </h2>
                <p>Export a copy of your financial records.</p>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <strong>Export this profile</strong>
                <p>
                  Download all income, plans, expenses, and settings as JSON.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  act(
                    async () =>
                      downloadFile(
                        JSON.stringify(
                          await repository.exportProfile(profile.id),
                          null,
                          2,
                        ),
                        `Spendense-${profileDisplayName(profile)
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, "-")}-${today()}.json`,
                      ),
                    "Backup downloaded",
                  )
                }
              >
                <Download size={15} />
                Export backup
              </Button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Restore a profile</strong>
                <p>
                  Import a Spendense backup. We’ll check it before changing
                  anything.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={15} />
                Import backup
              </Button>
              <input
                className="sr-only"
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                aria-label="Import backup file"
                onChange={(e) => readBackup(e.target.files?.[0])}
              />
            </div>
          </section>
          {profile.demo && mode === "local" && (
            <section className="panel settings-panel">
              <div className="setting-row">
                <div>
                  <strong>Demo data</strong>
                  <p>Reset this demo profile to its original sample data.</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirm("reset")}
                >
                  <RotateCcw size={15} />
                  Reset demo
                </Button>
              </div>
            </section>
          )}
          <section className="panel settings-panel danger-panel">
            <div className="setting-row">
              <div>
                <strong>
                  {mode === "cloud"
                    ? "Delete this cloud budget"
                    : "Delete this guest budget"}
                </strong>
                <p>
                  Permanently remove this budget and its financial records from{" "}
                  {mode === "cloud" ? "your cloud account." : "this browser."}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirm("delete")}
              >
                <Trash2 size={14} />
                Delete budget
              </Button>
            </div>
          </section>
        </div>
        <aside className="settings-aside">
          <div className="privacy-feature">
            <span>
              <ShieldCheck size={30} />
            </span>
            <h2>Data & privacy</h2>
            <p>
              {mode === "cloud"
                ? "Your financial records are stored in your Supabase account. A connection is required to load and save changes."
                : "Local mode works in your browser. Financial records are uploaded only if you explicitly import them into Cloud."}
            </p>
            <div>
              <LockKeyhole size={16} />
              <strong>Guest data protection</strong>
            </div>
            <p>
              Local profiles help organize your budgets. They are not
              password-protected accounts. Anyone with access to this browser
              can view them.
            </p>
            <div>
              <Info size={16} />
              <strong>Browser storage</strong>
            </div>
            <p>
              Clearing browser data can remove your financial records. Private
              browsing may not keep them. Export backups regularly.
            </p>
          </div>
          <p className="settings-version">Spendense · VERSION 1.0</p>
        </aside>
      </div>
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      <Dialog
        open={!!backup}
        onClose={() => setBackup(null)}
        title={exists ? "Replace an existing profile?" : "Import this budget?"}
        description="We’ve checked the backup’s format. Review it before importing."
      >
        {backup && (
          <>
            <div className="backup-summary">
              <strong>{profileDisplayName(backup.profile)}</strong>
              <span>
                {backup.expenses.length} expenses · {backup.plans.length}{" "}
                monthly plans
              </span>
              <span>
                Exported {new Date(backup.exportedAt).toLocaleDateString()}
              </span>
            </div>
            <p className="confirm-copy">
              {exists
                ? "This profile already exists in your browser. Restoring will replace all of its current data with this backup. Export a fresh copy first if you want to keep it."
                : mode === "cloud"
                  ? `Upload a separate cloud profile to ${account?.email ?? "your account"}. Existing cloud histories will not be merged or replaced.`
                  : "This profile will be added as a separate local workspace. Your other profiles stay separate."}
            </p>
            {mode === "cloud" && (
              <div className="stack-form">
                <Button
                  variant="secondary"
                  onClick={() => {
                    downloadFile(
                      JSON.stringify(backup, null, 2),
                      `Spendense-before-import-${backup.profile.id}.json`,
                    );
                    setCloudBackupSaved(true);
                  }}
                >
                  <Download size={15} />
                  Download import backup
                </Button>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={cloudImportConsent}
                    onChange={(e) => setCloudImportConsent(e.target.checked)}
                  />
                  I saved a backup and consent to uploading this separate
                  profile to my cloud account.
                </label>
              </div>
            )}
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setBackup(null)}>
                Cancel
              </Button>
              <Button
                disabled={
                  busy ||
                  (mode === "cloud" &&
                    (!cloudBackupSaved || !cloudImportConsent))
                }
                variant={exists ? "danger" : "default"}
                onClick={async () => {
                  setBusy(true);
                  if (
                    await act(async () => {
                      const p = await repository.importProfile(
                        backup,
                        !!exists,
                      );
                      selectProfile(p.id);
                      if (mode === "cloud")
                        showImportResult({
                          name: profileDisplayName(p),
                          plans: backup.plans.length,
                          commitments: backup.commitments.length,
                          expenses: backup.expenses.length,
                        });
                    }, "Profile restored")
                  )
                    setBackup(null);
                  setBusy(false);
                }}
              >
                {busy
                  ? "Restoring…"
                  : exists
                    ? "Replace & restore profile"
                    : "Import profile"}
              </Button>
            </div>
          </>
        )}
      </Dialog>
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={
          confirm === "reset"
            ? "Start the demo fresh?"
            : "Delete this budget permanently?"
        }
        description={
          confirm === "reset"
            ? "All changes to this demo profile will be replaced by sample data."
            : "This removes all records for this profile. Export a backup first if you want to keep them."
        }
      >
        <p className="confirm-copy">{profileDisplayName(profile)}</p>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await act(
                async () => {
                  if (confirm === "reset")
                    await repository.resetDemo(profile.id);
                  else {
                    await repository.deleteProfile(profile.id);
                    const next = profiles.find((p) => p.id !== profile.id);
                    if (next) selectProfile(next.id);
                    else if (mode === "local") {
                      localStorage.removeItem("daywise-profile");
                      location.reload();
                    }
                  }
                },
                confirm === "reset" ? "Demo reset" : "Profile deleted",
              );
              if (ok) setConfirm(null);
              setBusy(false);
            }}
          >
            {busy
              ? "Working…"
              : confirm === "reset"
                ? "Reset demo data"
                : "Delete permanently"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
