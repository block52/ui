/**
 * Footer component type definitions
 *
 * This file contains all prop types for the poker action panel and its sub-components.
 */

import { PlayerStatus, TexasHoldemRound, ActionDTO } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";

// ============================================================================
// BASE BUTTON TYPES
// ============================================================================

/**
 * Common props for action buttons
 */
export interface BaseButtonProps {
    loading: boolean;
    disabled: boolean;
    onClick: () => void;
}

/**
 * Button variant options
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "success";

// ============================================================================
// ACTION BUTTON PROPS
// ============================================================================

/**
 * Props for ActionButton component
 */
export interface ActionButtonProps {
    action: string;
    label: string;
    amount?: string;
    icon?: React.ReactNode;
    variant?: ButtonVariant;
    loading?: boolean;
    disabled?: boolean;
    onClick: () => void;
    className?: string;
}

/**
 * Props for FoldButton component
 */
export interface FoldButtonProps {
    loading: boolean;
    disabled: boolean;
    isMobileLandscape?: boolean;
    onClick: () => void;
}

// ============================================================================
// PANEL PROPS
// ============================================================================

/**
 * Props for PokerActionPanel component
 */
export interface PokerActionPanelProps {
    tableId: string;
    network: NetworkEndpoints;
    onTransactionSubmitted?: (txHash: string | null) => void;
}

// ============================================================================
// BUTTON GROUP PROPS
// ============================================================================

/**
 * Props for DealButtonGroup component
 */
export interface DealButtonGroupProps {
    tableId: string;
    onDeal: (entropy: string) => Promise<void>;
    loading: boolean;
    disabled: boolean;
    /** When true, hides the "Show Entropy" button since deal happens automatically */
    autoDealEnabled?: boolean;
}

/**
 * Props for ShowdownButtons component
 */
export interface ShowdownButtonsProps {
    canMuck: boolean;
    canShow: boolean;
    loading: string | null;
    onMuck: () => void;
    onShow: () => void;
}

/**
 * Props for BlindButtonGroup component
 */
export interface BlindButtonGroupProps {
    showSmallBlind: boolean;
    showBigBlind: boolean;
    smallBlindAmount: string;
    bigBlindAmount: string;
    canFold: boolean;
    playerStatus: PlayerStatus;
    loading: string | null;
    isMobileLandscape: boolean;
    onPostSmallBlind: () => void;
    onPostBigBlind: () => void;
    onFold: () => void;
}

/**
 * Props for MainActionButtons component
 */
export interface MainActionButtonsProps {
    canFold: boolean;
    canCheck: boolean;
    canCall: boolean;
    callAmount: string;
    canBet: boolean;
    canRaise: boolean;
    raiseAmount: number;
    isRaiseAmountInvalid: boolean;
    playerStatus: PlayerStatus;
    loading: string | null;
    isMobileLandscape: boolean;
    currentRound: TexasHoldemRound;
    previousActions: ActionDTO[];
    userAddress: string;
    isAllIn: boolean;
    onFold: () => void;
    onCheck: () => void;
    onCall: () => void;
    onBetOrRaise: () => void;
}

// ============================================================================
// BET/RAISE CONTROL PROPS
// ============================================================================

/**
 * Props for RaiseBetControls component
 */
export interface RaiseBetControlsProps {
    amount: number;
    minAmount: number;
    maxAmount: number;
    formattedMaxAmount: string;
    step: number;
    totalPotMicro: bigint;
    callAmountMicro: bigint;
    isInvalid: boolean;
    isMobileLandscape: boolean;
    currentRound: TexasHoldemRound;
    previousActions: ActionDTO[];
    disabled: boolean;
    onAmountChange: (amount: number) => void;
    onIncrement: () => void;
    onDecrement: () => void;
    onAllIn: () => void;
}

/**
 * Props for RaiseSlider component
 */
export interface RaiseSliderProps {
    value: number;
    min: number;
    max: number;
    step: number;
    formattedMax: string;
    isInvalid: boolean;
    disabled: boolean;
    isMobileLandscape: boolean;
    onChange: (value: number) => void;
    onIncrement: () => void;
    onDecrement: () => void;
}

/**
 * Props for PotSizedBetButtons component
 */
export interface PotSizedBetButtonsProps {
    totalPotMicro: bigint;
    callAmountMicro: bigint;
    minAmount: number;
    maxAmount: number;
    currentRound: TexasHoldemRound;
    previousActions: ActionDTO[];
    disabled: boolean;
    onAmountSelect: (amount: number) => void;
    onAllIn: () => void;
}
