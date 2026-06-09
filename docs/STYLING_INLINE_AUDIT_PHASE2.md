# Styling Inline Audit — Phase 2

This document is the condensed Phase 2 source of truth for review and PR handoff.

Detailed per-file logs were preserved at:
- src/docs/STYLING_INLINE_AUDIT_PHASE2_DETAILED_LOG_2026-02-24.md

Companion PR summary:
- src/docs/STYLING_INLINE_AUDIT_PHASE2_PR_READY.md

## Outcome at a glance

- Phase 2 objective achieved: static inline styles were migrated to CSS Modules or class-based styling across scoped files.
- Remaining inline styles are runtime-only exceptions and are documented with reasons.
- Visual parity checks were performed throughout migration batches.
- Build passed and lint was warnings-only at last full validation.

## Baseline vs final metrics

Baseline (Phase 2 kickoff)
- style=: 225
- style={{...}}: 167
- TSX files with inline styles: 42

Final (full workspace re-audit)
- style=: 30
- style={{...}}: 24
- TSX files with inline styles: 17

Net reduction
- style=: -195 (86.7%)
- style={{...}}: -143 (85.6%)
- files with inline styles: -25 (59.5%)

## Scope and policy used

In scope
- Audit remaining inline styles in src/**/*.tsx.
- Migrate static visual inline styles to CSS Modules/classes.
- Retain runtime-dependent inline styles only.
- Keep color usage token-driven and parity-aware.

Out of scope
- Visual redesign.
- Feature changes.
- Reworking runtime-only logic that depends on live state.

## Execution rollup by batch

### Batch 1 (highest-density files)

Completed
- src/pages/TestSigningPage.tsx
- src/pages/Dashboard.tsx
- src/components/NetworkSelector.tsx
- src/components/GlobalHeader.tsx
- src/components/common/LoadingPokerIcon.tsx

Result
- Major reduction in high-volume inline style usage.
- Runtime-only inline values retained where size/state depended on live props or data.

### Batch 2 (core components)

Completed
- src/components/ActionsLog.tsx
- src/components/ColorDebug.tsx
- src/components/modals/DealEntropyModal.tsx
- src/components/WalletPanel.tsx
- src/components/playPage/Table.tsx

Result
- Static surfaces, borders, gradients, and text color literals moved to classes.
- Table retained runtime transforms/positions.

### Batch 3 (remaining migrations + cleanup)

Completed
- src/components/Footer/DealButtonGroup.tsx
- src/components/Footer/MainActionButtons.tsx
- src/components/playPage/Table/components/TableBoard.tsx
- src/components/modals/USDCDepositModal.tsx
- src/components/playPage/Table/components/LayoutDebugInfo.tsx
- src/components/modals/LeaveTableModal.tsx
- src/components/explorer/ExplorerHeader.tsx
- src/components/explorer/ClickableAddress.tsx
- src/components/TransactionPanel.tsx
- src/components/modals/CryptoPayment/PaymentStatusMonitor.tsx
- src/components/modals/CryptoPayment/PaymentDisplay.tsx
- src/components/modals/CryptoPayment/CurrencySelector.tsx
- src/pages/Dashboard.tsx (final inline cleanup)
- src/pages/TestSigningPage.tsx (final inline cleanup)
- src/test-sdk.tsx
- src/components/BuyChipsButton.tsx
- src/components/TableList.tsx
- src/components/cosmos/CosmosStatus.tsx
- src/components/playPage/SitAndGoWaitingModal.tsx
- src/components/playPage/Animations/WinAnimation.tsx
- src/components/playPage/Players/VacantPlayer.tsx

Runtime-object purity cleanup
- src/components/playPage/Players/Player.tsx
- src/components/playPage/Players/OppositePlayer.tsx
- src/components/playPage/Players/VacantPlayer.tsx
- src/components/playPage/common/ProgressBar.tsx
- src/components/playPage/Players/PlayersCommon.module.css

Result
- Static literals removed from remaining mixed objects where possible.
- Runtime attributes preserved.

