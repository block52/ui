/**
 * Modal component type definitions
 *
 * This file contains base types and specific props for all modal components.
 * Modals should extend these base types for consistency.
 */

// ============================================================================
// BASE MODAL TYPES
// ============================================================================

/**
 * Base props shared by all modals
 */
export interface BaseModalProps {
    /** Callback when modal is closed */
    onClose: () => void;
}

/**
 * Props for modals with open/close state controlled by parent
 */
export interface ControlledModalProps extends BaseModalProps {
    /** Whether the modal is currently open */
    isOpen: boolean;
}

/**
 * Props for modals that have a success callback
 */
export interface ModalWithSuccessProps extends BaseModalProps {
    /** Callback when action completes successfully */
    onSuccess?: () => void;
}

/**
 * Props for controlled modals with success callback
 */
export interface ControlledModalWithSuccessProps extends ControlledModalProps {
    /** Callback when action completes successfully */
    onSuccess?: () => void;
}

// ============================================================================
// SPECIFIC MODAL PROPS
// ============================================================================

/**
 * Props for DealEntropyModal
 */
export interface DealEntropyModalProps extends BaseModalProps {
    tableId?: string;
    onDeal: (entropy: string) => Promise<void>;
}

/**
 * Props for WithdrawalModal
 */
export type WithdrawalModalProps = ControlledModalWithSuccessProps;

/**
 * Props for LeaveTableModal
 */
export interface LeaveTableModalProps extends ControlledModalProps {
    onConfirm: () => Promise<void>;
    /** Player's current stack in microunits */
    playerStack: string;
    /** Whether player is currently in an active hand */
    isInActiveHand: boolean;
}

/**
 * Props for SitAndGoAutoJoinModal
 */
export interface SitAndGoAutoJoinModalProps {
    tableId: string;
    onJoinSuccess: () => void;
}

/**
 * Props for TopUpModal
 */
export interface TopUpModalProps extends BaseModalProps {
    tableId: string;
    /** Current chips in USDC micro-units */
    currentStack: string;
    /** Min buy-in in USDC micro-units */
    minBuyIn: string;
    /** Max buy-in in USDC micro-units */
    maxBuyIn: string;
    /** Wallet balance in USDC micro-units */
    walletBalance: string;
    /** Callback when top-up is confirmed, amount in USDC micro-units */
    onTopUp: (amount: string) => void;
}

/**
 * Props for USDCDepositModal
 */
export type USDCDepositModalProps = ControlledModalWithSuccessProps;

/**
 * Props for BuyInModal
 */
export interface BuyInModalProps extends BaseModalProps {
    /** Optional tableId for joining specific table */
    tableId?: string;
    /** Optional min buy-in from Dashboard (USDC micro-units) */
    minBuyIn?: string;
    /** Optional max buy-in from Dashboard (USDC micro-units) */
    maxBuyIn?: string;
    /** Seat index (0-8) for the seat being joined */
    seatIndex?: number;
    /** Callback when player joins the table */
    onJoin: (amount: string, waitForBigBlind: boolean) => void;
}

/**
 * Props for DepositCore component
 */
export interface DepositCoreProps {
    onSuccess?: () => void;
    showMethodSelector?: boolean;
}

// ============================================================================
// CRYPTO PAYMENT MODAL PROPS
// ============================================================================

/**
 * Props for PaymentStatusMonitor
 */
export interface PaymentStatusMonitorProps {
    paymentId: string;
    onPaymentComplete?: () => void;
    onStatusChange?: (status: string) => void;
}

/**
 * Props for CurrencySelector
 */
export interface CurrencySelectorProps {
    selectedCurrency: string;
    onCurrencySelect: (currency: string) => void;
}

/**
 * Props for PaymentDisplay
 */
export interface PaymentDisplayProps {
    paymentAddress: string;
    payAmount: number;
    payCurrency: string;
    expiresAt: string;
    priceAmount: number;
}
