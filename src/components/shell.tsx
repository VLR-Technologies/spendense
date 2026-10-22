"use client";
import { profileDisplayName } from "@/lib/branding";
import { Logo } from "./logo";
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
  ChevronDown,
  Plus,
  Search,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Check,
  Wallet,
  Leaf,
  LockKeyhole,
} from "lucide-react";
import { useApp } from "./provider";
import {
  ProfileDialog,
  IncomeForm,
  CommitmentForm,
  ExpenseForm,
} from "./forms";
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
  const { repository, mode, act, selectProfile, profiles } = useApp();
  const [nameMode, setNameMode] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function start(demo = false, displayName = "Personal") {
    setBusy(true);
    await act(async () => {
      const existing = demo ? profiles.find((p) => p.demo) : undefined;
      const p =
        existing ??
        (await repository.createProfile(
          demo ? "Spendense demo" : displayName,
          demo,
        ));
      selectProfile(p.id);
    });
    setBusy(false);
  }
  return (
    <div className="welcome">
      <header>
        <Logo />
        <span>
          <AccountControls />
        </span>
      </header>
      <main id="main-content" className="welcome-main">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="welcome-copy"
        >
          <span className="pill">
            <span className="status-dot" /> A LITTLE MORE CLARITY. EVERY DAY.
          </span>
          <h1>
            Make every
            <br />
            day <span>count.</span>
          </h1>
          <p>
            Your income. Your commitments. Your everyday.
            <br />
            Meet the daily budget that puts it all in perspective.
          </p>
          <div className="welcome-actions">
            <Button disabled={busy} onClick={() => start()} size="default">
              {mode === "cloud" ? "Create cloud profile" : "Continue as guest"}
              <ArrowRight size={18} />
            </Button>
            <Button
              disabled={busy || mode === "cloud"}
              variant="secondary"
              onClick={() => start(true)}
            >
              Try the demo
              <ArrowUpRight size={17} />
            </Button>
          </div>
          <button className="text-button" onClick={() => setNameMode(true)}>
            {mode === "cloud"
              ? "Or name your cloud profile"
              : "Or create a named local profile"}{" "}
            <ArrowRight size={14} />
          </button>
          <div className="welcome-trust">
            <span>
              <Check size={14} />{" "}
              {mode === "cloud" ? "Your cloud account" : "No sign-up"}
            </span>
            <span>
              <Check size={14} /> No bank connection
            </span>
            <span>
              <Check size={14} /> Just you
            </span>
          </div>
        </motion.div>
        <div
          className="welcome-visual"
          aria-label="Spendense sample budget preview"
        >
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="preview-card">
            <div className="preview-card-top">
              <span className="hero-icon">
                <Wallet size={22} />
              </span>
              <span>YOUR EVERYDAY, REIMAGINED</span>
              <Sparkles size={18} />
            </div>
            <p>Your daily spending allowance</p>
            <strong>
              ₹2,700<span>.00</span>
            </strong>
            <div className="sample-tag">
              Sample · ₹1,00,000 income · 30-day month
            </div>
            <div className="preview-line" />
            <div className="preview-row">
              <span>Monthly commitments</span>
              <b>₹19,000</b>
            </div>
            <div className="preview-row">
              <span>A coffee, lunch & a metro ride</span>
              <b>− ₹500</b>
            </div>
            <div className="preview-remaining">
              <span>A little room to breathe.</span>
              <strong>
                ₹2,200 <ArrowUpRight size={17} />
              </strong>
            </div>
          </div>
          <div className="floating-note">
            <span>
              <Leaf size={20} />
            </span>
            <div>
              Small choices.
              <br />
              <strong>A bigger picture.</strong>
            </div>
          </div>
        </div>
      </main>
      <footer>
        <span>Made for your life. Not your login.</span>
        <span>
          {mode === "cloud"
            ? "Cloud profiles belong to your account. Local profiles stay on this device."
            : "Your data stays in this browser. Export a backup to keep it safe."}
        </span>
      </footer>
      <Dialog
        open={nameMode}
        onClose={() => setNameMode(false)}
        title="Make it yours"
        description="A name is all you need. No email or password."
      >
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            start(false, name);
          }}
        >
          <label className="field">
            Profile name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
              placeholder="e.g. Personal, Student, Family"
            />
          </label>
          <Button type="submit" disabled={busy}>
            Create local profile
            <ArrowRight size={16} />
          </Button>
        </form>
      </Dialog>
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
            ? "Let’s give your money a little direction."
            : step === 2
              ? "Make room for the essentials."
              : "Your days, with a little more clarity."
        }
        description={`YOUR Spendense SETUP · STEP ${step} OF 3`}
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
              After your commitments, before your everyday.
              <br />
              You can change your plan whenever life changes.
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
  const [profilesOpen, setProfilesOpen] = useState(false);
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
        <span className="loading-dots">Getting your day ready…</span>
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
            Use Local
          </Button>
        )}
        <AccountControls />
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
        <p>Opening your local profile…</p>
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
          <span className="nav-label">YOUR WORKSPACE</span>
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
            <div className="privacy-card">
              <div>
                <ShieldCheck size={21} />
                <span className="privacy-dot" />
              </div>
              <strong>
                Your money.
                <br />
                Your business.
              </strong>
              <p>
                {mode === "cloud"
                  ? "Your cloud account. Your private workspace."
                  : "Everything stays on your device. Just as it should."}
              </p>
              <Link href="/settings">
                About your data
                <ArrowUpRight size={14} />
              </Link>
            </div>
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
            <button
              className="sidebar-profile"
              onClick={() => setProfilesOpen(true)}
            >
              <span className="avatar">{profileDisplayName(profile)[0]}</span>
              <span>
                <strong>{profileDisplayName(profile)}</strong>
                <small>
                  {mode === "cloud"
                    ? "Cloud workspace"
                    : profile.demo
                      ? "Demo workspace"
                      : "Local workspace"}
                </small>
              </span>
              <ChevronDown size={15} />
            </button>
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
            <div className="breadcrumb">
              Your workspace
              <ChevronRight size={13} />
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
              <AccountControls />
              {profile.demo && <span className="demo-badge">DEMO</span>}
              <span className="local-badge">
                <span className="status-dot" />{" "}
                {mode === "cloud" ? "Cloud workspace" : "Saved on this device"}
              </span>
              <button
                className="avatar avatar-small"
                aria-label="Switch profile"
                onClick={() => setProfilesOpen(true)}
              >
                {profileDisplayName(profile)[0]}
              </button>
            </div>
          </header>
          <main id="main-content" className="main-content">
            {error && (
              <div className="error-banner" role="alert">
                {error}{" "}
                <Button size="sm" variant="secondary" onClick={refresh}>
                  Retry
                </Button>
              </div>
            )}
            <div className="mobile-top">
              <Logo />
              <AccountControls />
              <button
                className="avatar avatar-small"
                aria-label="Switch local profile"
                onClick={() => setProfilesOpen(true)}
              >
                {profileDisplayName(profile)[0]}
              </button>
            </div>
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
              <span>
                <span className="footer-logo">Spendense.</span> Make every day
                count.
              </span>
              <span>
                <LockKeyhole size={12} /> A little clarity. All yours.
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
      <ProfileDialog
        open={profilesOpen}
        onClose={() => setProfilesOpen(false)}
      />
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
