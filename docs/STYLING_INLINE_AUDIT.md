# Styling Inline Audit (Components + Full UI)

Date: 2026-02-23
Scope: `ui/src/**/*.tsx` and `ui/src/**/*.css`

## Objective

Establish and enforce consistent styling standards across the frontend using:

- CSS Modules for component styling
- Tailwind for layout/utilities
- CSS variables for theme/design tokens
- Runtime-only inline styles as exceptions

## Current-state verification

### Inline styles (full UI)

- Total `style={...}` usages: **515**
- Object-literal inline styles `style={{...}}`: **405**
- TSX files with inline styles: **60**

### Inline styles (components only)

- Total `style={...}` usages: **339**
- Object-literal inline styles `style={{...}}`: **278**
- TSX files with inline styles: **51**

### Stylesheet footprint (full UI)

- Total stylesheet files (`*.css` + `*.module.css`): **11**
- CSS Modules currently in use: **0**

#### CSS hotspot summary

- `src/components/playPage/Table.css`: 476 LOC, high legacy footprint
- `src/components/Footer.css`: 219 LOC, heavy `rgba`/variable usage
- `src/components/playPage/common/Badge.css`: 214 LOC, hardcoded color usage
- `src/components/QRDeposit.css`: 94 LOC, hardcoded color usage
- `src/pages/Dashboard.css`: 59 LOC, hardcoded color usage

## Ticket issues verification

1. **Mixed styling approaches** — Verified (global CSS + Tailwind + inline styles).
2. **Inline styles scattered throughout** — Verified (515 total instances).
3. **Duplicate gradient definitions** — Verified (TSX literals + CSS + utility-generated values).
4. **No single enforced design system** — Verified (theme source exists but enforcement is inconsistent).

## Policy decision (for migration)

- Remove **all static inline styles** from components.
- Keep **runtime-only inline styles** when values are inherently dynamic at render time.
- Runtime exceptions must be minimal and colocated with the element that requires them.

### Allowed runtime inline style examples

- Position/size from live state (`left`, `top`, `width`, `height`)
- Progress values (`width` percentages)
- Per-instance animation delay or transform derived from runtime state

### Disallowed inline style examples (migrate to CSS Modules)

- Static `backgroundColor`, `color`, `border`, `boxShadow`, gradients
- Static visual variants that can be class-driven

## Recommended architecture (confirmed)

- **Primary method**: CSS Modules
- **Utilities**: Tailwind classes for layout/spacing/responsive primitives
- **Theming**: CSS custom properties from `src/utils/colorConfig.ts` injected in `src/App.tsx`
- **Inline styles**: Runtime-only exceptions

This architecture preserves current functionality while reducing style drift and maintenance cost.

## Design tokens

### Existing token source

- `src/utils/colorConfig.ts` (`generateCSSVariables`, color map helpers)

### Migration token set

- **Color**: `--surface-*`, `--text-*`, `--border-*`, `--status-*`
- **Gradient**: `--gradient-primary`, `--gradient-success`, `--gradient-danger`
- **Spacing**: `--space-1..8` aligned to 4px/8px scale
- **Typography**: `--font-size-*`, `--line-height-*`, `--font-weight-*`
- **Breakpoints**: mobile/tablet/desktop/large semantics documented and reused consistently

## Implementation guidelines

- BEM-style naming for CSS classes where useful (`block__element--modifier`)
- `styles.camelCase` imports for CSS Modules
- Kebab-case CSS variables (`--color-primary`)
- No new hardcoded colors in touched files
- Prefer low specificity; avoid `!important`
- Mobile-first responsive behavior

## Full UI prioritized hotspots

1. `src/pages/TestSigningPage.tsx` — 62
2. `src/components/CosmosWalletPage.tsx` — 31
3. `src/components/QRDeposit.tsx` — 29
4. `src/pages/explorer/TransactionPage.tsx` — 29
5. `src/pages/Dashboard.tsx` — 24
6. `src/components/depositComponents/Web3DepositSection.tsx` — 20
7. `src/components/modals/WithdrawalModal.tsx` — 20
8. `src/components/playPage/Table/components/TableHeader.tsx` — 20
9. `src/pages/explorer/BlockDetailPage.tsx` — 20
10. `src/components/modals/BuyInModal.tsx` — 19

## Migration plan (stepwise)

### Wave 1: Modal stack (highest payoff)

Targets:

- `src/components/modals/BuyInModal.tsx`
- `src/components/modals/DepositCore.tsx`
- `src/components/modals/TopUpModal.tsx`
- `src/components/modals/WithdrawalModal.tsx`

Actions:

1. Add colocated `*.module.css` files
2. Move static inline styles into module classes
3. Keep runtime-only values inline
4. Normalize modal gradients via shared CSS variables/classes

### Wave 1 implementation status (completed)

Completed files:

- `src/components/modals/BuyInModal.tsx` + `src/components/modals/BuyInModal.module.css`
- `src/components/modals/DepositCore.tsx` + `src/components/modals/DepositCore.module.css`
- `src/components/modals/TopUpModal.tsx` + `src/components/modals/TopUpModal.module.css`
- `src/components/modals/WithdrawalModal.tsx` + `src/components/modals/WithdrawalModal.module.css`

Wave 1 outcomes:

- Static inline styles removed from all four Wave 1 modal files.
- Colocated CSS Modules added for each migrated modal.
- `useModalStyles` usage removed from migrated files where static styles were replaced.
- Runtime behavior preserved (validation, loading states, disabled states, async actions).

Evidence check:

- `style={` usage across Wave 1 target files: **0 matches**.

Post-Wave-1 snapshot (full UI):

- Total `style={...}` usages: **460** (from 515)
- Object-literal inline styles `style={{...}}`: **365** (from 405)
- TSX files with inline styles: **56** (from 60)
- Stylesheet files (`*.css` + `*.module.css`): **15** (from 11)
- CSS Modules in use: **4** (from 0)

Notable changes:

- Added `--accent-warning` in `src/utils/colorConfig.ts` for warning-state modal styles.
- No additional new token variables were required for Wave 1.

### Wave 2: Wallet/deposit surfaces

Targets:

- `src/components/CosmosWalletPage.tsx`
- `src/components/QRDeposit.tsx`
- `src/components/depositComponents/*`

### Wave 2 kickoff (next execution block)

Start order:

1. `src/components/CosmosWalletPage.tsx`
2. `src/components/QRDeposit.tsx`
3. `src/components/depositComponents/Web3DepositSection.tsx`
4. Remaining `src/components/depositComponents/*`

Wave 2 done criteria:

- Static inline styles in touched files are migrated to colocated CSS Modules.
- Existing CSS variables are used for theme-able color/surface values.
- Any new token variable is added only when required and documented in this audit.
- Runtime-only inline styles remain as explicit exceptions.
- No regressions in deposit/wallet interactions and responsive layouts.

Wave 2 notable watchouts:

- Preserve wallet connection state and async loading/error visuals.
- Keep payment/deposit action button disabled/loading behavior unchanged.
- Consolidate repeated panel/card/button styling across wallet/deposit surfaces.

### Wave 2 implementation status (completed)

Completed files:

- `src/components/CosmosWalletPage.tsx` + `src/components/CosmosWalletPage.module.css`
- `src/components/QRDeposit.tsx` + `src/components/QRDeposit.module.css`
- `src/components/depositComponents/BalanceDisplay.tsx`
- `src/components/depositComponents/DepositProgressBar.tsx`
- `src/components/depositComponents/DepositTimer.tsx`
- `src/components/depositComponents/QRCodeDisplay.tsx`
- `src/components/depositComponents/SessionStatusCard.tsx`
- `src/components/depositComponents/Web3DepositSection.tsx`
- `src/components/depositComponents/DepositComponents.module.css`

Wave 2 outcomes:

- Static inline styles removed from `CosmosWalletPage` and `QRDeposit`.
- Static inline styles removed from all `depositComponents/*` files.
- Shared wallet/deposit style primitives centralized in `DepositComponents.module.css`.
- Runtime-only inline style retained where required (`DepositProgressBar` progress width).

Evidence check:

- `style={` usage in `src/components/QRDeposit.tsx`: **0 matches**.
- `style={` usage in `src/components/depositComponents/*`: **1 match** (runtime progress width).

Post-Wave-2 snapshot (full UI):

- Total `style={...}` usages: **356** (from 460 post-Wave-1; from 515 baseline)
- Object-literal inline styles `style={{...}}`: **267** (from 365 post-Wave-1; from 405 baseline)
- TSX files with inline styles: **49** (from 56 post-Wave-1; from 60 baseline)
- Stylesheet files (`*.css` + `*.module.css`): **18** (from 15 post-Wave-1; from 11 baseline)
- CSS Modules in use: **7** (from 4 post-Wave-1; from 0 baseline)

