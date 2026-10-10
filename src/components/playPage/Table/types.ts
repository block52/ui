/**
 * Shared types for Table component refactoring
 *
 * This file contains all shared interfaces and types used across
 * the split Table components.
 */

import { CardBackStyle } from "../../../utils/cardImages";

/**
 * Props for TableHeader component
 */
export interface TableHeaderProps {
    tableId: string;
    onToggleSidebar: () => void;
    onLeaveTable: () => void;
    onDeposit: () => void;
}

/**
 * Props for TableBoard component
 */
export interface TableBoardProps {
    cardBackStyle: CardBackStyle;
}

/**
 * Props for PlayerSeating component
 */
export interface PlayerSeatingProps {
    cardBackStyle: CardBackStyle;
    onPlayerJoin: () => void; // Callback to refresh balance after join
}

/**
 * Props for TableModals component
 */
export interface TableModalsProps {
    // Leave table modal
    leaveModal: {
        isOpen: boolean;
        onClose: () => void;
        onConfirm: () => void;
    };
    // Transaction popup
    transactionPopup: {
        txHash: string | null;
        onClose: () => void;
    };
    // Game start countdown
    countdown: {
        gameStartTime: number;
        showCountdown: boolean;
        onComplete: () => void;
        onSkip: () => void;
    };
    // Sit and go waiting
    sitAndGoWaiting: boolean;
}

/**
 * Return type for useTableHeader hook
 */
export interface UseTableHeaderReturn {
    // Balance data
    accountBalance: string;
    isBalanceLoading: boolean;
    balanceFormatted: string;

    // User data
    publicKey: string | null;
    formattedAddress: string;

    // Actions
    fetchAccountBalance: () => void;
    handleCopyTableLink: () => void;
    handleDepositClick: () => void;
    handleLobbyClick: () => void;
    copyToClipboard: (text: string) => void;

    // Styles
    headerStyle: React.CSSProperties;
    subHeaderStyle: React.CSSProperties;
    walletInfoStyle: React.CSSProperties;
    balanceIconStyle: React.CSSProperties;
    depositButtonStyle: React.CSSProperties;

    // Hover state
    isDepositHovered: boolean;
    handleDepositMouseEnter: () => void;
    handleDepositMouseLeave: () => void;
}

/**
 * Return type for useTableBoard hook
 */
export interface UseTableBoardReturn {
    communityCards: string[];
    formattedTotalPot: string;
    hasCommunityCards: boolean;
    isSitAndGoWaitingForPlayers: boolean;
}

/**
 * Return type for usePlayerLayout hook
 */
export interface UsePlayerLayoutReturn {
    playerPositions: Array<{
        seat: number;
        position: { left: string; top: string };
        isCurrentUser: boolean;
    }>;
    currentUserSeat: number | null;
    tableSize: 4 | 9;
}
