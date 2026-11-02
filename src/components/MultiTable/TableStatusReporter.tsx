import { useEffect, useRef } from "react";
import { LegalActionDTO, PlayerActionType } from "@block52/poker-vm-sdk";
import { useNextToActInfo } from "../../hooks/game/useNextToActInfo";
import { usePlayerData } from "../../hooks/player/usePlayerData";
import { usePlayerSeatInfo } from "../../hooks/player/usePlayerSeatInfo";
import { useGameStateContext } from "../../context/GameStateContext";
import { useTableSessions } from "../../context/tableSessions/TableSessionsContext";

const HAND_ACTIONS = new Set<string>(Object.values(PlayerActionType));

/**
 * Whether the legal actions include a real in-hand decision (blind, fold, check,
 * call, bet, raise, show, muck). The engine also points nextToAct at a seated
 * player whose only options are sit-in / sit-out / leave between hands; that is
 * not "your turn" and must not light the pill.
 */
export const hasHandDecision = (actions: LegalActionDTO[]): boolean => actions.some(a => HAND_ACTIONS.has(a.action));

/**
 * Renderless bridge for the multi-tabling pills (ui#55). Mounted inside each live
 * table's GameStateProvider, it reads that table's real state — is it your turn, your
 * hole cards, the table name — and pushes it up to the shared TableSessions store so
 * the pill bar can show the hole cards and glow when it's your turn there, even while
 * that table is in the background.
 *
 * It renders nothing and only dispatches when the reported snapshot actually changes,
 * so a busy background table does not thrash the pill bar.
 */
export const TableStatusReporter: React.FC<{ tableId: string }> = ({ tableId }) => {
    const { reportStatus } = useTableSessions();
    const { currentUserSeat } = usePlayerSeatInfo();
    const { holeCards } = usePlayerData(currentUserSeat >= 0 ? currentUserSeat : undefined);
    const { isCurrentUserTurn, availableActions } = useNextToActInfo(tableId);
    const { gameName } = useGameStateContext();

    const lastReported = useRef<string>("");

    useEffect(() => {
        const cards = Array.isArray(holeCards) ? holeCards : [];
        const snapshot = {
            isMyTurn: !!isCurrentUserTurn && hasHandDecision(availableActions),
            holeCards: cards,
            name: gameName || undefined
        };
        const key = JSON.stringify(snapshot);
        if (key !== lastReported.current) {
            lastReported.current = key;
            reportStatus(tableId, snapshot);
        }
    }, [tableId, isCurrentUserTurn, availableActions, holeCards, gameName, reportStatus]);

    return null;
};
