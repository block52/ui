import {
    LegalActionDTO,
    PlayerActionType,
    PlayerDTO,
    GameOptionsDTO,
    TexasHoldemRound,
    GameFormat,
    ActionDTO,
    PlayerStatus,
    GameOptionsResponse
} from "@block52/poker-vm-sdk";

// ============================================================================
// BASE TYPES
// ============================================================================

// Base type for all hook returns with common loading and error state
export interface BaseHookReturn {
    isLoading: boolean;
    error: Error | null;
}

// ============================================================================
// FUNCTION & ACTION TYPES (consolidated from types.ts)
// ============================================================================

/**
 * Common blockchain function names used across the application
 */
export enum FunctionName {
    Deposit = "deposit",
    Approve = "approve",
    Allowance = "allowance",
    Decimals = "decimals",
    Balance = "balanceOf",
    Withdraw = "withdraw"
}

/**
 * Result returned from player action hooks (bet, call, raise, fold, etc.)
 * All amounts are stored as strings for JSON serialization compatibility.
 */
export interface PlayerActionResult {
    /** Transaction hash from the blockchain */
    hash: string;
    /** The game/table ID where the action was performed */
    gameId: string;
    /** The action that was performed (e.g., "bet", "call", "raise", "fold") */
    action: string;
    /** The amount involved in the action (in micro-units as string), if applicable */
    amount?: string;
}

/**
 * Result returned from joinTable hook
 * Extends PlayerActionResult with join-specific properties
 */
export interface JoinTableResult extends Omit<PlayerActionResult, "action"> {
    /** The seat number the player joined at */
    seat: number;
    /** The buy-in amount (in micro-units as string) */
    buyInAmount: string;
}

/**
 * Result returned from leaveTable hook
 * Extends PlayerActionResult with leave-specific properties
 */
export interface LeaveTableResult extends PlayerActionResult {
    /** The value associated with leaving (in micro-units as string) */
    value: string;
}

// ============================================================================
// TRANSACTION TYPES (consolidated from components/types.ts)
// ============================================================================

/**
 * Status of a transaction as it progresses through the system
 */
export type TransactionStatus = "DETECTED" | "PROCESSING" | "CONFIRMING" | "CONFIRMED" | "COMPLETED" | null;

/**
 * Transaction data from Etherscan API
 */
export interface EtherscanTransaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    timeStamp: string;
    [key: string]: unknown;
}

/**
 * Deposit session tracking data
 */
export interface DepositSession {
    _id: string;
    userAddress: string;
    depositAddress: string;
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "EXPIRED";
    expiresAt: string;
    amount: number | null;
    txHash?: string;
    txStatus?: TransactionStatus;
}

// ============================================================================
// ERROR & LOGGING TYPES
// ============================================================================

/**
 * Error log entry for tracking application errors
 */
export interface ErrorLog {
    id: string;
    message: string;
    timestamp: Date;
    severity: "error" | "warning" | "info";
    source: "API" | "UI" | "System";
    details?: Record<string, unknown>;
}

// ============================================================================
// GAME ACTION TYPES
// ============================================================================

export interface LastActionType {
    action: string;
    amount: number;
}

