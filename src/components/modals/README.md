# Modals

This directory contains all modal components used throughout the poker application. The modals are centralized here for better organization and reusability.

## Available Modals

### Game-Related Modals

- **LeaveTableModal** - Confirmation modal for leaving a table
  - Displays current stack
  - Warning for active hands
  - Confirms player intention to leave

- **TopUpModal** - Modal for topping up chips at the table
  - Allows players to add more chips while seated
  - Shows current stack and maximum buy-in
  - Only available when not in an active hand

- **DealEntropyModal** - Modal for adding entropy to card dealing
  - System entropy generation
  - Optional user password for additional entropy
  - Used to ensure fair card distribution

- **SitAndGoAutoJoinModal** - Auto-join modal for Sit & Go tournaments
  - Displays tournament details
  - Shows available seats
  - Automatic seat assignment

### Wallet-Related Modals

- **USDCDepositModal** - Modal for depositing USDC from Ethereum
  - Bridge from Ethereum to game wallet
  - MetaMask integration
  - Network switching support

- **WithdrawalModal** - Modal for withdrawing funds
  - Withdraw from game wallet to MetaMask
  - Displays available balance
  - Requires MetaMask connection

## Usage

All modals can be imported from this directory using the centralized index file:

```typescript
// From a page component (e.g., /pages/Dashboard.tsx)
import { USDCDepositModal, WithdrawalModal } from "../components/modals";

// From a playPage component (e.g., /components/playPage/Table.tsx)
import { LeaveTableModal, TopUpModal } from "../modals";

// From another component in /components (e.g., /components/BuyChipsButton.tsx)
import { TopUpModal } from "./modals";

// Import multiple modals at once
import {
  LeaveTableModal,
  TopUpModal
} from "../components/modals"; // Adjust path based on your file location
```

**Note**: The import path depends on where your importing file is located in the directory structure. Adjust the relative path (`../`, `./`) accordingly.

## Common Props

Most modals follow a similar pattern with these common props:

- `isOpen?: boolean` - Controls modal visibility (some use manual mounting)
- `onClose: () => void` - Callback to close the modal
- `onSuccess?: () => void` - Optional callback on successful action
- `tableId?: string` - The ID of the current table (if applicable)

## Shared building blocks

Build new modals from these instead of restyling:

- **`Modal`** (`components/common/Modal.tsx`) - the shell. Escape, backdrop and the X are inert while `isProcessing`; `hideCloseButton` removes the X for flows where closing would lose data; `ariaLabel` names a dialog that has no `title`. Focus moves in on open (put `data-autofocus=""` on the control that should take it), Tab is trapped, and focus returns to the trigger on close.
- **`ModalFooter`** - sticky action row; render it last so `Modal` drops its own bottom padding.
- **`ConfirmDialog`** - in-app `window.confirm()`; Cancel has initial focus.
- **`AmountPresets`** - quick-amount pills (built on `ChoicePill` from `components/ui`).
- **`walletFormClasses`** / **`walletIcons`** - field, input, notice and option-card classes and icons shared by Deposit, Withdraw and Send.
- **`components/ui`** - `PillButton`, `ChoicePill`, `SegmentedControl`, `Card`, `PageTabs`, `StatStrip`, `ThemeToggle`, and `focusRing`.
- **Tokens** - colours come from `src/styles/theme.css` through Tailwind (`bg-surface-card`, `text-ink`, `border-line`); see `docs/THEMING.md`. Modals follow light and dark mode; the table page is always dark.

## Styling

- Theme tokens, not raw hex (see above)
- Backdrop blur, bottom sheet on phones
- Hexagon pattern is opt-in (`showHexagonPattern`)
- Responsive design with Tailwind CSS

## Notes

- Modals are mounted/unmounted rather than shown/hidden for performance
- Some modals use `createPortal` for rendering in specific DOM locations
- All modals handle loading and error states internally
