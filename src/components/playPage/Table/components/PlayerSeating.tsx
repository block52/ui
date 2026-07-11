/**
 * PlayerSeating Component
 *
 * Handles the rendering and positioning of all players around the poker table.
 * Contains the complex table rotation logic that keeps the current user at the bottom.
 *
 * Key Features:
 * - Dynamic player positioning based on table rotation
 * - Renders Player (current user), OppositePlayer, or VacantPlayer components
 * - Turn indicator animations
 * - Winner ripple animations
 * - Manages card visibility state
 */

import React, { useCallback } from "react";
import { PlayerDTO } from "@block52/poker-vm-sdk";
import { PositionArray } from "../../../../types";
import { UseTableLayoutReturn } from "../../../../hooks/game/useTableLayout";
import Player from "../../Players/Player";
import OppositePlayer from "../../Players/OppositePlayer";
import VacantPlayer from "../../Players/VacantPlayer";
import TurnAnimation from "../../Animations/TurnAnimation";
import WinAnimation from "../../Animations/WinAnimation";
import ActionEcho from "../../Animations/ActionEcho";
import { useAppliedActions } from "../../../../hooks/game/useAppliedActions";
import { CardBackStyle } from "../../../../utils/cardImages";

// Memoize TurnAnimation
const MemoizedTurnAnimation = React.memo(TurnAnimation);

export interface PlayerSeatingProps {
    // Table configuration
    tableLayout: UseTableLayoutReturn;
    tableSize: number;
    startIndex: number;

    // Player data
    tableActivePlayers: PlayerDTO[];
    tableDataPlayers: PlayerDTO[];
    userWalletAddress: string | null;
    currentIndex: number;

    // Animation states
    hasWinner: boolean;
    isSitAndGoWaitingForPlayers: boolean;
    winnerInfo: Array<{ seat: number }> | null;

    // Card back style
    cardBackStyle: CardBackStyle;

    // Handlers
    updateBalanceOnPlayerJoin: () => void;
}