export interface StartNewHandParams {
    nonce?: number | string;
    seed?: string;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface PlayerContextType {
    players: PlayerDTO[];
    pots: string[];
    tableSize: number;
    seat: number;
    totalPot: number;
    bigBlind: string;
    smallBlind: string;
    roundType: string;
    tableFormat: string;
    gamePlayers: PlayerDTO[];
    nextToAct: number;
    playerSeats: number[];
    communityCards: string[];
    setPlayerAction: (action: PlayerActionType, amount?: number) => void;
    dealerIndex: number;
    lastPot: number;
    playerIndex: number;
    openOneMore: boolean;
    openTwoMore: boolean;
    showThreeCards: boolean;
    isLoading: boolean;
    error: Error | null;
}

// ============================================================================
// PLAYER & TABLE TYPES
// ============================================================================

export type Player = {
    address: string;
    seat: number;
    legalActions: LegalActionDTO[];
    timeout: number;
};

export type TableData = {
    smallBlindPosition: number;
    bigBlindPosition: number;
    nextToAct: number;
    dealer: number;
    players: PlayerDTO[];
    round: string;
    pots: string[];
};

type Limits = {
    min: string;
    max: string;
};

//todo tidy up this type
export type TableStatus = {
    isInTable: boolean;
    isPlayerTurn: boolean;
    seat: number;
    stack: string;
    status: PlayerStatus;
    availableActions: LegalActionDTO[];
    canPostSmallBlind: boolean;
    canPostBigBlind: boolean;
    canCheck: boolean;
    canCall: boolean;
    canBet: boolean;
    canRaise: boolean;
    canFold: boolean;
    betLimits: Limits | null;
    raiseLimits: Limits | null;
    callAmount: string;
    smallBlindAmount: string;
    bigBlindAmount: string;
    isSmallBlindPosition: boolean;
};

// ============================================================================
// UI COMPONENT PROPS (shared across components)
// ============================================================================

/**
 * Position styling properties for absolute positioning
 */
export interface PositionArray {
    left?: string;
    top?: string;
    bottom?: string;
    right?: string;
    color?: string;
}

export interface LeaveTableOptions {
    amount: string;
    actionIndex?: number;
    nonce?: number;
}

/**
 * Props for VacantPlayer component
 */
export interface VacantPlayerProps {
    index: number;
    left: string;
    top: string;
    onJoin?: () => void;
}

export interface PlayerProps {
    left?: string;
    top?: string;
    index: number;
    currentIndex: number;
    color?: string;
    status?: string;
}

export interface TurnAnimationProps {
    index: number;
}

export interface WinAnimationProps {
    index: number;
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

/**
 * Return type for useGameProgress hook
 */
export interface GameProgressReturn extends BaseHookReturn {
    isGameInProgress: boolean;
    activePlayers: PlayerDTO[];
    playerCount: number;
    handNumber: number;
    actionCount: number;
    nextToAct: number;
    previousActions: ActionDTO[];
}

// Type for the return value of useCardAnimations hook
export interface CardAnimationsReturn {
    flipped1: boolean;
    flipped2: boolean;
    flipped3: boolean;
    showThreeCards: boolean;
}

// Type for the return value of useTableState hook
export interface TableStateReturn extends BaseHookReturn {
    currentRound: TexasHoldemRound;
    totalPot: string;
    formattedTotalPot: string;
    tableSize: number;
    tableFormat: GameFormat | "unknown";
    roundType: TexasHoldemRound;
}

// Type for the return value of useChipPositions hook
export interface ChipPositionsReturn {
    chipPositionArray: PositionArray[];
    tableSize: number;
}

// Type for the return value of useDealerPosition hook
export interface DealerPositionReturn extends BaseHookReturn {
    dealerButtonPosition: { left: string; top: string };
    isDealerButtonVisible: boolean;
}

// Type for the return value of useFindGames hook
export interface FindGamesReturn extends BaseHookReturn {
    games: GameOptionsResponse[];
    refetch: () => Promise<void>;
}

// Type for the return value of useMinAndMaxBuyIns hook
// Values are USDC micro-units (6 decimals), not Wei
export interface MinAndMaxBuyInsReturn extends BaseHookReturn {
    minBuyIn: string | undefined;
    maxBuyIn: string | undefined;
}

// Type for the return value of useNextToActInfo hook
export interface NextToActInfoReturn extends BaseHookReturn {
    seat: number | null;
    player: PlayerDTO | null;
    isCurrentUserTurn: boolean;
    availableActions: LegalActionDTO[];
    timeRemaining: number;
}

// Type for the return value of usePlayerChipData hook
export interface PlayerChipDataReturn extends BaseHookReturn {
    getChipAmount: (seatIndex: number) => string;
    getChipActions: (seatIndex: number) => string[];
}

// Type for the return value of usePlayerData hook
export interface PlayerDataReturn extends BaseHookReturn {
    playerData: PlayerDTO | null;
    stackValue: number;
    isFolded: boolean;
    isAllIn: boolean;
    isSeated: boolean;
    isSittingOut: boolean;
    isSittingIn: boolean;
    isBusted: boolean;
    holeCards: string[];
    round: TexasHoldemRound | null;
}

// Type for the return value of usePlayerSeatInfo hook
export interface PlayerSeatInfoReturn extends BaseHookReturn {
    currentUserSeat: number;
    userDataBySeat: Record<number, PlayerDTO>;
}

// Type for the return value of usePlayerTimer hook
export interface PlayerTimerReturn extends BaseHookReturn {
    playerStatus: PlayerStatus;
    timeoutValue: number;
    progress: number;
    timeRemaining: number;
    isActive: boolean;
    extendTime?: () => void;
    hasUsedExtension?: boolean;
    canExtend?: boolean;
    isCurrentUser?: boolean;
    isCurrentUserTurn?: boolean;
}

// Type for showing cards data
export interface ShowingCardData {
    address: string;
    holeCards: string[];
    seat: number;
}

// Type for the return value of useShowingCardsByAddress hook
export interface ShowingCardsByAddressReturn extends BaseHookReturn {
    showingPlayers: ShowingCardData[];
    isShowdown: boolean;
}

// Type for the return value of useTableAnimations hook
export interface TableAnimationsReturn extends BaseHookReturn {
    tableSize: number;
}

// Type for the return value of useGameOptions hook
export interface GameOptionsReturn extends BaseHookReturn {
    gameOptions: Required<GameOptionsDTO> | null;
}

// Type for the return value of useTableData hook
export interface TableDataReturn extends BaseHookReturn {
    tableDataType: GameFormat | "unknown";
    tableDataSmallBlind: string;
    tableDataBigBlind: string;
    tableDataSmallBlindPosition: number | undefined;
    tableDataBigBlindPosition: number | undefined;
    tableDataDealer: number | undefined;
    tableDataPlayers: PlayerDTO[];
    tableDataCommunityCards: string[];
    tableDataDeck: string;
    tableDataPots: string[];
    tableDataNextToAct: number;
    tableDataRound: TexasHoldemRound;
    tableDataWinners: string[];
    tableDataSignature: string;
}

// Type for the return value of useTableTurnIndex hook
export interface TableTurnIndexReturn extends BaseHookReturn {
    nextTurnIndex: number;
}

export interface VacantSeatResponse extends BaseHookReturn {
    isUserAlreadyPlaying: boolean;
    isSeatVacant: (seatIndex: number) => boolean;
    canJoinSeat: (seatIndex: number) => boolean;
    emptySeatIndexes: number[];
    availableSeatIndexes: number[];
}

export interface WinnerInfo {
    seat: number;
    address: string;
    amount: string | number;
    formattedAmount: string;
    winType?: string;
    description?: string;
    handName?: string;
    cards?: string[];
}

export interface WinnerInfoReturn {
    winnerInfo: WinnerInfo[] | null;
    error: Error | null;
}

