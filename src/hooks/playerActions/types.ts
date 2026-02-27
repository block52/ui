import { LegalActionDTO, PlayerStatus } from "@block52/poker-vm-sdk";
import { BaseHookReturn } from "../../types/index";

export interface PlayerLegalActionsResult extends BaseHookReturn {
    legalActions: LegalActionDTO[];
    isSmallBlindPosition: boolean;
    isBigBlindPosition: boolean;
    isDealerPosition: boolean;
    isPlayerTurn: boolean;
    playerStatus: PlayerStatus | null;
    playerSeat: number | null;
    sitInMethod: string | null;
    pendingSitOut: string | null;
    foldActionIndex: number | null;
    actionTurnIndex: number;
    isPlayerInGame: boolean;
}

// ===================================================================
// LEGACY ETHEREUM TYPES
// ===================================================================
// NOTE: The interfaces below are from the original Ethereum implementation.
// They are kept for backwards compatibility but are NOT used by the new
// Cosmos SDK hooks. All player action hooks now use Cosmos SDK directly
// with mnemonic-based signing (no privateKey/nonce management required).
// ===================================================================

// Interface for Account data structure
export interface AccountData {
    address: string;
    balance: string;
    nonce: number;
}

// Interface for API response
export interface AccountApiResponse {
    id: string;
    result: {
        data: AccountData;
        signature: string;
    };
}

//
export interface HandParams {
    tableId: string;
    amount: string;
}

export interface StartNewHandOptions {
    privateKey: string | null;
    nonce?: string | number;
    seed?: string;
}

export interface DealOptions {
    privateKey: string | null;
    nonce?: string | number;
    actionIndex?: number | null;
}

export interface FoldOptions {
    privateKey: string | null;
    nonce?: string | number;
    actionIndex?: number | null;
}

export interface JoinTableOptions {
    amount: string;
    seatNumber?: number;
}

export interface LeaveTableOptions {
    amount?: string;
    privateKey?: string | null;
    nonce?: string | number;
    actionIndex?: number | null;
}

// Define MuckOptions interface
export interface MuckOptions {
    privateKey: string | null;
    nonce?: string | number;
    actionIndex?: number | null;
}

// Define ShowCardsParams interface
export interface ShowCardsParams {
    privateKey: string | null;
    nonce?: string | number;
    actionIndex?: number | null;
}