export const PlayerSeating: React.FC<PlayerSeatingProps> = ({
    tableLayout,
    tableSize,
    startIndex,
    tableActivePlayers,
    tableDataPlayers,
    userWalletAddress,
    currentIndex,
    hasWinner,
    isSitAndGoWaitingForPlayers,
    winnerInfo,
    cardBackStyle,
    updateBalanceOnPlayerJoin
}) => {
    // Seat-indexed lookups built once per update (#2455). The render loop below
    // maps over every UI position and previously called .find()/.some() by seat
    // on these arrays per position — O(n²) per game-state update on a full table.
    // Building the maps once turns each per-seat lookup into O(1).
    const activePlayerBySeat = React.useMemo(() => {
        const bySeat = new Map<number, PlayerDTO>();
        for (const p of tableActivePlayers) bySeat.set(p.seat, p);
        return bySeat;
    }, [tableActivePlayers]);

    const dataPlayerBySeat = React.useMemo(() => {
        const bySeat = new Map<number, PlayerDTO>();
        for (const p of tableDataPlayers) bySeat.set(p.seat, p);
        return bySeat;
    }, [tableDataPlayers]);

    const winnerSeats = React.useMemo(() => {
        const seats = new Set<number>();
        if (winnerInfo) for (const w of winnerInfo) seats.add(w.seat);
        return seats;
    }, [winnerInfo]);

    // Committed-action echoes (Approach C) — latest applied action per seat, keyed
    // by committed index so a new action re-triggers the badge. Read-only observer.
    const actionEchoes = useAppliedActions();

    // ================================================================
    // CRITICAL ROTATION LOGIC - THIS IS WHERE THE ROTATION HAPPENS
    // ================================================================
    //
    // This function determines which component to render at each UI position
    // and handles the table rotation logic to keep the current user at the bottom
    //
    const getComponentToRender = useCallback(
        (position: PositionArray, positionIndex: number) => {
            // ROTATION FORMULA:
            // seatNumber = ((positionIndex - startIndex + tableSize) % tableSize) + 1
            //
            // STEP BY STEP BREAKDOWN:
            // 1. positionIndex - startIndex: Subtracts the rotation offset (for clockwise rotation)
            // 2. + tableSize: Ensures no negative numbers before modulo
            // 3. % tableSize: Wraps around if we exceed table size
            // 4. + 1: Converts from 0-based index to 1-based seat numbers
            //
            // VISUAL EXAMPLE (4 players, startIndex = 1):
            // - UI Pos 0: (0 - 1 + 4) % 4 + 1 = 4 → Seat 4 appears at bottom
            // - UI Pos 1: (1 - 1 + 4) % 4 + 1 = 1 → Seat 1 appears at left
            // - UI Pos 2: (2 - 1 + 4) % 4 + 1 = 2 → Seat 2 appears at top
            // - UI Pos 3: (3 - 1 + 4) % 4 + 1 = 3 → Seat 3 appears at right
            //
            // The subtraction creates a CLOCKWISE rotation:
            // As startIndex increases, lower numbered seats move clockwise to new positions
            const seatNumber = ((positionIndex - startIndex + tableSize) % tableSize) + 1;

            // Find if a player is seated at this position
            const playerAtThisSeat = activePlayerBySeat.get(seatNumber);

            // Check if this seat belongs to the current user
            const isCurrentUser = playerAtThisSeat && playerAtThisSeat.address?.toLowerCase() === userWalletAddress?.toLowerCase();

            // Build common props shared by all player components
            const playerProps = {
                index: seatNumber,
                currentIndex,
                left: position.left,
                top: position.top,
                color: position.color || "#6b7280", // Default gray if no color
                status: dataPlayerBySeat.get(seatNumber)?.status,
                onJoin: updateBalanceOnPlayerJoin
            };

            // CASE 1: No player at this seat - render vacant position
            if (!playerAtThisSeat) {
                return (
                    <VacantPlayer
                        index={seatNumber}
                        uiPosition={positionIndex}
                        left={tableLayout.positions.vacantPlayers[positionIndex]?.left || "0px"}
                        top={tableLayout.positions.vacantPlayers[positionIndex]?.top || "0px"}
                        onJoin={updateBalanceOnPlayerJoin}
                    />
                );
            }

            // CASE 2: Current user's seat or CASE 3: Another player's seat
            // Pass the positionIndex so components can show the correct UI position
            return isCurrentUser ? (
                <Player {...playerProps} uiPosition={positionIndex} />
            ) : (
                <OppositePlayer {...playerProps} uiPosition={positionIndex} cardBackStyle={cardBackStyle} />
            );
        },
        [activePlayerBySeat, userWalletAddress, currentIndex, dataPlayerBySeat, tableSize, startIndex, updateBalanceOnPlayerJoin, tableLayout, cardBackStyle]
    );

    // Render all player positions
    return (
        <div className="absolute inset-0 z-30">
            {/* ============================================================
                MAIN RENDER LOOP - APPLIES ROTATION TO ALL PLAYERS
                ============================================================

                KEY POINTS:
                1. We iterate over tableLayout.positions.players (the UNROTATED positions)
                2. Each position has fixed UI coordinates (left, top)
                3. The rotation happens in getComponentToRender()

                IMPORTANT: We do NOT pre-rotate the positions array!
                - We use the original positions as-is
                - getComponentToRender decides WHICH seat goes WHERE
                - This avoids double-rotation bugs

                FLOW:
                - positionIndex 0 → getComponentToRender → decides which seat appears at bottom
                - positionIndex 1 → getComponentToRender → decides which seat appears at left
                - positionIndex 2 → getComponentToRender → decides which seat appears at top
                - etc.
            */}
            {tableLayout.positions.players.map((position, positionIndex) => {
                // Calculate seat number for animations (turn indicator, winner effects)
                // This uses the SAME formula as getComponentToRender to stay in sync
                const seatNum = ((positionIndex - startIndex + tableSize) % tableSize) + 1;
                const isWinnerSeat = winnerSeats.has(seatNum);

                // Get the actual component to render (Player, OppositePlayer, or VacantPlayer)
                // This function handles all the rotation logic internally
                const componentToRender = getComponentToRender(position, positionIndex);

                return (
                    <div key={positionIndex} className="z-[10]">
                        {/* Turn indicator — offset down to center on badge */}
                        {!hasWinner && !isSitAndGoWaitingForPlayers && (
                            <MemoizedTurnAnimation
                                index={seatNum - 1}
                                position={tableLayout.positions.turnAnimations[positionIndex]}
                                tableActivePlayers={tableActivePlayers}
                            />
                        )}

                        {/* Winner ripple — same position as player */}
                        {isWinnerSeat && <WinAnimation index={seatNum - 1} position={position} />}

                        {/* Committed-action echo — floats a transient badge over the
                            local player's own seat when they act (opponents already
                            have their own indicator). Positioned like the turn
                            indicator; keyed on the action index so it re-fires. */}
                        {actionEchoes[seatNum] && (
                            <ActionEcho
                                key={`echo-${seatNum}-${actionEchoes[seatNum].index}`}
                                echo={actionEchoes[seatNum]}
                                position={tableLayout.positions.turnAnimations[positionIndex] ?? position}
                            />
                        )}

                        {componentToRender}
                    </div>
                );
            })}
        </div>
    );
};
