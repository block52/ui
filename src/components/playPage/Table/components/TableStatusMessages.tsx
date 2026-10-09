/**
 * Table Status Messages Component
 *
 * Displays status messages on the table:
 * - Current user's seat position
 * - Next to act indicator
 * - Hand complete message
 *
 * Logic is driven by getTableStatusMessages() utility (unit-tested).
 * "Waiting for players to join..." is owned by PlayerActionButtons.
 */

import React, { useMemo } from "react";
import { PlayerDTO, LegalActionDTO } from "@block52/poker-vm-sdk";
import { getTableStatusMessages, TableStatusMessage } from "../../../../utils/tableStatusDisplayUtils";

export interface TableStatusMessagesProps {
    viewportMode: "mobile-portrait" | "mobile-landscape" | "tablet" | "desktop";
    isMobileLandscape: boolean;
    currentUserSeat: number;
    nextToActSeat: number | null;
    isGameInProgress: boolean;
    isCurrentUserTurn: boolean;
    playerLegalActions: LegalActionDTO[] | null;
    tableActivePlayers: PlayerDTO[];
    isSitAndGoWaitingForPlayers: boolean;
    smallBlindPosition?: number;
    bigBlindPosition?: number;
    dealerPosition?: number;
}

export const TableStatusMessages: React.FC<TableStatusMessagesProps> = ({
    viewportMode,
    isMobileLandscape,
    currentUserSeat,
    nextToActSeat,
    isGameInProgress,
    isCurrentUserTurn,
    playerLegalActions,
    tableActivePlayers,
    isSitAndGoWaitingForPlayers,
    smallBlindPosition,
    bigBlindPosition,
    dealerPosition
}) => {
    const messages = useMemo(() => getTableStatusMessages({
        currentUserSeat,
        nextToActSeat,
        isGameInProgress,
        isCurrentUserTurn,
        hasLegalActions: (playerLegalActions?.length ?? 0) > 0,
        totalActivePlayers: tableActivePlayers.length,
        isSitAndGoWaitingForPlayers,
        smallBlindPosition,
        bigBlindPosition,
        dealerPosition,
    }), [
        currentUserSeat,
        nextToActSeat,
        isGameInProgress,
        isCurrentUserTurn,
        playerLegalActions,
        tableActivePlayers,
        isSitAndGoWaitingForPlayers,
        smallBlindPosition,
        bigBlindPosition,
        dealerPosition,
    ]);

    const getMessageStyle = (msg: TableStatusMessage): string => {
        if (msg.kind === "seat-label") {
            if (viewportMode === "desktop") return "bg-surface-card/80 border border-line text-left";
            if (isMobileLandscape) return "bg-surface-card/70 border border-line text-left break-words";
            return "bg-surface-card/70 border border-line text-center";
        }
        // your-turn, waiting-for-player, hand-complete
        if (viewportMode === "desktop") return "bg-surface-card/90 border border-line text-left";
        if (isMobileLandscape) return "bg-surface-card/85 border border-line text-left break-words";
        return "bg-surface-card/85 border border-line text-center";
    };

    const renderMessageContent = (msg: TableStatusMessage): React.ReactNode => {
        switch (msg.kind) {
            case "seat-label":
                return msg.text;
            case "your-turn":
                return <span className="text-yellow-400 font-semibold">{msg.text}</span>;
            case "waiting-for-player":
                return <span>{msg.text}</span>;
            case "hand-complete":
                return <span>{msg.text}</span>;
        }
    };

    return (
        <div
            className={`flex flex-col space-y-2 z-50 ${
                viewportMode === "desktop"
                    ? "fixed left-4 top-32 items-start"
                    : isMobileLandscape
                    ? "absolute left-2 items-start max-w-[150px]"
                    : "absolute left-1/2 transform -translate-x-1/2 items-center"
            }`}
            style={{ top: viewportMode === "desktop" ? undefined : isMobileLandscape ? "3rem" : "6.25rem" }}
        >
            {messages.map((msg) => (
                <div
                    key={msg.kind}
                    className={`text-ink-body px-3 py-2 rounded-xl text-xs sm:text-sm backdrop-blur-sm ${getMessageStyle(msg)}`}
                >
                    {renderMessageContent(msg)}
                </div>
            ))}
        </div>
    );
};
