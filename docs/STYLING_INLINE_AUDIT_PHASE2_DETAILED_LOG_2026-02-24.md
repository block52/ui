# Styling Inline Audit — Phase 2

> PR handoff summary: `src/docs/STYLING_INLINE_AUDIT_PHASE2_PR_READY.md`

## Phase 2 kickoff (2026-02-24)

### Status checkpoint

What is complete from Phase 1 work:

- ✅ Wave 1 complete (modal stack static inline styles migrated).
- ✅ Wave 2 complete (wallet/deposit surfaces migrated; runtime progress width exception retained).
- ✅ Wave 3 complete (play surfaces migrated with runtime-only exceptions documented).
- ✅ Wave 4 complete (explorer/admin migrated; only runtime tx status color retained).
- ✅ Wave 5 complete (legacy CSS consolidation for `Table.css`, `Footer.css`, `Badge.css` with parity notes + sign-off checklist).

Current baseline metrics for follow-up scope:

- Total `style={...}` usages: **225**
- Object-literal inline styles `style={{...}}`: **167**
- TSX files with inline styles: **42**

Phase 2 objective:

- Reduce inline styles to **runtime-only exceptions** across remaining files while preserving visual parity and responsiveness.

### Scope and rules (Phase 2)

In scope:

- Audit all remaining `style={{...}}` usage in `src/**/*.tsx`.
- Classify each usage as runtime-required vs static-migratable.
- Migrate static visual styles to CSS Modules.
- Keep color usage token-based (`src/utils/colorConfig.ts` CSS variables).
- Update this audit with metrics + exception registry after each batch.

Out of scope:

- Visual redesigns or feature changes.
- Non-styling refactors.
- Reworking approved runtime-only dynamic styles unless proven static.

### Inline style classification map (Phase 2)

#### Static-migratable (migrate now)

- `src/components/WalletPanel.tsx`
- `src/components/ColorDebug.tsx`
- `src/components/playPage/Table/components/TableBoard.tsx`
- `src/components/modals/DealEntropyModal.tsx`
- `src/components/modals/USDCDepositModal.tsx`
- `src/components/playPage/Table/components/LayoutDebugInfo.tsx`
- `src/components/Footer/DealButtonGroup.tsx`
- `src/components/Footer/MainActionButtons.tsx`

#### Mixed (split static vs runtime)

- `src/pages/TestSigningPage.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/ActionsLog.tsx`
- `src/components/NetworkSelector.tsx`
- `src/components/playPage/SitAndGoWaitingModal.tsx`
- `src/components/explorer/ExplorerHeader.tsx`
- `src/components/playPage/Animations/WinAnimation.tsx`
- `src/components/TransactionPanel.tsx`
- `src/components/modals/LeaveTableModal.tsx`
- `src/components/common/LoadingPokerIcon.tsx`
- `src/components/explorer/ClickableAddress.tsx`
- `src/components/modals/CryptoPayment/PaymentStatusMonitor.tsx`
- `src/components/GlobalHeader.tsx`
- `src/test-sdk.tsx`

#### Runtime-required (approved exceptions; keep inline)

- `src/pages/explorer/TransactionPage.tsx` (tx status-driven color)
- `src/components/playPage/common/ProgressBar.tsx` (live timer width/color)
- `src/components/BuyChipsButton.tsx` (enabled/disabled runtime state)
- `src/components/common/Modal.tsx` (prop-driven divider/icon color)
- `src/components/playPage/Table.tsx` (computed positions/transforms)
- `src/components/playPage/Table/components/TableStatusMessages.tsx` (viewport-dependent offset)
- `src/components/playPage/Animations/TurnAnimation.tsx` (live positions)
- `src/components/playPage/Players/PlayerCard.tsx` (runtime player color)
- `src/components/modals/CryptoPayment/PaymentDisplay.tsx` (copied-state style)
- `src/components/depositComponents/DepositProgressBar.tsx` (progress width)
- `src/components/playPage/Players/OppositePlayer.tsx` (runtime position/status visuals)
- `src/components/playPage/Players/VacantPlayer.tsx` (validation-dependent visuals)
- `src/components/Footer/RaiseSlider.tsx` (value-driven gradient fill)
- `src/components/playPage/common/Badge.tsx` (runtime player/action colors)

Classification totals:

- Static-migratable: **8**
- Mixed: **14**
- Runtime-required: **14**

### Phase 2 execution plan

Batch 1 (top 5 by inline-style density):

1. `src/pages/TestSigningPage.tsx`
2. `src/pages/Dashboard.tsx`
3. `src/components/NetworkSelector.tsx`
4. `src/components/GlobalHeader.tsx`
5. `src/components/common/LoadingPokerIcon.tsx`

Batch 2 (next 5):

1. `src/components/ActionsLog.tsx`
2. `src/components/ColorDebug.tsx`
3. `src/components/modals/DealEntropyModal.tsx`
4. `src/components/WalletPanel.tsx`
5. `src/components/playPage/Table.tsx`

Batch 3 (remaining files + cleanup):

- All remaining static-migratable files.
- Static portions of mixed files.
- Re-validate runtime-required exceptions and document any reclassification.

Batch 4 (finalization):

- Final metrics snapshot (before/after).
- Runtime exception registry finalized.
- Deferred design sign-off items (if any) listed explicitly.
- Full validation pass: `yarn lint` + `yarn build`.

### Phase 2 batch progress log

#### Batch 1 — file 1 completed (`src/pages/TestSigningPage.tsx`)

Pre-edit parity verification:

- Reviewed inline styles against existing visual output across key states (default, disabled, success/error results, responsive layout).
- Classified inline styles in file as mixed: static-migratable majority with runtime-required minority.

Changes implemented:

- Added `src/pages/TestSigningPage.module.css`.
- Migrated static inline styles to module classes for panels, command boxes, action buttons, input styles, and static accent text.
- Removed `useMemo`-based inline style objects (`containerStyle`, `inputStyle`) in favor of CSS module classes.
- Retained runtime-only inline styles for:
	- initialize button gradient (depends on `isInitializing`),
	- test result card border coloring (depends on per-result status).

Metrics delta:

- `src/pages/TestSigningPage.tsx`:
	- `style={{...}}`: **34 → 2**
	- `style=` total: **62 → 2**
- Global snapshot after this file:
	- `style={{...}}`: **167 → 135**
	- `style=` total: **225 → 165**

Post-edit parity verification:

- No compile/diagnostic errors in `TestSigningPage.tsx` or `TestSigningPage.module.css`.
- Structural layout, section ordering, and interaction behavior preserved.

Difference log entries:

- File: `src/pages/TestSigningPage.tsx`
- Selector/element: migrated static sections/buttons/inputs
- Previous inline literal: token-derived `hexToRgba(...)` and fixed accent colors
- New class/token value: equivalent CSS variable + `color-mix(...)` mapping
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 1 — file 2 completed (`src/pages/Dashboard.tsx`)

Pre-edit parity verification:

- Reviewed modal shells, action buttons, input fields, and helper text styling across default/hover/focus/disabled states.
- Classified inline styles in file as mixed: static-migratable majority with a single runtime-dependent minority.

Changes implemented:

- Added `src/pages/Dashboard.module.css`.
- Migrated static inline styles to module classes for:
	- modal and panel surfaces,
	- headings/subtitles and helper text,
	- static button variants (primary, secondary, danger),
	- input and textarea surfaces,
	- hover/focus visuals previously implemented via JS style mutation handlers.
