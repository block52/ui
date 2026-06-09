# Modal Style Guide

Reference: [#42 — Consistent Modal Styling](https://github.com/block52/ui/issues/42)

---

## 1. Use BaseModal for All New Modals

All modals must extend `<Modal>` from `src/components/common/Modal.tsx`. It provides:

- Backdrop with blur (`bg-black bg-opacity-50 backdrop-blur-sm`)
- Hexagon pattern background
- Decorative card suits
- Escape key to close
- Click-outside to close
- `max-h-[90vh]` + `overflow-y-auto` for scroll safety
- `max-w-[95vw]` so it never exceeds viewport width

```tsx
import { Modal } from "../common/Modal";

<Modal isOpen={isOpen} onClose={onClose} title="My Modal" titleIcon="🎯">
    {/* content */}
</Modal>
```

### BaseModal Props

| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `isOpen` | `boolean` | required | Show/hide |
| `onClose` | `() => void` | required | Close handler |
| `title` | `string` | — | Header text |
| `titleIcon` | `ReactNode` | — | Icon before title |
| `widthClass` | `string` | `"w-96"` | Width (Tailwind class) |
| `isProcessing` | `boolean` | `false` | Disables close during async ops |
| `error` | `string \| null` | — | Error banner |
| `closeOnEscape` | `boolean` | `true` | Escape key support |
| `closeOnBackdropClick` | `boolean` | `true` | Click-outside support |

---

## 2. Mobile Landscape Compact Mode

Modals shown on the table page MUST handle mobile landscape (viewport height ≤ 500px).

### Pattern

```tsx
const isCompact = typeof window !== "undefined" && window.innerHeight <= 500;
```

### Compact Rules

| Element | Desktop | Compact (h ≤ 500px) |
|---------|---------|---------------------|
| Modal padding | `p-6` or `p-8` | `p-3` |
| Modal width | `w-96` | `w-80` |
| Logo / decorative icons | Visible | **Hidden** |
| Title size | `text-2xl` | `text-base` |
| Subtitle | Visible | **Hidden** |
| Spacing between sections | `mb-6`, `space-y-3` | `mb-2`, `space-y-1.5` |
| Info row padding | `p-3` | `p-1.5` or `p-2` |
| Button padding | `py-3` | `py-2` |
| Footer text | Visible | **Hidden** |
| Info layout | Stacked rows | **2-column grid** |

### 2-Column Grid Pattern (for info-heavy modals)

When a modal has 4+ info rows, use a grid in compact mode:

```tsx
{isCompact ? (
    <div className="grid grid-cols-2 gap-1.5 mb-2">
        <div className="bg-gray-700/80 rounded p-1.5 border border-blue-500/30">
            <div className="text-gray-400 text-[10px]">Label</div>
            <div className="text-white text-xs font-semibold">Value</div>
        </div>
        {/* ... more grid items */}
    </div>
) : (
    <div className="space-y-3 mb-6">
        {/* ... stacked rows */}
    </div>
)}
```

---

## 3. Visual Style

### Colors

| Element | Class |
|---------|-------|
| Card background | `bg-gray-800/90 backdrop-blur-md` |
| Info row bg | `bg-gray-700/80` |
| Info row border | `border border-blue-500/30` |
| Success accent | `border-green-500/30`, `text-green-400` |
| Error accent | `border-red-500/30`, `text-red-400` |
| Top accent bar | `bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-pulse` |
| Gradient bg overlay | `bg-gradient-to-br from-blue-600/10 to-purple-600/10` |

### Buttons

| Type | Class |
|------|-------|
| Primary action | `bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600` |
| Disabled | `bg-gray-600 cursor-not-allowed` |
| Destructive | `bg-gradient-to-r from-red-500 to-red-600` |
| Secondary/ghost | `bg-white bg-opacity-10 hover:bg-opacity-20` |

### Typography

| Element | Desktop | Compact |
|---------|---------|---------|
| Modal title | `text-2xl font-bold text-white` | `text-base font-bold text-white` |
| Info label | `text-gray-400 text-sm` | `text-gray-400 text-[10px]` |
| Info value | `text-white font-semibold` | `text-white text-xs font-semibold` |
| Footer text | `text-xs text-gray-400` | Hidden |

---

## 4. Z-Index

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Table modals | `z-50` | Standard modals (buy-in, leave, etc.) |
| Mobile orientation overlay | `z-[9999]` | Portrait blocking (must be above everything) |

---

## 5. Modals Inventory & TODO

### Already Compliant

| Modal | File | Notes |
|-------|------|-------|
| SitAndGoAutoJoinModal | `components/modals/SitAndGoAutoJoinModal.tsx` | Has `isCompact` + 2-col grid |
| LeaveTableModal | `components/modals/LeaveTableModal.tsx` | Uses BaseModal |
| DeleteTableModal | `components/modals/DeleteTableModal.tsx` | Uses BaseModal |
| DealEntropyModal | `components/modals/DealEntropyModal.tsx` | Uses BaseModal |
| TopUpModal | `components/modals/TopUpModal.tsx` | Uses BaseModal |
| MobileOrientationOverlay | `components/playPage/Table/components/MobileOrientationOverlay.tsx` | Portal-rendered |

### TODO — Needs `isCompact` Mobile Handling

| Modal | File | What's Needed |
|-------|------|---------------|
| BuyInModal | `components/modals/BuyInModal.tsx` | Add `isCompact` check, reduce padding/spacing, compact slider |
| SitAndGoWaitingModal | `components/playPage/SitAndGoWaitingModal.tsx` | Add `isCompact`, reduce player progress bar size |
| GameStartCountdown | `components/playPage/common/GameStartCountdown.tsx` | Add `isCompact`, reduce countdown timer size |
| USDCDepositModal | `components/modals/USDCDepositModal.tsx` | Already has `max-h-[90vh]` but needs `isCompact` for tighter layout |
| WithdrawalModal | `components/modals/WithdrawalModal.tsx` | Add `isCompact`, reduce step indicator size |
| SignatureModal | `components/modals/SignatureModal.tsx` | Add `isCompact`, reduce signature display |
| ProfileAvatarModal | `components/profile/ProfileAvatarModal.tsx` | Add `isCompact`, reduce NFT grid size |

### TODO — Should Migrate to BaseModal

| Modal | File | What's Needed |
|-------|------|---------------|
| SitAndGoAutoJoinModal | `components/modals/SitAndGoAutoJoinModal.tsx` | Currently uses custom overlay — migrate to `<Modal>` wrapper |
| SitAndGoWaitingModal | `components/playPage/SitAndGoWaitingModal.tsx` | Currently uses custom overlay — migrate to `<Modal>` wrapper |
| GameStartCountdown | `components/playPage/common/GameStartCountdown.tsx` | Currently uses custom overlay — migrate to `<Modal>` wrapper |
| USDCDepositModal | `components/modals/USDCDepositModal.tsx` | Currently uses custom overlay — migrate to `<Modal>` wrapper |
| WithdrawalModal | `components/modals/WithdrawalModal.tsx` | Currently uses custom overlay — migrate to `<Modal>` wrapper |

---

## 6. Checklist for New Modals

- [ ] Extends `<Modal>` from `components/common/Modal.tsx`
- [ ] Has `isCompact` check for mobile landscape
- [ ] Hides decorative elements (logos, icons) when compact
- [ ] Uses 2-column grid for 4+ info rows when compact
- [ ] Uses correct z-index (`z-50` for standard, `z-[9999]` for blocking)
- [ ] Has `isProcessing` prop to prevent close during async
- [ ] Double quotes, semicolons (per CLAUDE.md)
- [ ] No `any` types
