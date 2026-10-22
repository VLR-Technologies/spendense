import { CalendarDays, LockKeyhole, Wallet } from "lucide-react";
import { Logo } from "./logo";
import type { AppMode } from "@/lib/deployment";

export function DeploymentNotice({ mode }: { mode: AppMode }) {
  return (
    <div className="welcome deployment-notice">
      <header>
        <Logo />
        <span>{mode === "staging" ? "Staging preview" : "Maintenance"}</span>
      </header>
      <main id="main-content" className="welcome-main">
        <div className="welcome-copy">
          <span className="pill">
            <LockKeyhole size={14} /> FINANCIAL OPERATIONS PAUSED
          </span>
          <h1>
            A little pause.
            <br />
            <span>More clarity soon.</span>
          </h1>
          <p>
            Spendense is being prepared for a safe launch. Sign-in and financial
            workspaces will open after account access and data protection checks
            are complete.
          </p>
          <p role="status">
            You cannot enter, import, or change financial data here yet.
            Existing browser records are left untouched.
          </p>
        </div>
        <section
          className="panel deployment-panel"
          aria-label="Spendense launch status"
        >
          <span className="hero-icon">
            <Wallet size={24} />
          </span>
          <h2>Your everyday, with a little more clarity.</h2>
          <p>
            Daily budgets, recurring commitments, expenses, and insights will be
            available when Spendense opens.
          </p>
          <div className="deployment-status">
            <CalendarDays size={20} />
            <span>
              Your calendar and plans are part of the same Spendense experience.
            </span>
          </div>
          <div className="deployment-status">
            <LockKeyhole size={20} />
            <span>
              Account access and financial storage are currently disabled.
            </span>
          </div>
        </section>
      </main>
      <footer>
        <span>Spendense. Make every day count.</span>
        <span>No financial data is loaded or saved in this preview.</span>
      </footer>
    </div>
  );
}
