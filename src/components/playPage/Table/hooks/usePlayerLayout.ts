/**
 * usePlayerLayout Hook
 *
 * Manages player layout and positioning including:
 * - Player position calculations
 * - Table size configuration
 * - Current user seat tracking
 */

import { useMemo } from "react";
import { useTableLayout } from "../../../../hooks/game/useTableLayout";
import { useTableData } from "../../../../hooks/game/useTableData";
import { usePlayerSeatInfo } from "../../../../hooks/player/usePlayerSeatInfo";
import { useTableState } from "../../../../hooks/game/useTableState";
import { UsePlayerLayoutReturn } from "../types";
import { isEmpty } from "@block52/poker-ui-core/utils/guards";

export const usePlayerLayout = (): UsePlayerLayoutReturn => {
    const { tableSize } = useTableState();
    const tableLayout = useTableLayout((tableSize as 4 | 9) || 9);
    const { tableDataPlayers } = useTableData();
    const { currentUserSeat } = usePlayerSeatInfo();

    // Calculate player positions based on table layout
    const playerPositions = useMemo(() => {
        if (isEmpty(tableDataPlayers)) {
            return [];
        }

        return tableDataPlayers.map(player => {
            const seatIndex = player.seat;
            const position = tableLayout.positions.players[seatIndex] || { left: "50%", top: "50%" };

            return {
                seat: seatIndex,
                position,
                isCurrentUser: currentUserSeat === seatIndex
            };
        });
    }, [tableDataPlayers, tableLayout.positions.players, currentUserSeat]);

    return {
        playerPositions,
        currentUserSeat,
        tableSize: (tableSize as 4 | 9) || 9
    };
};
