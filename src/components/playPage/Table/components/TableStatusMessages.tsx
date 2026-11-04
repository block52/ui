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
import { useLanguage } from "../../../../i18n/useLanguage";

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
    const { language } = useLanguage();
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
        language,
    ]);

    const getMessageStyle = (msg: TableStatusMessage): string => {
        if (msg.kind === "seat-label") {
            if (viewportMode === "desktop") return "bg-black bg-opacity-60 text-left";
            if (isMobileLandscape) return "bg-black bg-opacity-50 text-left break-words";
            return "bg-black bg-opacity-50 text-center";
        }
        // your-turn, waiting-for-player, hand-complete
        if (viewportMode === "desktop") return "bg-black bg-opacity-80 text-left";
        if (isMobileLandscape) return "bg-black bg-opacity-70 text-left break-words";
        return "bg-black bg-opacity-70 text-center";
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
                    className={`text-white px-3 py-2 rounded-lg text-xs sm:text-sm backdrop-blur-sm ${getMessageStyle(msg)}`}
                >
                    {renderMessageContent(msg)}
                </div>
            ))}
        </div>
    );
};
