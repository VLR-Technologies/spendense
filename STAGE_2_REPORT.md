# Spendense Stage 2 — UX Refinement and Financial Clarity

> Historical implementation evidence. The current release defaults to locked maintenance mode; see [DEPLOYMENT_REPORT.md](DEPLOYMENT_REPORT.md) for deployment preparation and current validation. Earlier test results below were not re-executed against a hosted backend for this task.

Branding note: the current name is **Spendense**. This report records the earlier stage's implementation and test evidence; legacy technical identifiers and historical screenshots may retain the previous name. See [REBRANDING_REPORT.md](REBRANDING_REPORT.md) for this branding-only update.


Implemented and verified on **22 October 2026 (Europe/Berlin)** against the existing working application. **Stage 2 meets the acceptance criteria within the browser coverage described below.** No commit, push, merge, or deployment was performed.

## User experience changes

### Calendar

- Mobile dates show the date and one prominent remaining amount. Repeated allowance/spending rows and tiny status captions are removed from mobile cells; exact figures remain in accessible names and day details.
- Short amounts are explicitly identified as rounded. Desktop retains the detailed allowance, spent, and remaining presentation.
- Calendar cells use a shorter mobile layout, clearer weekday labels, stronger contrast, a violet today marker, an overspending arrow, and dashed future projections. Status information remains available without relying on color.
- Monthly totals now follow the calendar so the dates appear earlier on a phone. Monthly average allowance remains visible above it.
- Calendar keyboard navigation has one tab stop, day/week arrow movement, Home/End week movement, and safe month boundaries. Focused dates remain valid after changing months. Today has `aria-current="date"`.
- At narrow phone widths the calendar expands toward the screen edges to retain usable date targets. The responsive regression checks verify date targets of at least 44 CSS pixels at 320, 360, and 390 pixels wide.

### Financial clarity and dashboard

The dashboard now places today's allowance beside a visible monthly calculation:

```text
Monthly income
− Fixed deductions (recurring + one-time monthly commitments)
= Available for daily spending
÷ Actual days in the month
→ Daily allowance (labelled as an average)
```

Today's card then shows daily expenses and the remaining amount. For historical or future months, the card explicitly labels the daily average and separates its monthly spending/remaining totals.

Day details expose the complete exact equation:

```text
Income allocation − fixed deductions = daily allowance
Daily allowance − daily expenses = remaining amount
```

- Replaced two repetitive dashboard cards with a connected monthly breakdown and direct income/plan controls.
- Improved heading hierarchy, spacing, numeric alignment, text size, and panel consistency. Retained Spendense violet, both themes, charts, calendar preview, recent expenses, and elapsed spending context.
- Shortened decorative copy and section titles to describe the information: “Daily remaining amounts,” “Spending by category,” and “Recent expenses.”
- Replaced a hover-only cumulative explanation with an accessible disclosure. It explains elapsed-day scope, future exclusion, and the difference between allocation and bank balance.
- Retained the payment-status explanation: marking a commitment paid does not deduct it twice. Clarified that income allocations are not daily salary receipts.

### Navigation, sheets, and forms

- Month controls, main expense actions, close controls, and expense edit/delete actions use 44-pixel touch targets. Mobile navigation retains all six destinations with larger targets, readable labels, and a stronger active state.
- Main and mobile links expose `aria-current="page"`; month changes are announced politely.
- All mobile dialogs use bottom sheets with a visible handle, safe-area padding, bounded dynamic-viewport height, and contained scrolling. Desktop day details remain a side drawer.
- Sticky sheet headers keep the close action available while scrolling. Day details keep the add-expense action accessible at the bottom.
- Dialogs explicitly restore focus to their opener, including nested expense sheets. Radix focus containment, accessible titles, and Escape dismissal remain intact.
- Added `viewport-fit=cover` and safe-area spacing; phone inputs remain at 16px. Primary-action colors and essential text contrast were strengthened in both themes.

## Architecture and preservation

The existing Next.js App Router / TypeScript architecture remains in place. Relevant bundled Next.js guides for client components, CSS, and Playwright were read. No dependencies, authentication, Supabase, external persistence, or new services were introduced.