- Retained runtime-only inline style for copied-state feedback button style (depends on copy state at runtime).

Metrics delta:

- `src/pages/Dashboard.tsx`:
	- `style={{...}}`: **15 → 1**
	- `style=` total: **24 → 1**
- Global snapshot after this file:
	- `style={{...}}`: **135 → 114**
	- `style=` total: **165 → 143**

Post-edit parity verification:

- No compile/diagnostic errors in `Dashboard.tsx` or `Dashboard.module.css`.
- Layout, responsive behavior, and interaction states preserved.

Difference log entries:

- File: `src/pages/Dashboard.tsx`
- Selector/element: migrated modal surfaces, controls, and static text accents
- Previous inline literal: mixed hardcoded values and token-derived alpha colors
- New class/token value: equivalent CSS variable + `color-mix(...)` mappings
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 1 — file 3 completed (`src/components/NetworkSelector.tsx`)

Pre-edit parity verification:

- Reviewed dropdown closed/open states, selected/unselected row styling, discovered section header, and hover behavior.
- Classified inline styles in file as static-migratable (no runtime-required inline style dependency).

Changes implemented:

- Added `src/components/NetworkSelector.module.css`.
- Migrated all inline styles to module classes for:
	- trigger button surface/border/text,
	- dropdown menu surface/border,
	- row selected/unselected state backgrounds,
	- row borders,
	- selected icon color and name color,
	- endpoint secondary text and discovered section header.
- Replaced JS `onMouseEnter`/`onMouseLeave` style mutation with CSS `:hover` class behavior.

Metrics delta:

- `src/components/NetworkSelector.tsx`:
	- `style={{...}}`: **11 → 0**
	- `style=` total: **11 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **114 → 103**
	- `style=` total: **143 → 135**

Post-edit parity verification:

- No compile/diagnostic errors in `NetworkSelector.tsx` or `NetworkSelector.module.css`.
- Dropdown behavior, selected state emphasis, hover feedback, and responsive positioning preserved.

Difference log entries:

- File: `src/components/NetworkSelector.tsx`
- Selector/element: dropdown button/menu/items/header static visuals
- Previous inline literal: `hexToRgba(...)` and fixed text literals
- New class/token value: equivalent CSS variable + `color-mix(...)` mappings
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 1 — file 4 completed (`src/components/GlobalHeader.tsx`)

Pre-edit parity verification:

- Reviewed desktop and mobile header layouts, active/inactive nav states, admin icon state, and block-height indicator styling.
- Classified inline styles as static-migratable (state differences are route-driven and classable).

Changes implemented:

- Added `src/components/GlobalHeader.module.css`.
- Migrated inline styles to module classes for:
	- header shell surface, border, blur,
	- fallback logo text color,
	- block-height pill surface and text,
	- desktop/mobile nav active/inactive states,
	- admin icon active/inactive state,
	- mobile menu button color,
	- mobile menu top border,
	- nav badge pill surface/text.

Metrics delta:

- `src/components/GlobalHeader.tsx`:
	- `style={{...}}`: **11 → 0**
	- `style=` total: **11 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **103 → 92**
	- `style=` total: **135 → 124**

Post-edit parity verification:

- No compile/diagnostic errors in `GlobalHeader.tsx` or `GlobalHeader.module.css`.
- Desktop/mobile structure, route-active highlighting, and block-height display behavior preserved.

Difference log entries:

- File: `src/components/GlobalHeader.tsx`
- Selector/element: header shell, nav state styles, block height indicator
- Previous inline literal: token-derived `hexToRgba(...)` + static colors
- New class/token value: equivalent CSS variable + `color-mix(...)` mappings
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 1 — file 5 completed (`src/components/common/LoadingPokerIcon.tsx`)

Pre-edit parity verification:

- Reviewed animation timing sequence (spade/heart/diamond/club), spinner speed, icon scaling, and centered layout.
- Classified file as mixed: static animation styles migratable, with runtime size-dependent dimensions retained.

Changes implemented:

- Added `src/components/common/LoadingPokerIcon.module.css`.
- Migrated static styles to module classes for:
	- spinner duration,
	- `fadeInOut` keyframes and animation class,
	- fixed animation delay classes (`0s`, `0.75s`, `1.5s`, `2.25s`).
- Removed inline `<style>` block and replaced with module-scoped keyframes.
- Retained runtime-only inline styles for:
	- container width/height (depends on `size` prop),
	- suit glyph font-size (depends on `size` prop).

Metrics delta:

- `src/components/common/LoadingPokerIcon.tsx`:
	- `style={{...}}`: **9 → 5**
	- `style=` total: **10 → 5**
- Global snapshot after this file:
	- `style={{...}}`: **92 → 87**
	- `style=` total: **124 → 119**

Post-edit parity verification:

- No compile/diagnostic errors in `LoadingPokerIcon.tsx` or `LoadingPokerIcon.module.css`.
- Animation cadence, suit sequencing, and visual sizing behavior preserved.

Difference log entries:

- File: `src/components/common/LoadingPokerIcon.tsx`
- Selector/element: spinner/fade animation definitions and fixed delays
- Previous inline literal: inline style-tag keyframes + per-node delay literals
- New class/token value: CSS module keyframes + delay classes
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 2 — file 1 completed (`src/components/ActionsLog.tsx`)

Pre-edit parity verification:

- Reviewed history panel shell, row separators, primary/secondary text hierarchy, and copy-action icon states.
- Classified file as mixed: static surface/text/border styling migratable, copied-state icon emphasis runtime-dependent.

Changes implemented:

- Added `src/components/ActionsLog.module.css`.
- Migrated static inline styles to module classes for:
	- container text/background surface,
	- header and row border colors,
	- player/action/secondary text colors.
- Replaced inline copied/default icon colors with state-based class toggles (`copyButtonCopied` / `copyButtonDefault`).

Metrics delta:

- `src/components/ActionsLog.tsx`:
	- `style={{...}}`: **10 → 0**
	- `style=` total: **10 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **87 → 77**
	- `style=` total: **119 → 109**

Post-edit parity verification:

- No compile/diagnostic errors in `ActionsLog.tsx` or `ActionsLog.module.css`.
- History layout, clipboard actions, and copied-state feedback behavior preserved.

Difference log entries:

- File: `src/components/ActionsLog.tsx`
- Selector/element: history container/header/rows and copy icon color states
- Previous inline literal: static literals + token-derived runtime color expressions
- New class/token value: CSS variable + `color-mix(...)` class mappings with state class toggles
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 2 — file 2 completed (`src/components/ColorDebug.tsx`)

Pre-edit parity verification:

- Reviewed loaded-color value text rendering and swatch backgrounds against active environment-derived theme values.
- Classified file as static-migratable, since visual colors are representable via existing CSS variables.

Changes implemented:

- Added `src/components/ColorDebug.module.css`.
- Migrated all inline styles to module classes for:
	- loaded-color value text colors,
	- swatch background colors.
- Kept value strings sourced from `colors` for debug display text while moving visual styling to token-backed classes.

Metrics delta:

- `src/components/ColorDebug.tsx`:
	- `style={{...}}`: **8 → 0**
	- `style=` total: **8 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **77 → 69**
	- `style=` total: **109 → 101**

Post-edit parity verification:

- No compile/diagnostic errors in `ColorDebug.tsx` or `ColorDebug.module.css`.
- Debug panel text/swatch outputs preserved with token-driven rendering.

Difference log entries:

- File: `src/components/ColorDebug.tsx`
- Selector/element: loaded color labels and swatch blocks
- Previous inline literal: direct runtime color assignment from `colors.*`
- New class/token value: equivalent CSS variable class mappings
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 2 — file 3 completed (`src/components/modals/DealEntropyModal.tsx`)

Pre-edit parity verification:

- Reviewed entropy hash display surfaces, password input focus behavior, final entropy emphasis, action button styles, and title icon accent.
- Classified file as static-migratable for all inline styles in this component.

Changes implemented:

- Added `src/components/modals/DealEntropyModal.module.css`.
- Removed `useModalStyles` dependency in this component and migrated styles to module classes for:
	- title icon accent color,
	- hash display surface/border/typography,
	- password input surface/border/focus border,
	- final entropy highlighted display,
	- primary/secondary action button backgrounds.
- Removed input `onFocus`/`onBlur` border mutation handlers and replaced with CSS `:focus` behavior.

Metrics delta:

- `src/components/modals/DealEntropyModal.tsx`:
	- `style={{...}}`: **2 → 0**
	- `style=` total: **7 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **69 → 67**
	- `style=` total: **101 → 94**

Post-edit parity verification:

- No compile/diagnostic errors in `DealEntropyModal.tsx` or `DealEntropyModal.module.css`.
- Entropy displays, focus styling, and action button visual behavior preserved.

Difference log entries:

- File: `src/components/modals/DealEntropyModal.tsx`
- Selector/element: hash/input/button/title static visual styles
- Previous inline literal: `modalStyles.*`, inline focus mutation, and inline literal color style
- New class/token value: equivalent CSS variable + `color-mix(...)` free class mappings
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 2 — file 4 completed (`src/components/WalletPanel.tsx`)

Pre-edit parity verification:

- Reviewed no-wallet and wallet-present states, gradient button styling, balance icon tint, and layout consistency.
- Classified inline usage as static-migratable in this file.

Changes implemented:

- Added `src/components/WalletPanel.module.css`.
- Migrated all inline styles to module classes for:
	- shared primary gradient button surface,
	- balance icon container background tint,
	- balance icon dollar color.
- Removed `buttonStyle` callback helper and style props in favor of reusable classes.

Metrics delta:

- `src/components/WalletPanel.tsx`:
	- `style={{...}}`: **2 → 0**
	- `style=` total: **7 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **67 → 65**
	- `style=` total: **94 → 87**

Post-edit parity verification:

- No compile/diagnostic errors in `WalletPanel.tsx` or `WalletPanel.module.css`.
- Wallet panel visual hierarchy and button emphasis preserved.

Difference log entries:

- File: `src/components/WalletPanel.tsx`
- Selector/element: primary action buttons and balance icon accent surfaces
- Previous inline literal: gradient helper + token-derived inline colors
- New class/token value: CSS variable + `color-mix(...)` class mappings
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 2 — file 5 completed (`src/components/playPage/Table.tsx`)

Pre-edit parity verification:

- Re-classified all `Table.tsx` style usages before edits to separate static-safe visuals from live runtime layout values.
- Confirmed runtime-required surfaces remain for:
	- table transform (layout/viewport-dependent),
	- chip positions (left/bottom per seat),
	- card back style props passed to child components.

Changes implemented:

- Migrated static-safe inline visuals only:
	- network badge background/border,
	- devnet status dot color,
	- fixed table surface box shadow.
- Added corresponding classes in `src/components/playPage/Table.css` and removed static style objects from `Table.tsx`.
- Retained runtime inline styles exactly where values are computed from live layout state.

Metrics delta:

- `src/components/playPage/Table.tsx`:
	- `style={{...}}`: **2 → 2** (runtime-only remains)
	- `style=` total: **7 → 4**
- Global snapshot after this file:
	- `style={{...}}`: **65 → 65**
	- `style=` total: **87 → 84**

Post-edit parity verification:

- No compile/diagnostic errors in `Table.tsx` or `Table.css`.
- Network badge appearance and table surface depth preserved.
- Runtime layout/position behavior intentionally unchanged.

Difference log entries:

- File: `src/components/playPage/Table.tsx`
- Selector/element: network status badge and static table shadow
- Previous inline literal: static token-derived style objects
- New class/token value: equivalent CSS variable + `color-mix(...)` class mappings
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 1 completed (`src/components/Footer/DealButtonGroup.tsx`)

Pre-edit parity verification:

- Reviewed deal and entropy button visual hierarchy, hover/disabled states, and spacing.
- Classified file usage as static-migratable for the entropy button surface/border style.

Changes implemented:

- Added `src/components/Footer/DealButtonGroup.module.css`.
- Migrated inline entropy button styles to class-based token styling:
	- background surface,
	- border color.
- Preserved existing button behavior and transitions.

Metrics delta:

- `src/components/Footer/DealButtonGroup.tsx`:
	- `style={{...}}`: **1 → 0**
	- `style=` total: **1 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **65 → 64**
	- `style=` total: **84 → 83**

Post-edit parity verification:

- No compile/diagnostic errors in `DealButtonGroup.tsx` or `DealButtonGroup.module.css`.
- Entropy button visual parity preserved.

Difference log entries:

- File: `src/components/Footer/DealButtonGroup.tsx`
- Selector/element: entropy action button surface/border
- Previous inline literal: token-derived inline style object
- New class/token value: CSS variable class mapping
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 2 completed (`src/components/Footer/MainActionButtons.tsx`)

Pre-edit parity verification:

- Reviewed call/raise amount highlight emphasis across mobile and desktop action rows.
- Classified inline usage as static-migratable (token color highlight only).

Changes implemented:

- Added `src/components/Footer/MainActionButtons.module.css`.
- Migrated amount highlight inline styles to a reusable `amountAccent` class.

Metrics delta:

- `src/components/Footer/MainActionButtons.tsx`:
	- `style={{...}}`: **2 → 0**
	- `style=` total: **2 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **64 → 62**
	- `style=` total: **83 → 81**

Post-edit parity verification:

- No compile/diagnostic errors in `MainActionButtons.tsx` or `MainActionButtons.module.css`.
- Call/raise amount emphasis preserved.

Difference log entries:

- File: `src/components/Footer/MainActionButtons.tsx`
- Selector/element: call and raise amount value highlights
- Previous inline literal: token-derived inline color style
- New class/token value: CSS variable class mapping
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 3 completed (`src/components/playPage/Table/components/TableBoard.tsx`)

Pre-edit parity verification:

- Reviewed pot/chips text rows across desktop/mobile board layouts.
- Classified inline usage as static-migratable (`fontWeight: 700` only).

Changes implemented:

- Replaced inline `fontWeight` styles in pot value spans with a reusable class.
- Added `.pot-value-bold` in `src/components/playPage/Table.css`.

Metrics delta:

- `src/components/playPage/Table/components/TableBoard.tsx`:
	- `style={{...}}`: **2 → 0**
	- `style=` total: **2 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **62 → 60**
	- `style=` total: **81 → 79**

Post-edit parity verification:

- No compile/diagnostic errors in `TableBoard.tsx` or `Table.css`.
- Pot/chips value emphasis preserved.

Difference log entries:

