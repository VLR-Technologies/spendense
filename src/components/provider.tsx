"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  localAuth,
  repository as localRepository,
} from "@/lib/repositories/local";
import { CustomerRepository } from "@/lib/repositories/customer";
import type { CustomerPreferences } from "@/lib/customer-income";
import { CloudRepository } from "@/lib/repositories/cloud";
import type { DaywiseRepository } from "@/lib/repositories/contracts";
import { auth, type Account } from "@/lib/auth";
import { browserClient } from "@/lib/supabase/browser";
import type { MonthData, Profile, Category } from "@/types";
import type { Backup } from "@/lib/validation";
import { thisMonth } from "@/lib/dates";
import { Check, AlertCircle, X } from "lucide-react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { appMode, financialOperationsEnabled } from "@/lib/deployment";
import { DeploymentNotice } from "./deployment-notice";
type Mode = "local" | "cloud";
type ImportResult = {
  name: string;
  plans: number;
  commitments: number;
  expenses: number;
};
type AppContextValue = {
  customerPreferences: CustomerPreferences | null;
  customerStatus: "loading" | "ready" | "error";
  customerError: string;
  refreshCustomer: () => void;
  setCustomerPreferences: (
    value: CustomerPreferences,
    completedBudgetId?: string,
  ) => void;
  profiles: Profile[];
  localProfiles: Profile[];
  profile: Profile | null;
  profileId: string | null;
  month: string;
  setMonth: (m: string) => void;
  data: MonthData | null;
  ready: boolean;
  error: string;
  refresh: () => void;
  selectProfile: (id: string) => void;
  notify: (message: string, error?: boolean) => void;
  act: (action: () => Promise<unknown>, success?: string) => Promise<boolean>;
  repository: DaywiseRepository;
  mode: Mode;
  account: Account | null;
  switchMode: (mode: Mode) => void;
  recheckAccount: () => void;
  authError: string;
  guestName: string;
  setGuestName: (name: string) => void;
  categories: Category[];
  history: Backup | null;
  showImportResult: (result: ImportResult) => void;
};
const Context = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  // Do not mount hooks, open IndexedDB, or verify a session while locked.
  if (!financialOperationsEnabled())
    return <DeploymentNotice mode={appMode()} />;
  return <ActiveAppProvider>{children}</ActiveAppProvider>;
}
function ActiveAppProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [mode, setMode] = useState<Mode>("local");
  const generation = useRef(0);
  const recheckAccount = useCallback((quiet = false) => {
    const check = ++generation.current;
    if (!quiet) setChecking(true);
    auth
      .current()
      .then((user) => {
        if (check !== generation.current) return;
        setAccount(user);
        setAuthError("");
        let preferred: Mode = user ? "cloud" : "local";
        try {
          if (
            user &&
            sessionStorage.getItem(`daywise-mode:${user.id}`) === "local"
          )
            preferred = "local";
        } catch {}
        setMode(preferred);
        setChecking(false);
      })
      .catch((e) => {
        if (check !== generation.current) return;
        setAccount(null);
        setMode("local");
        setAuthError(e.message);
        setChecking(false);
      });
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) recheckAccount();
    });
    const unsubscribe = auth.subscribe((event) => {
      if (active)
        recheckAccount(event === "USER_UPDATED" || event === "TOKEN_REFRESHED");
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [recheckAccount]);
  const switchMode = useCallback(
    (next: Mode) => {
      if (next === "cloud" && !account) return;
      if (account)
        try {
          sessionStorage.setItem(`daywise-mode:${account.id}`, next);
        } catch {}
      setMode(next);
    },
    [account],
  );
  // Unmount all financial views and pending requests on identity/mode transitions.
  if (checking)
    return (
      <div className="app-loading">
        <strong>Spendense.</strong>
        <span>Opening your workspace…</span>
      </div>
    );
  if (authError)
    return (
      <main className="app-loading" id="main-content">
        <strong>Spendense.</strong>
        <h1>Unable to verify your account</h1>
        <p role="alert">{authError}</p>
        <Button onClick={() => recheckAccount()}>Retry connection</Button>
      </main>
    );
  return (
    <WorkspaceProvider
      key={`${account?.id ?? "guest"}:${mode}`}
      {...{ account, mode, switchMode, recheckAccount, authError }}
    >
      {children}
    </WorkspaceProvider>
  );
}
function WorkspaceProvider({
  children,
  account,
  mode,
  switchMode,
  recheckAccount,
  authError,
}: {
  children: ReactNode;
  account: Account | null;
  mode: Mode;
  switchMode: (mode: Mode) => void;
  recheckAccount: () => void;
  authError: string;
}) {
  const [customerPreferences, updateCustomerPreferences] =
    useState<CustomerPreferences | null>(null);
  const customerGeneration = useRef(0);
  const [customerStatus, setCustomerStatus] = useState<
    "loading" | "ready" | "error"
  >(account && mode === "cloud" ? "loading" : "ready");
  const [customerError, setCustomerError] = useState("");
  const [customerRevision, setCustomerRevision] = useState(0);
  const refreshCustomer = useCallback(
    () => setCustomerRevision((r) => r + 1),
    [],
  );
  const customerOwner = mode === "cloud" ? account?.id : undefined;
  useEffect(() => {
    if (!customerOwner) return;
    let cancelled = false;
    const generation = ++customerGeneration.current;
    const client = browserClient();
    if (!client) return;
    new CustomerRepository(client, customerOwner)
      .load()
      .then((value) => {
        if (!cancelled && generation === customerGeneration.current) {
          updateCustomerPreferences(value);
          setCustomerStatus("ready");
          setCustomerError("");
        }
      })
      .catch((e) => {
        if (!cancelled && generation === customerGeneration.current) {
          setCustomerStatus("error");
          setCustomerError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [customerOwner, customerRevision]);
  const [guestName, updateGuestName] = useState("");
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        updateGuestName(localStorage.getItem("daywise-guest-name") ?? "");
      } catch {}
    });
  }, []);
  const setGuestName = (name: string) => {
    const value = name.trim().slice(0, 200);
    try {
      localStorage.setItem("daywise-guest-name", value);
    } catch {}
    updateGuestName(value);
  };
  const localProfiles = useLiveQuery(
    () => db.profiles.toArray().catch(() => []),
    [],
    [],
  );
  const repository = useMemo<DaywiseRepository>(() => {
    const client = mode === "cloud" ? browserClient() : null;
    if (mode === "cloud") {
      if (!client || !account)
        throw new Error("Cloud authentication is unavailable. Retry sign-in.");
      return new CloudRepository(client, account.id);
    }
    return localRepository;
  }, [mode, account]);
  const [cloudProfiles, setCloudProfiles] = useState<Profile[]>([]);
  const setCustomerPreferences = useCallback(
    (value: CustomerPreferences, completedBudgetId?: string) => {
      customerGeneration.current += 1;
      updateCustomerPreferences(value);
      setCustomerStatus("ready");
      setCustomerError("");
      // The RPC already committed this flag. Reflect it before rendering the dashboard.
      if (completedBudgetId)
        setCloudProfiles((list) =>
          list.map((budget) =>
            budget.id === completedBudgetId
              ? { ...budget, onboardingComplete: true }
              : budget,
          ),
        );
    },
    [],
  );
  const profiles = mode === "local" ? localProfiles : cloudProfiles;
  const [profileId, setProfileId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState<MonthData | null>(null);
  const [history, setHistory] = useState<Backup | null>(null);
  const [importResult, showImportResult] = useState<ImportResult | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const profile = profiles.find((p) => p.id === profileId) ?? null;
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (mode === "local") {
          await db.open();
          if (!cancelled) {
            try {
              setProfileId(localAuth.currentLocalProfile());
            } catch {
              /* IndexedDB stays primary. */
            }
            setReady(true);
          }
        } else {
          const list = await repository.profiles();
          if (cancelled) return;
          setCloudProfiles(list);
          let remembered: string | null = null;
          try {
            remembered = sessionStorage.getItem(
              `daywise-cloud-budget:${account?.id}`,
            );
          } catch {}
          setProfileId((current) => {
            const selected = current ?? remembered;
            // A remembered ID is a preference, never authorization. Only this owner's list is eligible.
            return list.some((p) => p.id === selected)
              ? selected
              : (list[0]?.id ?? null);
          });
          setReady(true);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            mode === "local"
              ? "Browser storage is unavailable. Allow local storage and reload to use Spendense."
              : e instanceof Error
                ? e.message
                : "Storage unavailable. Retry to open your workspace.",
          );
          setReady(true);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, repository, revision, account?.id]);
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    repository
      .getMonth(profileId, month)
      .then(async (value) => {
        const backup = await repository.exportProfile(profileId);
        if (!cancelled) {
          setData(value);
          setHistory(backup);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setData(null);
          setHistory(null);
          setError(
            e instanceof Error ? e.message : "Unable to load records. Retry.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, month, revision, repository]);
  useEffect(() => {
    if (!profile) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        profile.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : profile.theme;
      try {
        localStorage.setItem("daywise-theme", profile.theme);
      } catch {}
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [profile]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const notify = useCallback(
    (message: string, isError = false) => setToast({ message, error: isError }),
    [],
  );
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    if (mode !== "cloud") return;
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [mode, refresh]);
  const selectProfile = useCallback(
    (id: string) => {
      setData(null);
      setHistory(null);
      setProfileId(id);
      setMonth(thisMonth());
      if (mode === "local")
        try {
          localAuth.selectLocalProfile(id);
        } catch {
          notify(
            "Profile open; this browser could not remember the selection.",
            true,
          );
        }
      else if (account)
        try {
          sessionStorage.setItem(`daywise-cloud-budget:${account.id}`, id);
        } catch {}
    },
    [mode, notify, account],
  );
  const act = useCallback(
    async (action: () => Promise<unknown>, success?: string) => {
      try {
        await action();
        refresh();
        if (success) notify(success);
        return true;
      } catch (e) {
        notify(
          e instanceof Error
            ? e.message.includes("[")
              ? "Check the form: enter valid names, dates and amounts."
              : e.message
            : "Could not save. Check your connection or storage and retry.",
          true,
        );
        return false;
      }
    },
    [notify, refresh],
  );
  const visibleData =
    data?.plan.profileId === profileId && data.plan.yearMonth === month
      ? data
      : null;
  const visibleHistory = history?.profile.id === profileId ? history : null;
  return (
    <Context.Provider
      value={{
        customerPreferences,
        customerStatus,
        customerError,
        refreshCustomer,
        setCustomerPreferences,
        profiles,
        localProfiles,
        profile,
        profileId,
        month,
        setMonth,
        data: visibleData,
        history: visibleHistory,
        showImportResult,
        categories: visibleHistory?.categories ?? [],
        ready,
        error,
        refresh,
        selectProfile,
        notify,
        act,
        repository,
        mode,
        account,
        switchMode,
        recheckAccount,
        authError,
        guestName,
        setGuestName,
      }}
    >
      {children}
      <Dialog
        open={!!importResult}
        onClose={() => showImportResult(null)}
        title="Import verified"
        description="Record counts and exact monthly totals match."
      >
        {importResult && (
          <div className="stack-form">
            <strong>{importResult.name}</strong>
            <p className="account-note">
              {importResult.plans} monthly plans · {importResult.commitments}{" "}
              commitments · {importResult.expenses} expenses. Revisions and
              categories are preserved.
            </p>
            <p className="account-note">
              Your separate cloud profile is ready. The original local profile
              and your downloaded backup are kept.
            </p>
            <Button
              onClick={() => {
                showImportResult(null);
                if (mode === "local") switchMode("cloud");
              }}
            >
              Done
            </Button>
          </div>
        )}
      </Dialog>
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useApp() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("AppProvider is missing");
  return ctx;
}