### Wave 2 visual parity verification (completed)

Verification date: 2026-02-23

Scope checked:

- `src/components/CosmosWalletPage.tsx` + `src/components/CosmosWalletPage.module.css`
- `src/components/QRDeposit.tsx` + `src/components/QRDeposit.module.css`
- `src/components/depositComponents/*` + `src/components/depositComponents/DepositComponents.module.css`

What was verified:

- Removing `colorConfig` direct imports in migrated components does **not** remove theming, because `generateCSSVariables()` is still injected from `src/App.tsx` at runtime.
- Migrated class styles still consume the same token source (`--brand-*`, `--ui-*`, `--accent-*`) from `src/utils/colorConfig.ts`.
- Interactive states (disabled/hover/loading) remain implemented and equivalent, with CSS pseudo-classes replacing JS `onMouseEnter/onMouseLeave` style mutation.
- Runtime-only inline style exception remains only where required (`DepositProgressBar` progress width).

Parity outcome:

- No functional behavior changes observed from import removal.
- Expected visual differences are limited to minor rendering variance from CSS `color-mix(...)` vs prior JS `hexToRgba(...)` composition.
- No additional token changes were required for this verification pass.

### Wave 3: Play surfaces

Targets:

- `src/components/playPage/Table/components/TableHeader.tsx`
- `src/components/playPage/Players/*`
- `src/components/playPage/common/Badge.tsx`
- `src/components/common/Modal.tsx`

### Wave 3 implementation status (in progress)

Completed in this slice:

- `src/components/common/Modal.tsx` + `src/components/common/Modal.module.css`
- `src/components/playPage/common/Badge.tsx` + updates in `src/components/playPage/common/Badge.css`
- `src/components/playPage/Table/components/TableHeader.tsx` + `src/components/playPage/Table/components/TableHeader.module.css`
- `src/components/playPage/Table.tsx` (removed deprecated style prop plumbing)
- `src/components/playPage/Players/Player.tsx`
- `src/components/playPage/Players/OppositePlayer.tsx`
- `src/components/playPage/Players/VacantPlayer.tsx` + `src/components/playPage/Players/VacantPlayer.module.css`
- `src/components/playPage/Players/PlayersCommon.module.css`

Wave 3 slice outcomes:

- Static inline styles removed from `Modal` except runtime title divider/icon color values.
- Static tournament result colors in `Badge` moved to class-based styles.
- Static literal color/border styles in `TableHeader` moved to module classes.
- Static white/secondary text color in key player seat components moved to shared player classes.
- Static buy-in modal visual styles in `VacantPlayer` moved to CSS module classes (runtime seat/popup positioning preserved).

Wave 3 slice evidence (target-local):

- `src/components/common/Modal.tsx`: **2** `style={` matches (runtime title color/gradient)
- `src/components/playPage/common/Badge.tsx`: **3** `style={` matches (runtime player-color driven)
- `src/components/playPage/Table/components/TableHeader.tsx`: **0** `style={` matches (reduced from 20 in pre-wave baseline)
- `src/components/playPage/Players/*`: **10** `style={` matches (reduced from 19 in this wave)
- `src/components/playPage/Players/Player.tsx`: **2** `style={` matches (position + runtime status color)
- `src/components/playPage/Players/OppositePlayer.tsx`: **3** `style={` matches (position + runtime status color + popup position)
- `src/components/playPage/Players/VacantPlayer.tsx`: **3** `style={` matches (seat position + popup position + runtime disabled state)
- `src/components/playPage/common/Badge.tsx`: **3** `style={` matches (runtime player-color driven)
- `src/components/common/Modal.tsx`: **2** `style={` matches (runtime title color/gradient)

Wave 3 parity smoke check (2026-02-23):

- Build validation passed: `yarn build` completed successfully.
- Header gradients remain token-equivalent in `TableHeader.module.css` (`--table-bg-gradient-start/mid/end`).
- Hover behavior parity confirmed via CSS pseudo-classes replacing JS handlers:
	- `depositButton:hover` matches prior border/background transitions.
	- `leaveTableButton:hover` matches prior text-color transition to white.
- Mouse event cleanup confirmed:
	- No `onMouseEnter/onMouseLeave` in `TableHeader.tsx` for migrated controls.
	- No `handleDepositMouseEnter/Leave` or `handleLeaveTableMouseEnter/Leave` in `Table.tsx`.