- File: `src/components/playPage/Table/components/TableBoard.tsx`
- Selector/element: pot/chips amount value spans
- Previous inline literal: `fontWeight: 700`
- New class/token value: `.pot-value-bold { font-weight: 700; }`
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 4 completed (`src/components/modals/USDCDepositModal.tsx`)

Pre-edit parity verification:

- Reviewed modal shell surface/border and cancel button gradient emphasis.
- Classified inline usage as static-migratable (no runtime-dependent values).

Changes implemented:

- Added `src/components/modals/USDCDepositModal.module.css`.
- Migrated modal container background/border and cancel button gradient from inline styles to module classes.
- Removed now-unused color helper imports from component file.

Metrics delta:

- `src/components/modals/USDCDepositModal.tsx`:
	- `style={{...}}`: **2 → 0**
	- `style=` total: **2 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **60 → 58**
	- `style=` total: **79 → 77**

Post-edit parity verification:

- No compile/diagnostic errors in `USDCDepositModal.tsx` or `USDCDepositModal.module.css`.
- Modal shell and cancel button emphasis preserved.

Difference log entries:

- File: `src/components/modals/USDCDepositModal.tsx`
- Selector/element: modal surface and cancel action button
- Previous inline literal: token-derived `hexToRgba(...)` border/surface + danger gradient
- New class/token value: CSS variable + `color-mix(...)` module class mappings
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 5 completed (`src/components/playPage/Table/components/LayoutDebugInfo.tsx`)

Pre-edit parity verification:

- Reviewed development debug panel sizing and results JSON formatting.
- Classified both inline usages as static-migratable (`maxWidth`, `wordBreak`/`fontSize`).

Changes implemented:

- Added `src/components/playPage/Table/components/LayoutDebugInfo.module.css`.
- Migrated panel max width and `<pre>` text formatting styles to module classes.

Metrics delta:

- `src/components/playPage/Table/components/LayoutDebugInfo.tsx`:
	- `style={{...}}`: **2 → 0**
	- `style=` total: **2 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **58 → 56**
	- `style=` total: **77 → 75**

Post-edit parity verification:

- No compile/diagnostic errors in `LayoutDebugInfo.tsx` or `LayoutDebugInfo.module.css`.
- Debug panel readability and structure preserved.

Difference log entries:

- File: `src/components/playPage/Table/components/LayoutDebugInfo.tsx`
- Selector/element: debug panel shell width and results `<pre>` formatting
- Previous inline literal: `maxWidth: "180px"`, `wordBreak: "break-word"`, `fontSize: "10px"`
- New class/token value: module classes `.debugPanel` and `.resultsPre`
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 6 completed (`src/components/modals/LeaveTableModal.tsx`)

Pre-edit parity verification:

- Reviewed active-hand warning surface, stack panel, primary danger CTA, and secondary cancel CTA.
- Classified all inline usages as static-migratable; disabled cursor behavior remains class-driven.

Changes implemented:

- Added `src/components/modals/LeaveTableModal.module.css`.
- Migrated `dangerAlertStrong`, `panel`, `buttonDanger`, and `buttonSecondary` styles from `useModalStyles` usage to module classes.
- Removed component-level `useModalStyles` dependency and replaced runtime cursor inline style with `disabled:cursor-not-allowed` utility class.

Metrics delta:

- `src/components/modals/LeaveTableModal.tsx`:
	- `style={{...}}`: **1 → 0**
	- `style=` total: **4 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **56 → 55**
	- `style=` total: **75 → 71**

Post-edit parity verification:

- No compile/diagnostic errors in `LeaveTableModal.tsx` or `LeaveTableModal.module.css`.
- Warning/panel/button emphasis and loading/disabled behavior preserved.

Difference log entries:

- File: `src/components/modals/LeaveTableModal.tsx`
- Selector/element: warning panel, stack panel, leave/cancel action buttons
- Previous inline literal: `modalStyles.*` and button inline cursor override
- New class/token value: module classes + existing disabled utility class
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 7 completed (`src/components/explorer/ExplorerHeader.tsx`)

Pre-edit parity verification:

- Reviewed active/inactive nav card surfaces, icon badge background, icon accent color, and fixed card width bounds.
- Classified all inline usages as static-migratable.

Changes implemented:

- Added `src/components/explorer/ExplorerHeader.module.css`.
- Migrated active/inactive link surface + border styles to state-based classes.
- Migrated fixed `minWidth`/`maxWidth`, icon wrapper background, and icon color to module classes.
- Removed `colors`/`hexToRgba` imports from the component.

Metrics delta:

- `src/components/explorer/ExplorerHeader.tsx`:
	- `style={{...}}`: **3 → 0**
	- `style=` total: **3 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **55 → 52**
	- `style=` total: **71 → 68**

Post-edit parity verification:

- No compile/diagnostic errors in `ExplorerHeader.tsx` or `ExplorerHeader.module.css`.
- Navigation highlighting and card/icon visual hierarchy preserved.

Difference log entries:

- File: `src/components/explorer/ExplorerHeader.tsx`
- Selector/element: nav cards + icon badge/accent
- Previous inline literal: token-derived active/inactive backgrounds/borders, icon accent color, fixed width bounds
- New class/token value: CSS module state classes (`navCardActive`/`navCardInactive`) plus static utility classes
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 8 completed (`src/components/explorer/ClickableAddress.tsx`)

Pre-edit parity verification:

- Reviewed clickable address accent color and recursive JSON indent behavior.
- Classified styles as mixed:
	- static-migratable: clickable address accent color,
	- runtime-required: recursive `paddingLeft` based on dynamic depth.

Changes implemented:

- Added `src/components/explorer/ClickableAddress.module.css`.
- Migrated clickable address text color to a module class.
- Retained dynamic depth indentation inline styles for recursive JSON rendering.

Metrics delta:

- `src/components/explorer/ClickableAddress.tsx`:
	- `style={{...}}`: **3 → 2**
	- `style=` total: **3 → 2**
- Global snapshot after this file:
	- `style={{...}}`: **52 → 51**
	- `style=` total: **68 → 67**

Post-edit parity verification:

- No compile/diagnostic errors in `ClickableAddress.tsx` or `ClickableAddress.module.css`.
- Address highlighting and recursive indentation behavior preserved.

Difference log entries:

- File: `src/components/explorer/ClickableAddress.tsx`
- Selector/element: clickable address text color
- Previous inline literal: `color: colors.brand.primary`
- New class/token value: `.addressLink { color: var(--brand-primary); }`
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

Runtime exceptions retained:

- File: `src/components/explorer/ClickableAddress.tsx`
- Element: recursive array/object child container indentation
- Inline style: `paddingLeft: \`${depth + 1}rem\``
- Reason: value is depth-dependent at runtime and not representable by a fixed class set without adding complexity.

#### Batch 3 — file 9 completed (`src/components/TransactionPanel.tsx`)

Pre-edit parity verification:

- Reviewed refresh button gradient, primary accent links/text, tx status chip colors, and transaction amount accent color.
- Classified all inline usages as static-migratable (including tx success/failure class toggle).

Changes implemented:

- Added `src/components/TransactionPanel.module.css`.
- Migrated refresh gradient, primary accent text, and status chip success/fail styling to module classes.
- Replaced inline status color object with class toggling (`statusSuccess` / `statusFailed`).
- Removed `colors`/`hexToRgba` imports from component.

Metrics delta:

- `src/components/TransactionPanel.tsx`:
	- `style={{...}}`: **5 → 0**
	- `style=` total: **5 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **51 → 46**
	- `style=` total: **67 → 62**