| File                                  | Responsibility                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/components/budget-breakdown.tsx` | New presentation-only monthly and daily breakdowns; receives existing summary values                    |
| `src/components/dashboard.tsx`        | Revised hierarchy, financial explanations, and period labels                                            |
| `src/components/calendar.tsx`         | Calendar controls, simplified cells, exact day breakdown, and totals placement                          |
| `src/components/shell.tsx`            | Navigation semantics, month announcements, and concise expense-sheet title                              |
| `src/components/ui/dialog.tsx`        | Opener focus restoration and sheet handle                                                               |
| `src/app/globals.css`                 | Existing theme system plus scoped refinements for typography, calendar, controls, and responsive sheets |
| `src/app/layout.tsx`                  | Safe-area viewport configuration                                                                        |
| `src/tests/components.test.tsx`       | Additional calendar and financial-presentation regressions                                              |
| `e2e/stage-2.spec.ts`                 | New browser regressions, legacy-record checks, responsive checks, and screenshot matrix                 |

**No financial formulas changed.** The entire `src/lib/` directory, domain types, application provider, finance tests, repository tests, and original Playwright test file were compared byte-for-byte with the starting snapshot and are unchanged.

IndexedDB remains **`daywise-local-v1`, Dexie schema version 1**. Table definitions, keys, monetary units, backup format, recurring revisions, month snapshots, and repository operations are unchanged. No migration, reset, or bulk rewrite occurs as part of Stage 2.

A new browser regression seeds existing version-1 records before selecting the profile, reads historical paise-accurate calculations through the updated UI, reloads, and compares each seeded record with its original value. The profile, income revision, historical income override, recurring schedule, paid commitment, notes, timestamps, and daily expense remain identical. Creating a previously unopened month continues the existing materialization behavior.

The exact 30-day example remains ₹1,00,000 − ₹19,000 = ₹81,000; daily allowance ₹2,700; remaining ₹2,200 after ₹500. Signed values, one-paise distribution, 28/29/30/31-day months, and future exclusions remain covered by the original engine tests.

## Verification results

Environment: Node **22.23.1**, Next.js **16.4.2**, React **19.3.1**, Vitest **4.1.12**, Playwright **1.64.1**, installed Google Chrome. Browser acceptance was run against the locally served **production build**, not only the development server.

| Check                               | Result                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run lint`                      | Passed; no ESLint errors or warnings                                                                  |
| `npm run typecheck`                 | Passed                                                                                                |
| `npm test`                          | **46 passed** across 3 files; original 38 tests retained plus 8 new cases                             |
| `npm run build`                     | Passed using the existing Webpack build command; application routes prerendered successfully          |
| `npm run test:e2e`                  | **17 passed, 1 intentional skip**, across desktop and mobile projects                                 |
| Screenshot matrix                   | 14 updated Stage 2 captures: both themes on desktop and mobile, plus focused mobile calendar views    |
| Core-source preservation comparison | Passed; finance/storage/provider/domain files and original finance/repository/browser tests unchanged |

The one skip is the desktop instance of the mobile-only width sweep; the same test passes in the mobile project. No functional browser journey is omitted because of a failure.

Existing browser journeys continue to cover guest/named-profile onboarding, zero-income setup, income and commitment creation, exact expense editing, month navigation, search, themes and reload persistence, backup download/restore, profile isolation, invalid imports, one-time-to-recurring conversion, pause/resume, payment metadata, and blocked-storage recovery.

New coverage verifies:

- Full monthly and exact daily explanations, including zero, negative, paise, and projected values.
- One calendar tab stop, arrow/Home/End navigation, and first/last-day boundaries.
- Income editing and opener focus, adjacent-day browsing, nested sheet Escape/focus restoration, and sticky close controls after scrolling.
- Expense creation with paise, canceling deletion, confirmed deletion, and exact remaining-amount recalculation.
- Theme-aware navigation, today's date semantics, and absence of uncaught page errors during the screenshot journey.
- All six routes without horizontal overflow at **320, 360, 390, 768, and 1024 pixels** wide, alongside the standard desktop project.
- Primary touch target dimensions and access to form submission with the viewport shortened to simulate limited keyboard space.
- Previously saved version-1 records remaining unchanged after navigation and reload.