- Alpha parity correction pass applied:
	- `Modal.module.css`: error background adjusted to `12.5%` (`#...20` equivalent).
	- `VacantPlayer.module.css`:
		- `balanceCard` background adjusted to `50.2%` (`#...80` equivalent).
		- `errorCard` background adjusted to `18.8%` (`#...30` equivalent).
		- `errorCard` border adjusted to `25.1%` (`#...40` equivalent).

Remaining Wave 3 work:

- ✅ No static inline styles remain in Wave 3 targets.
- Remaining `style={` usage in `src/components/playPage/Players/*` is runtime-only and allowed by policy:
	- Positioning (`left/top/transform`) for seat and popup placement.
	- Live state color (`isWinner ? success : playerColor`) and player color props (`color`) in badge/popup contexts.

Wave 3 completion status:

- ✅ Wave 3 is complete under current acceptance criteria.

### Wave 4: Explorer/admin pages

Targets:

- Inline-style-heavy pages in `src/pages/explorer/*` and `src/pages/admin/*`

### Wave 4 implementation status (in progress)

Completed in this slice:

- `src/pages/explorer/TransactionPage.tsx` + `src/pages/explorer/TransactionPage.module.css`
- `src/pages/explorer/BlockDetailPage.tsx` + `src/pages/explorer/BlockDetailPage.module.css`
- `src/pages/explorer/AllAccountsPage.tsx` + `src/pages/explorer/AllAccountsPage.module.css`
- `src/pages/explorer/AddressPage.tsx` + `src/pages/explorer/AddressPage.module.css`
- `src/pages/admin/AdminDashboard.tsx` + `src/pages/admin/AdminDashboard.module.css`
- `src/pages/explorer/DistributionPage.tsx` + `src/pages/explorer/DistributionPage.module.css`

Wave 4 slice outcomes:

- Static inline styles migrated to CSS Module classes for explorer transaction detail surfaces.
- Hover color mutation handlers replaced with CSS `:hover` class behavior.
- Runtime-only inline style retained for transaction success/failure status color.

Wave 4 slice evidence (target-local):

- `src/pages/explorer/TransactionPage.tsx`: **1** `style={` match (runtime status color only; reduced from 29).
- `src/pages/explorer/BlockDetailPage.tsx`: **0** `style={` matches (reduced from 20).
- `src/pages/explorer/AllAccountsPage.tsx`: **0** `style={` matches (reduced from 15).
- `src/pages/explorer/AddressPage.tsx`: **0** `style={` matches (reduced from 14).
- `src/pages/admin/AdminDashboard.tsx`: **0** `style={` matches (reduced from 6).
- `src/pages/explorer/DistributionPage.tsx`: **0** `style={` matches (reduced from 1).

Next Wave 4 targets (by remaining inline-style density):

- `src/pages/explorer/TransactionPage.tsx` — 1 (runtime-only status color)

Wave 4 current aggregate:

- Explorer/admin inline styles remaining: **1** (down from 57 at Wave 4 kickoff).

Wave 4 closeout note:

- Remaining one `style={` usage is runtime-only by policy (`TransactionPage` status color).

### Wave 4 completion status

- ✅ Wave 4 is complete under current acceptance criteria.

### Wave 5: Legacy global CSS consolidation

Targets:

- `src/components/playPage/Table.css`
- `src/components/Footer.css`
- `src/components/playPage/common/Badge.css`

### Wave 5 implementation status (in progress)

Completed in this slice:

- `src/components/playPage/Table.css` (theme-token consolidation pass)
- `src/components/Footer.css` (theme-token consolidation pass)
- `src/components/playPage/common/Badge.css` (theme-token consolidation pass)

Wave 5 slice outcomes:

- Replaced hardcoded color literals with theme-variable-driven values in key `Table.css` selectors.
- Consolidated legacy `rgba(...)`/hex color usages to `color-mix(...)` + existing CSS variables where appropriate.
- Preserved class names/selectors and behavior to avoid UI regressions.
- Reviewed paired TSX consumers to preserve styling behavior and responsiveness:
	- `src/components/Footer.tsx` + footer action-panel TSX consumers
	- `src/components/playPage/common/Badge.tsx`
	- No responsive breakpoints/layout classes were modified in TSX.

Wave 5 slice evidence (target-local):