Post-edit parity verification:

- No compile/diagnostic errors in `TransactionPanel.tsx` or `TransactionPanel.module.css`.
- Refresh/action emphasis and status success/fail visual mapping preserved.

Difference log entries:

- File: `src/components/TransactionPanel.tsx`
- Selector/element: refresh CTA, primary accent links/text, success/fail status chip
- Previous inline literal: token-derived gradient and success/fail color object literals
- New class/token value: module classes + conditional class selection
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 10 completed (`src/components/modals/CryptoPayment/PaymentStatusMonitor.tsx`)

Pre-edit parity verification:

- Reviewed status header surface/border coloring by payment state, icon/text color accents, and BaseScan link color.
- Classified inline usages as static-migratable via finite status-variant class mapping.

Changes implemented:

- Added `src/components/modals/CryptoPayment/PaymentStatusMonitor.module.css`.
- Replaced inline status header, icon, and title color styles with variant classes (`warning`, `primary`, `success`, `danger`).
- Replaced inline BaseScan link color with class-based token styling.
- Removed direct `colorConfig` dependency from this component.

Metrics delta:

- `src/components/modals/CryptoPayment/PaymentStatusMonitor.tsx`:
	- `style={{...}}`: **5 → 0**
	- `style=` total: **5 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **46 → 41**
	- `style=` total: **62 → 57**

Post-edit parity verification:

- No compile/diagnostic errors in `PaymentStatusMonitor.tsx` or `PaymentStatusMonitor.module.css`.
- Status-dependent visual feedback and processing flow UI preserved.

Difference log entries:

- File: `src/components/modals/CryptoPayment/PaymentStatusMonitor.tsx`
- Selector/element: status header, icon/title accents, BaseScan link accent
- Previous inline literal: runtime status-color literals (including alpha-composed background)
- New class/token value: finite variant class mapping with token-backed `color-mix(...)`
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 11 completed (`src/components/modals/CryptoPayment/PaymentDisplay.tsx`)

Pre-edit parity verification:

- Reviewed copy-button default/copied state coloring and transition behavior.
- Classified inline usage as static-migratable via finite state class toggle.

Changes implemented:

- Added `src/components/modals/CryptoPayment/PaymentDisplay.module.css`.
- Migrated copy button inline style object to state-based classes (`copyButtonDefault` / `copyButtonCopied`).
- Removed direct `colorConfig` dependency from the component.

Metrics delta:

- `src/components/modals/CryptoPayment/PaymentDisplay.tsx`:
	- `style={{...}}`: **1 → 0**
	- `style=` total: **1 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **41 → 40**
	- `style=` total: **57 → 56**

Post-edit parity verification:

- No compile/diagnostic errors in `PaymentDisplay.tsx` or `PaymentDisplay.module.css`.
- Copy button visual feedback and copied-state behavior preserved.

Difference log entries:

- File: `src/components/modals/CryptoPayment/PaymentDisplay.tsx`
- Selector/element: payment-address copy button state colors
- Previous inline literal: copied/default background color object
- New class/token value: module class toggle (`copyButtonCopied` / `copyButtonDefault`)
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 12 completed (`src/components/modals/CryptoPayment/CurrencySelector.tsx`)

Pre-edit parity verification:

- Reviewed selected-currency card emphasis (border + background tint) and unselected card behavior.
- Classified inline style as static-migratable via selected-state class toggle.

Changes implemented:

- Added `src/components/modals/CryptoPayment/CurrencySelector.module.css`.
- Migrated selected-card inline style object to a class (`selectedCurrency`) applied only when selected.
- Removed direct `colorConfig` dependency from component.

Metrics delta:

- `src/components/modals/CryptoPayment/CurrencySelector.tsx`:
	- `style={{...}}`: **1 → 0**
	- `style=` total: **1 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **40 → 40**
	- `style=` total: **56 → 55**

Post-edit parity verification:

- No compile/diagnostic errors in `CurrencySelector.tsx` or `CurrencySelector.module.css`.
- Selected/unselected card visual hierarchy preserved.

Difference log entries:

- File: `src/components/modals/CryptoPayment/CurrencySelector.tsx`
- Selector/element: selected currency card border/background emphasis
- Previous inline literal: token-derived selected-state style object
- New class/token value: module class toggle (`selectedCurrency`)
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 13 completed (`src/pages/Dashboard.tsx`, final inline cleanup)

Pre-edit parity verification:

- Reviewed remaining seed-phrase copy button state styling in new-wallet modal.
- Classified remaining inline usage as static-migratable via copied-state class toggle.

Changes implemented:

- Added `seedPhraseCopyDefault` and `seedPhraseCopySuccess` classes in `src/pages/Dashboard.module.css`.
- Replaced last inline `style` object in `Dashboard.tsx` with conditional module class selection based on `seedPhraseCopied`.

Metrics delta:

- `src/pages/Dashboard.tsx`:
	- `style={{...}}`: **1 → 0**
	- `style=` total: **1 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **40 → 39**
	- `style=` total: **55 → 54**

Post-edit parity verification:

- No compile/diagnostic errors in `Dashboard.tsx` or `Dashboard.module.css`.
- Seed-phrase copy button visual feedback and copied-state behavior preserved.

Difference log entries:

- File: `src/pages/Dashboard.tsx`
- Selector/element: seed phrase copy button state styles
- Previous inline literal: conditional background/border object
- New class/token value: module class toggle (`seedPhraseCopyDefault` / `seedPhraseCopySuccess`)
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 14 completed (`src/pages/TestSigningPage.tsx`, final inline cleanup)

Pre-edit parity verification:

- Reviewed remaining initialization CTA gradient states and test-result card status border variants.
- Classified remaining inline usages as static-migratable via finite state class toggles.

Changes implemented:

- Added `initializeButtonReady`, `initializeButtonLoading`, `testResultCard`, `testResultSuccess`, `testResultError`, and `testResultPending` to `src/pages/TestSigningPage.module.css`.
- Replaced remaining inline style objects in `TestSigningPage.tsx` with CSS module state class selection.
- Removed now-unused `colorConfig` imports from component.

Metrics delta:

- `src/pages/TestSigningPage.tsx`:
	- `style={{...}}`: **2 → 0**
	- `style=` total: **2 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **39 → 37**
	- `style=` total: **54 → 52**

Post-edit parity verification:

- No compile/diagnostic errors in `TestSigningPage.tsx` or `TestSigningPage.module.css`.
- Initialize button state visuals and result-card status emphasis preserved.

Difference log entries:

- File: `src/pages/TestSigningPage.tsx`
- Selector/element: initialization CTA and test result status cards
- Previous inline literal: conditional gradients + status border object
- New class/token value: module class toggles for loading/ready and success/error/pending states
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 15 completed (`src/test-sdk.tsx`)

Pre-edit parity verification:

- Reviewed standalone SDK test utility view container spacing, success/error heading color, and pre/instructions block surfaces.
- Classified all inline usages as static-migratable (finite success/error state class toggle).

Changes implemented:

- Added `src/test-sdk.module.css`.
- Migrated all inline styles in `src/test-sdk.tsx` to CSS module classes.
- Replaced heading color inline ternary with class toggle (`statusSuccess` / `statusError`).

Metrics delta:

- `src/test-sdk.tsx`:
	- `style={{...}}`: **5 → 0**
	- `style=` total: **5 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **37 → 32**
	- `style=` total: **52 → 47**

Post-edit parity verification:

- No compile/diagnostic errors in `test-sdk.tsx` or `test-sdk.module.css`.
- SDK test utility rendering and status signaling preserved.

Difference log entries:

- File: `src/test-sdk.tsx`
- Selector/element: container/section/pre blocks and success-error heading state
- Previous inline literal: fixed spacing/background literals + heading color ternary
- New class/token value: CSS module classes with state class toggle
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — file 16 completed (`src/components/BuyChipsButton.tsx`)

Pre-edit parity verification:

- Reviewed enabled/disabled button visuals (gradient vs muted background), cursor, and opacity behavior.
- Classified inline style as static-migratable via finite enabled/disabled class toggle.

Changes implemented:

- Added `src/components/BuyChipsButton.module.css`.
- Migrated inline style object to state classes (`topUpEnabled` / `topUpDisabled`).
- Removed direct `colorConfig` dependency from component.

Metrics delta:

- `src/components/BuyChipsButton.tsx`:
	- `style={{...}}`: **1 → 0**
	- `style=` total: **1 → 0**
- Global snapshot after this file:
	- `style={{...}}`: **32 → 31**
	- `style=` total: **47 → 46**

Post-edit parity verification:

- No compile/diagnostic errors in `BuyChipsButton.tsx` or `BuyChipsButton.module.css`.
- Enabled/disabled CTA behavior and visual emphasis preserved.

Difference log entries:

- File: `src/components/BuyChipsButton.tsx`
- Selector/element: top-up CTA enabled/disabled state styles
- Previous inline literal: conditional gradient/background + cursor + opacity object
- New class/token value: module class toggle (`topUpEnabled` / `topUpDisabled`)
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Remap checkpoint — full inventory refresh (2026-02-24)

Fresh global metrics (from current `src/**/*.tsx` scan):

- Baseline `style=` total: **225** → Current: **43** (**-182**, **80.9% reduction**)
- Baseline `style={{...}}` total: **167** → Current: **31** (**-136**, **81.4% reduction**)
- Baseline TSX files with inline styles: **42** → Current: **21** (**-21**, **50.0% reduction**)

Scan note:

- Prior broad `style=` token search included `cardBackStyle=` prop names in table components; those are not inline-style attributes and are excluded from this corrected snapshot.

Remaining inline-style file map (all files currently matching `style=`):

- `src/pages/explorer/TransactionPage.tsx` — **1** (`style={{...}}`: 1) — runtime-required
- `src/components/TableList.tsx` — **2** (`style={{...}}`: 0) — static-migratable candidate (shared button gradient)
- `src/components/common/Modal.tsx` — **2** (`style={{...}}`: 2) — runtime-required
- `src/components/common/AnimatedBackground.tsx` — **3** (`style={{...}}`: 0) — runtime-required
- `src/components/common/LoadingPokerIcon.tsx` — **5** (`style={{...}}`: 5) — runtime-required (size-driven)
- `src/components/explorer/ClickableAddress.tsx` — **2** (`style={{...}}`: 2) — runtime-required exception (depth indentation)
- `src/components/cosmos/CosmosStatus.tsx` — **2** (`style={{...}}`: 0) — mixed/static-migratable candidate
- `src/components/playPage/Players/OppositePlayer.tsx` — **3** (`style={{...}}`: 3) — runtime-required
- `src/components/playPage/Players/VacantPlayer.tsx` — **3** (`style={{...}}`: 1) — mixed
- `src/components/playPage/Players/PlayerPopUpCard.tsx` — **1** (`style={{...}}`: 0) — runtime-required
- `src/components/playPage/Players/PlayerCard.tsx` — **1** (`style={{...}}`: 1) — runtime-required
- `src/components/playPage/Animations/WinAnimation.tsx` — **2** (`style={{...}}`: 2) — mixed
- `src/components/playPage/Table.tsx` — **2** (`style={{...}}`: 2) — runtime-required
- `src/components/playPage/Animations/TurnAnimation.tsx` — **1** (`style={{...}}`: 1) — runtime-required
- `src/components/playPage/SitAndGoWaitingModal.tsx` — **4** (`style={{...}}`: 4) — mixed
- `src/components/playPage/Players/Player.tsx` — **2** (`style={{...}}`: 0) — runtime-required
- `src/components/depositComponents/DepositProgressBar.tsx` — **1** (`style={{...}}`: 1) — runtime-required
- `src/components/Footer/RaiseSlider.tsx` — **1** (`style={{...}}`: 1) — runtime-required
- `src/components/playPage/common/Badge.tsx` — **3** (`style={{...}}`: 3) — runtime-required
- `src/components/playPage/common/ProgressBar.tsx` — **1** (`style={{...}}`: 1) — runtime-required
- `src/components/playPage/Table/components/TableStatusMessages.tsx` — **1** (`style={{...}}`: 1) — runtime-required

Targeted next-pass candidates from this refresh:

1. `src/components/TableList.tsx` (2)
2. `src/components/cosmos/CosmosStatus.tsx` (2)
3. `src/components/playPage/SitAndGoWaitingModal.tsx` (static animation-delay literals)
4. `src/components/playPage/Players/VacantPlayer.tsx` (disabled-state class toggle)
5. `src/components/playPage/Animations/WinAnimation.tsx` (re-check static vs runtime split)

#### Batch 3 — files 17-19 completed (`TableList`, `CosmosStatus`, `SitAndGoWaitingModal`)

Pre-edit parity verification:

- Re-checked button/state visuals and runtime dependencies in all 3 targets.
- Confirmed migration scope:
	- `TableList.tsx`: static-migratable button gradient styles.
	- `CosmosStatus.tsx`: static-migratable container + non-mainnet dot styles.
	- `SitAndGoWaitingModal.tsx`: static-migratable bounce delay literals; keep runtime progress width inline.

Changes implemented:

- Added `src/components/TableList.module.css` and migrated shared CTA gradient to `.actionButton`.
- Added `src/components/cosmos/CosmosStatus.module.css` and migrated container/dot styling to `.container` and `.dot`.
- Added `src/components/playPage/SitAndGoWaitingModal.module.css` and migrated fixed `animationDelay` literals to delay classes.
- Removed now-unused inline style objects from TSX files.

Metrics delta:

- `src/components/TableList.tsx`:
	- `style={{...}}`: **0 → 0**
	- `style=` total: **2 → 0**
- `src/components/cosmos/CosmosStatus.tsx`:
	- `style={{...}}`: **0 → 0**
	- `style=` total: **2 → 0**
- `src/components/playPage/SitAndGoWaitingModal.tsx`:
	- `style={{...}}`: **4 → 1**
	- `style=` total: **4 → 1**
- Global snapshot after these files:
	- `style={{...}}`: **31 → 28**
	- `style=` total: **43 → 36**
	- TSX files with inline styles: **21 → 19**

Post-edit parity verification:

- No compile/diagnostic errors in touched TSX/CSS module files.
- Visual parity preserved for table action CTAs and Cosmos status pill.
- Sit-and-go loader dots retain staggered animation; runtime progress width remains inline by design.

Runtime exceptions retained:

- `src/components/playPage/SitAndGoWaitingModal.tsx` progress-fill width (`style={{ width: ... }}`) kept inline as runtime-required.

Difference log entries:

