"use client";
import { customerName } from "@/lib/identity";
import { repository as localRepository } from "@/lib/repositories/local";
import { CloudRepository } from "@/lib/repositories/cloud";
import { profileDisplayName } from "@/lib/branding";
import { Logo } from "./logo";
import {
  CustomerOnboarding,
  PersonalIncomeDetails,
} from "./customer-onboarding";
import { AccountControls } from "./account";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, MotionConfig } from "motion/react";
import {
  LayoutDashboard,
  CalendarDays,
  SlidersHorizontal,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Search,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Wallet,
  LockKeyhole,
} from "lucide-react";
import { useApp } from "./provider";
import { IncomeForm, CommitmentForm, ExpenseForm } from "./forms";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { monthLabel, shiftMonth, thisMonth } from "@/lib/dates";
import { money, summarize } from "@/lib/finance";
const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/monthly-plan", label: "Monthly plan", icon: SlidersHorizontal },
  { href: "/expenses", label: "Expenses", icon: ArrowLeftRight },
  { href: "/insights", label: "Insights", icon: ChartNoAxesCombined },
];
function Welcome() {
  const {
    repository,
    mode,
    account,
    act,
    selectProfile,
    guestName,
    customerError,
    refreshCustomer,
  } = useApp();
  const [busy, setBusy] = useState(false);
  const starting = useRef(false);
  async function start() {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    await act(async () => {
      const budget =
        mode === "cloud" && repository instanceof CloudRepository
          ? await repository.openPersonalBudget()
          : await localRepository.openGuestBudget();
      selectProfile(budget.id);
    });
    starting.current = false;
    setBusy(false);
  }
  return (
    <div className="welcome">
      <header>
        <Logo />
        {account ? <AccountControls /> : null}
      </header>
      <main id="main-content" className="welcome-main">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          className="welcome-copy"
        >
          <h1>
            {account ? (
              <>
                Welcome, <span>{customerName(account, guestName)}</span>
              </>
            ) : (
              <>
                A clearer view of
                <br />
                <span>your money.</span>
              </>
            )}
          </h1>
          <p>
            Plan your month. Understand your daily budget. Keep every expense in
            view.
          </p>
          {account && customerError && (
            <div className="error-banner" role="alert">
              {customerError}
              <Button variant="secondary" onClick={refreshCustomer}>
                Retry personal details
              </Button>
            </div>
          )}
          {!account && <AccountControls landing />}
          <div className="welcome-actions">
            <Button
              disabled={busy}
              variant={account ? "default" : "secondary"}
              onClick={() => start()}
            >
              {account ? "Create budget" : "Continue as guest"}
              <ArrowRight size={18} />
            </Button>
          </div>
          <div className="welcome-trust">
            <span>
              <ShieldCheck size={16} /> No bank connection required
            </span>
            <span>
              <LockKeyhole size={16} /> Guest records stay on this device
            </span>
          </div>
        </motion.div>
        <div
          className="welcome-visual"
          aria-label="Spendense sample budget preview"
        >
          <div className="preview-card">
            <div className="preview-card-top">
              <span className="hero-icon">
                <Wallet size={22} />
              </span>
              <span>Daily Budget</span>
              <span className="soft-tag">Sample</span>
            </div>
            <p>Available per day</p>
            <strong>
              ₹2,700<span>.00</span>
            </strong>
            <div className="sample-tag">
              Illustrative example · 30-day month
            </div>
            <div className="preview-line" />
            <div className="preview-row">
              <span>Monthly income allocation</span>
              <b>₹1,00,000</b>
            </div>
            <div className="preview-row">
              <span>Fixed commitments</span>
              <b>₹19,000</b>
            </div>
            <div className="preview-row">
              <span>Daily expenses</span>
              <b>₹500</b>
            </div>
            <div className="preview-remaining">
              <span>Remaining Today</span>
              <strong>
                ₹2,200 <ArrowUpRight size={17} />
              </strong>
            </div>
            <p className="sample-disclaimer">
              Budget allocation, not a bank balance.
            </p>
          </div>
        </div>
      </main>
      <footer>
        <span>
          Guest data stays in this browser. Export backups to keep it safe.
        </span>
      </footer>
    </div>
  );
}
function Onboarding() {
  const { repository, profile, data, act } = useApp();
  const [step, setStep] = useState(1);
  const [addBill, setAddBill] = useState(false);
  const router = useRouter();
  if (!profile || profile.onboardingComplete || !data) return null;
  async function finish(calendar = false) {
    if (
      profile &&
      (await act(() =>
        repository.updateProfile(profile.id, { onboardingComplete: true }),
      ))
    ) {
      if (calendar) router.push("/calendar");
    }
  }
  return (
    <>
      <Dialog
        open
        title={
          step === 1
            ? "Set your monthly income"
            : step === 2
              ? "Add fixed commitments"
              : "Review your daily budget"
        }
        description={`Budget setup · Step ${step} of 3`}
        onClose={() => finish()}
      >
        <div className="onboarding-progress">
          {[1, 2, 3].map((s) => (
            <span key={s} className={step >= s ? "done" : ""} />
          ))}
        </div>
        {step === 1 ? (
          <IncomeForm onboarding onDone={() => setStep(2)} />
        ) : step === 2 ? (
          <div className="stack-form">
            <p className="muted">
              Add only the bills you actually pay. We’ll spread them across the
              month.
            </p>
            {data.commitments.map((c) => (
              <div className="simple-row" key={c.id}>
                <span>{c.name}</span>
                <strong>{money(c.amountMinor)}</strong>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setAddBill(true)}>
              <Plus size={16} />
              Add a monthly commitment
            </Button>
            <Button onClick={() => setStep(3)}>
              See my daily allowance
              <ArrowRight size={16} />
            </Button>
          </div>
        ) : (
          <div className="onboarding-finish">
            <span className="finish-icon">
              <Sparkles size={30} />
            </span>
            <p>Your daily spending allowance</p>
            <strong>{money(summarize(data).averageAllowance, true)}</strong>
            <p className="muted">
              Monthly income allocation minus commitments, divided across the
              month.
            </p>
            <Button onClick={() => finish(true)}>
              Open my calendar
              <ArrowRight size={16} />
            </Button>
          </div>
        )}
        <button
          className="onboarding-skip text-button"
          onClick={() => finish()}
        >
          Skip setup for now
        </button>
      </Dialog>
      <Dialog
        open={addBill}
        title="Add a monthly commitment"
        onClose={() => setAddBill(false)}
      >
        <CommitmentForm onDone={() => setAddBill(false)} />
      </Dialog>
    </>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const {
    repository,
    account,
    customerPreferences,
    customerStatus,
    customerError,
    refreshCustomer,
    mode,
    switchMode,
    refresh,
    ready,
    profile,
    profileId,
    error,
    month,
    setMonth,
    act,
  } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  if (!ready)
    return (
      <div className="app-loading">
        <Logo />
        <span className="loading-dots">Loading your budget…</span>
      </div>
    );
  if (error && !profile)
    return (
      <div className="app-loading">
        <Logo />
        <p role="alert">{error}</p>
        <Button onClick={refresh}>Try again</Button>
        {mode === "cloud" && (
          <Button variant="secondary" onClick={() => switchMode("local")}>
            Open guest storage
          </Button>
        )}
        <AccountControls />
      </div>
    );
  if (account && mode === "cloud" && customerStatus === "loading")
    return (
      <div className="app-loading">
        <Logo />
        <span>Loading personal details…</span>
      </div>
    );
  if (
    account &&
    mode === "cloud" &&
    customerStatus === "ready" &&
    !customerPreferences
  )
    return <CustomerOnboarding />;
  if (!profileId && path === "/settings")
    return (
      <div className="welcome">
        <header>
          <Logo />
          <AccountControls />
        </header>
        <main id="main-content" className="empty-account-settings">
          <h1>Account Settings</h1>
          <AccountControls expanded />
          <PersonalIncomeDetails />
          <Button asChild variant="secondary">
            <Link href="/dashboard">Back to budgets</Link>
          </Button>
        </main>
      </div>
    );
  if (!profileId)
    return (
      <MotionConfig reducedMotion="user">
        <Welcome />
      </MotionConfig>
    );
  if (!profile)
    return (
      <div className="app-loading">
        <Logo />
        <p>Opening your budget…</p>
        <Button
          variant="secondary"
          onClick={() => {
            localStorage.removeItem("daywise-profile");
            location.reload();
          }}
        >
          Back to welcome
        </Button>
      </div>
    );
  return (
    <MotionConfig reducedMotion="user">
      <div className={`app-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
        <aside className="sidebar">
          <Link href="/dashboard" aria-label="Spendense home">
            <Logo compact={collapsed} />
          </Link>
          <nav aria-label="Main navigation">
            {navigation.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-item ${path === n.href || (path === "/" && n.href === "/dashboard") ? "active" : ""}`}
                title={collapsed ? n.label : undefined}
                aria-current={
                  path === n.href || (path === "/" && n.href === "/dashboard")
                    ? "page"
                    : undefined
                }
              >
                <n.icon size={19} />
                <span>{n.label}</span>
                {n.label === "Calendar" && <span className="nav-dot" />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <Link
              href="/settings"
              className={`nav-item ${path === "/settings" ? "active" : ""}`}
              aria-current={path === "/settings" ? "page" : undefined}
            >
              <Settings size={19} />
              <span>Settings</span>
            </Link>
            <div className="theme-control" aria-label="Color theme">
              {[
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: Monitor, label: "System" },
              ].map((t) => (
                <button
                  key={t.value}
                  className={profile.theme === t.value ? "active" : ""}
                  aria-label={`${t.label} theme`}
                  aria-pressed={profile.theme === t.value}
                  onClick={() =>
                    act(() =>
                      repository.updateProfile(profile.id, {
                        theme: t.value as "light" | "dark" | "system",
                      }),
                    )
                  }
                >
                  <t.icon size={16} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <div className="sidebar-budget">
              <Wallet size={18} />
              <span>
                <strong title={profileDisplayName(profile)}>
                  {profileDisplayName(profile)}
                </strong>
                <small>
                  {profile.demo
                    ? "Demo budget"
                    : mode === "cloud"
                      ? "Account budget"
                      : "Guest budget · this device"}
                </small>
              </span>
            </div>
          </div>
          <button
            className="collapse-button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronsRight size={15} />
            ) : (
              <ChevronsLeft size={15} />
            )}
          </button>
        </aside>
        <div className="main-wrap">
          <header className="topbar">
            <Link
              className="mobile-brand"
              href="/dashboard"
              aria-label="Spendense home"
            >
              <Logo />
            </Link>
            <div className="breadcrumb">
              <strong>
                {navigation.find((n) => path === n.href)?.label ??
                  (path === "/settings" ? "Settings" : "Dashboard")}
              </strong>
            </div>
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/expenses?q=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="Search this month's expenses"
                placeholder="Search this month’s expenses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </form>
            <div className="topbar-right">
              {mode === "local" && !profile.demo && (
                <span className="local-badge">Guest Mode</span>
              )}
              <AccountControls />
            </div>
          </header>
          <main id="main-content" className="main-content">
            {customerError && mode === "cloud" && (
              <div className="error-banner" role="alert">
                {customerError}
                <Button variant="secondary" size="sm" onClick={refreshCustomer}>
                  Retry personal details
                </Button>
              </div>
            )}
            {error && (
              <div className="error-banner" role="alert">
                {error}{" "}
                <Button size="sm" variant="secondary" onClick={refresh}>
                  Retry
                </Button>
              </div>
            )}
            <div className="page-toolbar">
              <div className="month-switcher">
                <button
                  className="icon-button"
                  aria-label="Previous month"
                  disabled={month <= "1900-01"}
                  onClick={() => setMonth(shiftMonth(month, -1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <label className="month-input-label">
                  <CalendarDays size={15} />
                  <span aria-live="polite">{monthLabel(month)}</span>
                  <input
                    aria-label="Select month"
                    type="month"
                    min="1900-01"
                    max="2200-12"
                    value={month}
                    onChange={(e) => {
                      if (
                        /^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value) &&
                        e.target.value >= "1900-01" &&
                        e.target.value <= "2200-12"
                      )
                        setMonth(e.target.value);
                    }}
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label="Next month"
                  disabled={month >= "2200-12"}
                  onClick={() => setMonth(shiftMonth(month, 1))}
                >
                  <ChevronRight size={16} />
                </button>
                {month !== thisMonth() && (
                  <button
                    className="this-month"
                    onClick={() => setMonth(thisMonth())}
                  >
                    This month
                  </button>
                )}
              </div>
              <Button size="sm" onClick={() => setExpenseOpen(true)}>
                <Plus size={16} />
                Add expense
              </Button>
            </div>
            {error ? (
              <p className="account-note">
                Your records are unavailable. Retry to continue.
              </p>
            ) : (
              children
            )}
            <footer className="app-footer">
              <span className="footer-logo">Spendense.</span>
              <span>
                <LockKeyhole size={14} />
                {mode === "cloud"
                  ? "Account budget"
                  : profile.demo
                    ? "Demo · sample data"
                    : "Guest Mode · saved on this device"}
              </span>
            </footer>
          </main>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {[
            ...navigation.slice(0, 2),
            { href: "/monthly-plan", label: "Plan", icon: SlidersHorizontal },
            navigation[3],
            { href: "/insights", label: "Insights", icon: ChartNoAxesCombined },
            { href: "/settings", label: "Settings", icon: Settings },
          ].map((n) => (
            <Link
              href={n.href}
              key={n.href}
              className={
                path === n.href || (path === "/" && n.href === "/dashboard")
                  ? "active"
                  : ""
              }
              aria-current={
                path === n.href || (path === "/" && n.href === "/dashboard")
                  ? "page"
                  : undefined
              }
            >
              <n.icon size={20} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
      </div>
      <Dialog
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Add a daily expense"
      >
        <ExpenseForm onDone={() => setExpenseOpen(false)} />
      </Dialog>
      <Onboarding key={profile.id} />
    </MotionConfig>
  );
}
