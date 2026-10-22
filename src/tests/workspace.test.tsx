import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  act as reactAct,
  fireEvent,
} from "@testing-library/react";
import type { Account } from "@/lib/auth";
import { thisMonth } from "@/lib/dates";
const mocked = vi.hoisted(() => ({
  current: vi.fn(),
  listener: null as null | ((event?: string) => void),
  owners: [] as string[],
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    current: mocked.current,
    subscribe: (callback: (event?: string) => void) => {
      mocked.listener = callback;
      return () => {};
    },
  },
}));
vi.mock("@/lib/supabase/browser", () => ({ browserClient: () => ({}) }));
vi.mock("@/lib/repositories/cloud", () => ({
  CloudRepository: class {
    owner: string;
    constructor(_client: unknown, owner: string) {
      this.owner = owner;
      mocked.owners.push(owner);
    }
    async profiles() {
      return [
        {
          id: this.owner,
          displayName: `Budget ${this.owner}`,
          demo: false,
          theme: "light",
          onboardingComplete: true,
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ];
    }
    async getMonth(profileId: string, yearMonth: string) {
      return {
        plan: {
          profileId,
          yearMonth,
          monthlyIncomeMinor: profileId === "alice" ? 12345 : 67890,
        },
        commitments: [],
        expenses: [],
        recurring: [],
        defaultIncomeMinor: 0,
      };
    }
    async exportProfile() {
      return { profile: { id: this.owner }, categories: [] };
    }
  },
}));
import { AppProvider, useApp } from "@/components/provider";
function Probe() {
  const app = useApp();
  return (
    <div>
      <span>{app.account?.id ?? "guest"}</span>
      <span>{app.profile?.displayName}</span>
      <span>{app.data?.plan.monthlyIncomeMinor}</span>
      <span>{app.month}</span>
      <input aria-label="Unsaved setup field" defaultValue="" />
    </div>
  );
}
beforeEach(() => {
  mocked.current.mockReset();
  mocked.owners = [];
  sessionStorage.clear();
  localStorage.removeItem("daywise-profile");
});
afterEach(() => {
  mocked.listener = null;
});
async function change(user: Account | null) {
  mocked.current.mockResolvedValue(user);
  await reactAct(async () => {
    mocked.listener?.();
  });
}
describe("verified account workspace transitions", () => {
  it("keeps in-progress fields mounted while a metadata event is verified", async () => {
    mocked.current.mockResolvedValue({ id: "alice", displayName: "Alice" });
    render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
    await screen.findByText("12345");
    fireEvent.change(screen.getByLabelText("Unsaved setup field"), {
      target: { value: "Unfinished setup" },
    });
    mocked.current.mockResolvedValue({
      id: "alice",
      displayName: "Alice Updated",
    });
    await reactAct(async () => {
      mocked.listener?.("USER_UPDATED");
    });
    expect(screen.getByLabelText("Unsaved setup field")).toHaveValue(
      "Unfinished setup",
    );
    expect(
      screen.queryByText("Opening your workspace…"),
    ).not.toBeInTheDocument();
  });
  it("keeps guest and financial views unmounted while session verification fails", async () => {
    mocked.current.mockRejectedValue(
      new Error("Cannot verify your cloud session. Retry."),
    );
    render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot verify");
    expect(screen.queryByText("guest")).not.toBeInTheDocument();
    expect(mocked.owners).toEqual([]);
  });
  it("clears previous financial state on sign-out and isolates the next account", async () => {
    // A stale or forged preference cannot select another owner's budget.
    sessionStorage.setItem("daywise-cloud-budget:alice", "bob");
    mocked.current.mockResolvedValue({
      id: "alice",
      email: "alice@example.test",
    });
    render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
    await screen.findByText("12345");
    await change(null);
    await screen.findByText("guest");
    expect(screen.queryByText("12345")).not.toBeInTheDocument();
    expect(screen.queryByText("Budget alice")).not.toBeInTheDocument();
    await change({ id: "bob", email: "bob@example.test" });
    await screen.findByText("67890");
    expect(screen.queryByText("12345")).not.toBeInTheDocument();
    expect(screen.queryByText("Budget alice")).not.toBeInTheDocument();
    expect(mocked.owners).toContain("bob");
    expect(screen.getByText(thisMonth())).toBeVisible();
  });
  it("ignores an outdated account verification after a newer request completes", async () => {
    let resolveOld: (value: Account) => void = () => {};
    mocked.current.mockImplementationOnce(
      () =>
        new Promise<Account>((resolve) => {
          resolveOld = resolve;
        }),
    );
    render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
    await waitFor(() => expect(mocked.current).toHaveBeenCalledOnce());
    await change({ id: "bob" });
    await screen.findByText("67890");
    await reactAct(async () => resolveOld({ id: "alice" }));
    expect(screen.queryByText("alice")).not.toBeInTheDocument();
    expect(screen.getByText("bob")).toBeVisible();
  });
});