- `Table.css`: removed legacy literals in consolidated hotspots (`text-glow`, shimmer gradients, action pulse, sit-out toggle states, reduced-motion gradient fallback).
- `Footer.css`: replaced hardcoded hover/gradient/shadow colors with theme-variable-driven values.
- `Badge.css`: replaced hardcoded action/timer/shadow colors with theme-variable-driven values while preserving tournament place classes.
- Targeted lint/type checks passed for table surfaces (no errors; one pre-existing hook dependency warning in `Table.tsx`).
- Targeted lint/type checks passed for footer and badge TSX consumers.

Remaining Wave 5 targets:

- ✅ Wave 5 CSS consolidation targets are complete (`Table.css`, `Footer.css`, `Badge.css`).

### Wave 5 completion status

- ✅ Wave 5 is complete under current acceptance criteria.

### Wave 5 hardcoded/token review notes (team follow-up)

Purpose:

- Capture hardcoded values intentionally retained or currently mismatched with token defaults for explicit team review before token standardization.

Current conflict/mismatch list:

1. `src/components/playPage/Table.css` (`.text-glow`)
	- Previous hardcoded source color: `rgba(66, 153, 225, 0.5/0.3)` (hex base `#4299e1`).
	- Current tokenized value in file: `var(--brand-primary)` at 50%/30%.
	- Default token value: `--brand-primary = #3b82f6` (`src/utils/colorConfig.ts`).
	- Status: **not exact parity** (`#4299e1` vs `#3b82f6`); requires product/design sign-off if token adoption is desired.

2. `src/components/playPage/Table.css` (`.sit-out-toggle*` active/hover)
	- Hardcoded values currently used: `#f97316`, `rgba(249, 115, 22, 0.3)`, `#fb923c`.
	- Closest token candidate: `--accent-warning`.
	- Default token value: `--accent-warning = #f59e0b`.
	- Status: **not exact parity**; keep hardcoded values unless UX approves warning-token alignment.

3. `src/components/playPage/common/Badge.css` (`.timer-extension-button`, hover)
	- Hardcoded values currently used: `#2563eb` (base), `#3b82f6` (hover).
	- Closest token candidate: `--brand-primary = #3b82f6`.
	- Status: hover is exact match to token; base is **not exact parity** if replaced directly with token.

4. `src/components/playPage/common/Badge.css` (`.tournament-payout-win`)
	- Hardcoded value currently used: `#4ade80`.
	- Closest token candidate: `--accent-success = #10b981`.
	- Status: **not exact parity**; requires explicit color decision before token migration.

5. `src/components/Footer.css` (button gradients/shadows)
	- Tokenized mappings use: `--brand-primary`, `--accent-success`, `--accent-danger`, `--accent-glow`, `--ui-bg-dark` + `color-mix(...)` alpha conversions.
	- Default token values match prior literal channels used in this file (`#3b82f6`, `#10b981`, `#ef4444`, `#64ffda`, `#1f2937`).
	- Status: **parity-safe** under default token map.

Decision guidance for future cleanup:

- Safe-to-tokenize now: Footer mappings.
- Needs design/product sign-off before tokenizing: `Table.css` text glow + sit-out toggle palette, and `Badge.css` timer base + tournament payout win colors.

Decision checklist (team sign-off):

- [ ] `Table.css` `.text-glow`: approve replacing `#4299e1`-based glow with `--brand-primary` (`#3b82f6`).
- [ ] `Table.css` `.sit-out-toggle*`: approve replacing `#f97316`/`#fb923c` orange palette with `--accent-warning` (`#f59e0b`).
- [ ] `Badge.css` `.timer-extension-button` base: approve replacing `#2563eb` with `--brand-primary` (`#3b82f6`) or define a new token.
- [ ] `Badge.css` `.tournament-payout-win`: approve replacing `#4ade80` with `--accent-success` (`#10b981`) or define a tournament-success token.
- [ ] `Footer.css`: confirm tokenized mappings are approved as final (parity-safe under current defaults).

## Phase 2 records (moved)

Phase 2 documentation is split by audience:

- `src/docs/STYLING_INLINE_AUDIT_PHASE2.md` (condensed source of truth)
- `src/docs/STYLING_INLINE_AUDIT_PHASE2_PR_READY.md` (reviewer quick-start)
- `src/docs/STYLING_INLINE_AUDIT_PHASE2_DETAILED_LOG_2026-02-24.md` (full archived per-file log)

Keep this file focused on pre-Phase 2 context and earlier wave notes.