- File: `src/components/TableList.tsx`
- Selector/element: Retry/Join action buttons
- Previous inline literal: gradient background via `buttonStyle`
- New class/token value: `.actionButton` using `var(--brand-primary)` + `color-mix(...)`
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

- File: `src/components/cosmos/CosmosStatus.tsx`
- Selector/element: status pill container and non-mainnet dot
- Previous inline literal: `hexToRgba(colors.ui.bgDark, 0.6)` + brand alpha border + brand dot color
- New class/token value: CSS module classes with theme tokens (`--ui-bg-dark`, `--brand-primary`)
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

- File: `src/components/playPage/SitAndGoWaitingModal.tsx`
- Selector/element: waiting indicator bounce dot delays
- Previous inline literal: `animationDelay` at `0ms/150ms/300ms`
- New class/token value: `.waitingDotDelay0/.waitingDotDelay150/.waitingDotDelay300`
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Batch 3 — files 20-21 completed (`WinAnimation`, `VacantPlayer`)

Pre-edit parity verification:

- Reviewed `WinAnimation` bubble icon styling and confirmed bubble background image is static across all list items.
- Reviewed `VacantPlayer` confirm-button disabled appearance and confirmed inline style was finite-state and class-toggle safe.

Changes implemented:

- `src/components/playPage/Animations/WinAnimation.tsx`
	- Removed static inline `backgroundImage` from bubble list items.
	- Moved bubble image styling into `src/components/playPage/Animations/WinAnimation.css`.
- `src/components/playPage/Players/VacantPlayer.tsx`
	- Replaced disabled-state inline style object with CSS module toggle class.
	- Added `.confirmButtonDisabled` to `src/components/playPage/Players/VacantPlayer.module.css`.

Metrics delta:

- `src/components/playPage/Animations/WinAnimation.tsx`:
	- `style={{...}}`: **2 → 1**
	- `style=` total: **2 → 1**
- `src/components/playPage/Players/VacantPlayer.tsx`:
	- `style={{...}}`: **1 → 0**
	- `style=` total: **3 → 2**
- Global snapshot after these files:
	- `style={{...}}`: **28 → 26**
	- `style=` total: **36 → 34**
	- TSX files with inline styles: **19 → 19**

Post-edit parity verification:

- No compile/diagnostic errors in touched TSX/CSS files.
- Winner animation visual behavior preserved (runtime positioning still inline; bubble icon rendering unchanged).
- Vacant seat buy-in confirm disabled visual state preserved via class toggle.

Runtime exceptions retained:

- `src/components/playPage/Animations/WinAnimation.tsx`: runtime winner position (`left/top`) remains inline.
- `src/components/playPage/Players/VacantPlayer.tsx`: runtime seat/popup coordinates remain inline.

Difference log entries:

- File: `src/components/playPage/Animations/WinAnimation.tsx`
- Selector/element: bubble icon list items
- Previous inline literal: `backgroundImage: url(DollarChip)`
- New class/token value: CSS-based `background-image` in `WinAnimation.css`
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

- File: `src/components/playPage/Players/VacantPlayer.tsx`
- Selector/element: confirm button disabled styling
- Previous inline literal: `{ opacity: exceedsBalance ? 0.5 : 1, cursor: exceedsBalance ? "not-allowed" : "pointer" }`
- New class/token value: CSS module class toggle `.confirmButtonDisabled`
- Parity status: `exact`
- Impact: `none`
- Action: `accepted`

#### Full workspace re-audit checkpoint (2026-02-24)

Scope re-verified:

- Re-scanned full frontend source workspace (`src/**/*.{tsx,jsx,ts,js}`) for `style=` and `style={{...}}`.
- Re-reviewed each remaining file to confirm runtime-only exception status.

Current global metrics:

- Baseline `style=` total: **225** → Current: **34** (**-191**, **84.9% reduction**)
- Baseline `style={{...}}` total: **167** → Current: **26** (**-141**, **84.4% reduction**)
- Baseline TSX files with inline styles: **42** → Current: **19** (**-23**, **54.8% reduction**)

Additional cleanup completed in this re-audit pass:

- `src/components/playPage/Players/Player.tsx`
	- Removed static transition from inline position object; moved to shared class.
- `src/components/playPage/Players/OppositePlayer.tsx`
	- Removed static transition and popup translate transform from inline objects; moved to class-based styling.
- `src/components/playPage/Players/VacantPlayer.tsx`
	- Removed static popup translate transform from inline object; moved to class-based styling.
- `src/components/playPage/common/ProgressBar.tsx`
	- Removed static inline color from progress-fill style object; retained runtime width inline and switched color via class toggle.
- `src/components/playPage/Players/PlayersCommon.module.css`
	- Added shared `.positionTransition` class for seat-position animations.

Metrics delta for this pass:

- `style={{...}}`: **26 → 26**
- `style=` total: **34 → 34**
- TSX files with inline styles: **19 → 19**

Note:

- No count reduction in this pass because style attributes remain runtime-required, but static literals were removed from inline objects to align with runtime-only exception policy.

Remaining runtime-only exception files (full workspace):

- `src/pages/explorer/TransactionPage.tsx`
- `src/components/common/Modal.tsx`
- `src/components/common/AnimatedBackground.tsx`
- `src/components/common/LoadingPokerIcon.tsx`
- `src/components/depositComponents/DepositProgressBar.tsx`
- `src/components/explorer/ClickableAddress.tsx`
- `src/components/playPage/Animations/TurnAnimation.tsx`
- `src/components/playPage/Animations/WinAnimation.tsx`
- `src/components/playPage/Table.tsx`
- `src/components/playPage/Table/components/TableStatusMessages.tsx`
- `src/components/playPage/Players/Player.tsx`
- `src/components/playPage/Players/OppositePlayer.tsx`
- `src/components/playPage/Players/VacantPlayer.tsx`
- `src/components/playPage/Players/PlayerCard.tsx`
- `src/components/playPage/Players/PlayerPopUpCard.tsx`
- `src/components/playPage/SitAndGoWaitingModal.tsx`
- `src/components/playPage/common/Badge.tsx`
- `src/components/playPage/common/ProgressBar.tsx`
- `src/components/Footer/RaiseSlider.tsx`

Post-edit parity verification:

- No compile/diagnostic errors in touched files for this pass.
- Runtime-only behavior (positioning, progress width, dynamic status colors) preserved.

#### Final runtime exception registry (normalized, 2026-02-24)

All remaining inline styles are retained as runtime exceptions after full-workspace re-audit.

1. `src/pages/explorer/TransactionPage.tsx`
   - Runtime reason: transaction status-dependent success/failure color.
2. `src/components/common/Modal.tsx`
   - Runtime reason: `titleDividerColor` prop drives icon + gradient divider color.
3. `src/components/common/AnimatedBackground.tsx`
   - Runtime reason: animated gradient values derived from live mouse position.
4. `src/components/common/LoadingPokerIcon.tsx`
   - Runtime reason: component `size` prop drives container size and suit glyph font size.
5. `src/components/depositComponents/DepositProgressBar.tsx`
   - Runtime reason: progress-fill width is live percentage.
6. `src/components/explorer/ClickableAddress.tsx`
   - Runtime reason: recursive JSON depth drives indentation (`paddingLeft`).
7. `src/components/playPage/Animations/TurnAnimation.tsx`
   - Runtime reason: live seat-position coordinates (`left/top`).