## Runtime exception registry (final)

All remaining inline styles are approved runtime exceptions after full re-audit.

1) src/pages/explorer/TransactionPage.tsx
- Runtime reason: transaction status color mapping.

2) src/components/common/Modal.tsx
- Runtime reason: prop-driven title divider and icon color.

3) src/components/common/AnimatedBackground.tsx
- Runtime reason: mouse-driven animated gradient values.

4) src/components/common/LoadingPokerIcon.tsx
- Runtime reason: size prop drives dimensions and glyph sizing.

5) src/components/depositComponents/DepositProgressBar.tsx
- Runtime reason: live progress-fill width.

6) src/components/explorer/ClickableAddress.tsx
- Runtime reason: recursive depth-driven indentation.

7) src/components/playPage/Animations/TurnAnimation.tsx
- Runtime reason: live seat coordinates.

8) src/components/playPage/Animations/WinAnimation.tsx
- Runtime reason: winner seat coordinates.

9) src/components/playPage/Table.tsx
- Runtime reason: live table transform and chip positioning.

10) src/components/playPage/Table/components/TableStatusMessages.tsx
- Runtime reason: viewport/orientation-dependent offset.

11) src/components/playPage/Players/Player.tsx
- Runtime reason: live seat coordinates and runtime status color.

12) src/components/playPage/Players/OppositePlayer.tsx
- Runtime reason: live seat/popup coordinates and runtime status color.

13) src/components/playPage/Players/VacantPlayer.tsx
- Runtime reason: live seat/popup coordinates.

14) src/components/playPage/SitAndGoWaitingModal.tsx
- Runtime reason: progress width from joined/max players.

15) src/components/playPage/common/Badge.tsx
- Runtime reason: runtime action/player/status color mapping.

16) src/components/playPage/common/ProgressBar.tsx
- Runtime reason: live timer width.

17) src/components/Footer/RaiseSlider.tsx
- Runtime reason: value-driven slider gradient fill.

## Token value parity status

Token source baseline
- Source: src/utils/colorConfig.ts default env fallback values.

Exact parity (tokenized safely)
- src/components/Footer.css
- src/components/common/Modal.module.css
- src/components/playPage/Players/VacantPlayer.module.css

Non-exact parity (requires sign-off before forced token replacement)
- src/components/playPage/Table.css
  - .text-glow (legacy hue vs brand-primary hue)
  - .sit-out-toggle* (orange palette vs accent-warning token)
- src/components/playPage/common/Badge.css
  - .timer-extension-button base
  - .tournament-payout-win

Intentional semantic literals retained
- src/components/playPage/common/Badge.css medal/rank colors.

## Validation summary

- Build: passed at last full validation.
- Lint: warnings-only (0 errors) at last full validation.
- Line-by-line and git-level re-audit performed for final exception normalization.

## Current review status

- Manual visual style review is currently in progress across affected surfaces.
- Any visual parity mismatches identified during manual review are logged for follow-up before final merge approval.

## Pre-PR actions

Required before opening PR
- Re-run yarn lint.
- Re-run yarn build.
- Confirm exception list (17 files) still matches latest scan.
- Ensure non-exact parity items are explicitly called out in PR description.

Recommended hygiene
- Exclude generated artifacts from PR if not needed (for example tsconfig.tsbuildinfo).
- Attach screenshots or short clips for key touched surfaces.
- Use src/docs/STYLING_INLINE_AUDIT_PHASE2_PR_READY.md as the reviewer quick-start.

## Acceptance criteria (final)

- Static inline styles in scoped touched files are migrated.
- Remaining inline styles are runtime-only and documented.
- No intentional behavior or UX redesign introduced.
- Documentation includes before/after metrics, exception registry, and parity decisions.
- Validation is green for build and non-error lint.

## Definition of done

- Phase 2 is complete for migration scope.
- The condensed document is reviewer-oriented.
- Detailed forensic logs remain preserved in the archived log document.