Initial test-authoring issues involved the existing “Expense date” accessible name and fractional CSS-pixel measurements; both were corrected before final validation. Final screenshots use the application's reduced-motion support so charts are captured after their shapes are present rather than mid-animation.

## Screenshots

Captures use the real demo workspace at **1280 × 720** (desktop) and **390 × 664**, 3× device scale (mobile), with the Stage 2 screenshot clock fixed to **22 October 2026**. Dashboard/calendar images are full-page; day-sheet images show the viewport. Mobile calendar viewport captures supplement the full-page images. Full-page captures retain fixed navigation at its actual viewport position.

| View                       | Light                                                                | Dark                                                               |
| -------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Desktop dashboard          | [Light](docs/screenshots/stage-2/desktop-dashboard-light.png)        | [Dark](docs/screenshots/stage-2/desktop-dashboard-dark.png)        |
| Desktop calendar           | [Light](docs/screenshots/stage-2/desktop-calendar-light.png)         | [Dark](docs/screenshots/stage-2/desktop-calendar-dark.png)         |
| Desktop day drawer         | [Light](docs/screenshots/stage-2/desktop-day-sheet-light.png)        | [Dark](docs/screenshots/stage-2/desktop-day-sheet-dark.png)        |
| Mobile dashboard           | [Light](docs/screenshots/stage-2/mobile-dashboard-light.png)         | [Dark](docs/screenshots/stage-2/mobile-dashboard-dark.png)         |
| Mobile calendar, full page | [Light](docs/screenshots/stage-2/mobile-calendar-light.png)          | [Dark](docs/screenshots/stage-2/mobile-calendar-dark.png)          |
| Mobile calendar, viewport  | [Light](docs/screenshots/stage-2/mobile-calendar-viewport-light.png) | [Dark](docs/screenshots/stage-2/mobile-calendar-viewport-dark.png) |
| Mobile day sheet           | [Light](docs/screenshots/stage-2/mobile-day-sheet-light.png)         | [Dark](docs/screenshots/stage-2/mobile-day-sheet-dark.png)         |

## Acceptance criteria

| Criterion                                                                    | Assessment                                                                                                                        |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Mobile calendar readability/usability                                        | Met: one remaining amount, clear states, earlier calendar placement, exact detail access, keyboard controls, tested touch targets |
| Explicit income → deductions → allowance → expenses → remaining relationship | Met: visible monthly derivation and exact five-step day breakdown                                                                 |
| Dashboard hierarchy and visual consistency                                   | Met: connected budget panels, stronger typography/contrast, consistent spacing, clearer section titles                            |
| Less redundant microcopy with clarity/accessibility retained                 | Met: shortened headings and descriptions; financial caveats retained in contextual explanations                                   |
| Better mobile navigation, sheets, targets, and responsiveness                | Met within tested Chromium coverage, including narrow screens and reduced-height forms                                            |
| Light/dark themes and violet identity                                        | Met; both themes captured on desktop/mobile                                                                                       |
| Existing data, history, recurrence, and financial operations                 | Met: unchanged core sources/schema, retained tests, and version-1 record regression                                               |
| Required verification and screenshots                                        | Met: lint, typecheck, unit tests, desktop/mobile Playwright, production build, and screenshot matrix                              |
| Stage boundaries                                                             | Met: no authentication/Supabase, financial formula changes, commits, pushes, merges, or deployment                                |

## Remaining issues and limits

No known blocking Stage 2 functional issue remains in the tested environment.

- Mobile coverage uses Chromium device emulation. Physical iOS/Android devices, Safari/WebKit, Firefox, native keyboards, and a manual screen-reader audit were not run. The shortened-viewport test checks layout access but does not reproduce every native keyboard behavior.
- Calendar short amounts are intentionally approximate, and the monthly daily figure is labelled as an average. Exact daily values and paise remain available in accessible names and day details.
- A development-only Dexie advisory suggested an optional compound lookup index for a commitment deletion query. It is not a correctness failure; no schema change was made for that optimization.
- Existing product limits remain: INR only, browser-origin/device-local storage, manual backup, and no cloud synchronization or authenticated accounts.