8. `src/components/playPage/Animations/WinAnimation.tsx`
   - Runtime reason: live winner seat-position coordinates (`left/top`).
9. `src/components/playPage/Table.tsx`
   - Runtime reason: live table transform and chip coordinate positioning.
10. `src/components/playPage/Table/components/TableStatusMessages.tsx`
	- Runtime reason: viewport/orientation-dependent top offset.
11. `src/components/playPage/Players/Player.tsx`
	- Runtime reason: live seat coordinates + runtime winner/player status color.
12. `src/components/playPage/Players/OppositePlayer.tsx`
	- Runtime reason: live seat/popup coordinates + runtime winner/player status color.
13. `src/components/playPage/Players/VacantPlayer.tsx`
	- Runtime reason: live seat/popup coordinates.
14. `src/components/playPage/Players/PlayerCard.tsx`
	- Runtime reason: runtime player color prop.
15. `src/components/playPage/Players/PlayerPopUpCard.tsx`
	- Runtime reason: runtime player color prop for seat badge.
16. `src/components/playPage/SitAndGoWaitingModal.tsx`
	- Runtime reason: progress-fill width from joined/max player count.
17. `src/components/playPage/common/Badge.tsx`
	- Runtime reason: runtime action/player/status color mapping.
18. `src/components/playPage/common/ProgressBar.tsx`
	- Runtime reason: live timer width percentage.
19. `src/components/Footer/RaiseSlider.tsx`
	- Runtime reason: value-driven slider fill gradient.

#### Final parity + refactor validation summary (2026-02-24)

- Static-to-class migration policy remained enforced: no static visual regressions intentionally introduced.
- Runtime-only exception policy verified by line-level re-scan and file-by-file classification.
- Build validation: `yarn build` passes.
- Lint validation: `yarn lint` returns warnings only (0 errors); warnings are pre-existing/non-blocking for this styling migration.
- Final metrics (full workspace):
  - `style=`: **34** (from **225**)
  - `style={{...}}`: **26** (from **167**)
  - TSX files with inline styles: **19** (from **42**)
- Result: migration remains on-track and consistent with Phase 2 acceptance criteria, with remaining inline styles normalized as approved runtime exceptions.

#### CSS value parity verification against colorConfig (2026-02-24)

Token source of truth (default env fallback values):

- `--brand-primary`: `#3b82f6`
- `--brand-secondary`: `#1a2639`
- `--accent-success`: `#10b981`
- `--accent-danger`: `#ef4444`
- `--accent-warning`: `#f59e0b`
- `--accent-glow`: `#64ffda`
- `--ui-bg-dark`: `#1f2937`
- `--ui-bg-medium`: `#374151`

Exact parity (value-equivalent or token-equivalent):

- `src/components/Footer.css`
	- Status: `exact`
	- Evidence: gradients/borders/shadows mapped to `--brand-*`, `--accent-*`, `--ui-*` + `color-mix(...)` alpha forms.
- `src/components/common/Modal.module.css` and `src/components/playPage/Players/VacantPlayer.module.css`
	- Status: `exact`
	- Evidence: prior hex-alpha literals represented by matching `color-mix(...)` percentages (`12.5%`, `50.2%`, `18.8%`, `25.1%`).

Non-exact parity (requires explicit sign-off before token forcing):

- `src/components/playPage/Table.css` `.text-glow`
	- Previous literal basis: `#4299e1` alpha glow.
	- Current token mapping: `var(--brand-primary)` (`#3b82f6`) alpha glow.
	- Status: `non-exact` (hue shift), tracked for design/product sign-off.
- `src/components/playPage/Table.css` `.sit-out-toggle*`
	- Current literals: `#f97316`, `#fb923c`, `rgba(249, 115, 22, 0.3)`.
	- Closest token: `--accent-warning` (`#f59e0b`).
	- Status: `non-exact`, intentionally retained pending sign-off.
- `src/components/playPage/common/Badge.css` `.timer-extension-button` base
	- Current literal: `#2563eb` (hover uses `#3b82f6`).
	- Closest token: `--brand-primary` (`#3b82f6`).
	- Status: `non-exact` for base state; retained pending sign-off.
- `src/components/playPage/common/Badge.css` `.tournament-payout-win`
	- Current literal: `#4ade80`.
	- Closest token: `--accent-success` (`#10b981`).
	- Status: `non-exact`; retained pending sign-off.

Intentional semantic hardcoded colors (not tokenized in this phase):

- `src/components/playPage/common/Badge.css` tournament medal styles (`#ffd700`, `#c0c0c0`, `#cd7f32`, etc.).
- Status: intentionally retained as semantic rank palette, outside Phase 2 runtime-inline migration scope.

Conclusion of value-based parity check:

- Runtime-inline refactor is correct and on policy.
- CSS tokenization parity is exact where adopted for migration surfaces.
- Remaining non-exact or semantic literals are explicitly documented and isolated for sign-off decisions, not accidental regressions.

### Mandatory parity workflow (applies to every Phase 2 batch)

For each file before any migration edits:

1. Verify current visual behavior/state variants in TSX + CSS pair.
2. Identify inline style blocks to migrate and tag each as:
	- Runtime-required (keep inline), or
	- Static-migratable (move to CSS Module).
3. Map each static style to an equivalent class/token value and ensure output parity.

For each file after migration edits:

1. Re-verify visual parity against pre-migration behavior (normal, hover, active, disabled, responsive states).
2. Confirm runtime-only inline exceptions still behave correctly.
3. Document any non-exact token parity (if literal-to-token substitution changes hue/alpha/etc).

### Per-batch documentation requirements

Each batch update in this audit must include:

- Files touched.
- Inline-style count delta (`style=` and `style={{...}}`) for touched files.
- Runtime exceptions retained (with reason).
- Visual/token differences introduced (if any), with explicit sign-off status.

### Difference log template (use per file when parity is not exact)

- File: `<path>`
- Selector/element: `<selector or element description>`
- Previous inline literal: `<value>`
- New class/token value: `<value>`
- Parity status: `exact` | `non-exact`
- Impact: `<none/minor/visible>`
- Action: `accepted` | `needs design sign-off` | `reverted to parity`

### Acceptance criteria for Phase 2

- Full inline-style audit completed with classification notes.
- All static inline styles in touched files moved to CSS Modules.
- Remaining inline styles are runtime-only and documented as approved exceptions.
- No new hardcoded colors introduced in touched files.
- Lint/build pass with no new errors.
- Documentation includes before/after counts + exception list + deferred decisions.

### Definition of done for Phase 2

- Inline style usage is reduced to runtime-only exceptions for scoped files.
- Styling standards are consistently applied in all newly touched code.
- Documentation and metrics are complete and review-ready.

## Acceptance criteria (refined)

1. Single architecture documented and followed: CSS Modules + Tailwind + CSS variables.
2. Static visual styles in touched files are migrated out of inline styles.
3. Runtime-only inline styles are the only exceptions.
4. New/updated colors in touched files use CSS variables.
5. Theme switching remains correct after each migration wave.
6. Styling standards are documented in repository docs.

## PR enforcement checklist

- [x] No new static `style={{...}}` blocks added (Wave 1 touched files)
- [x] Static inline styles in touched files are migrated (Wave 1)
- [x] Runtime inline styles are justified by live-state requirements (Wave 1)
- [x] New/updated colors use CSS variables (Wave 1)
- [x] Responsive behavior and functionality are preserved (Wave 1)
