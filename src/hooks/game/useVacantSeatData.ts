import React from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { GameFormat, PlayerDTO } from "@block52/poker-vm-sdk";
import { VacantSeatResponse } from "../../types/index";
import { isValidPlayerAddress } from "../../utils/addressUtils";
import { isEmpty, isNullish, hasElements } from "../../utils/guards";
import { STORAGE_KEYS } from "../../constants/storageKeys";

/**
 * Custom hook to manage data for vacant seats
 * @param tableId The ID of the table (not used - Context manages subscription)
 * @returns Object containing seat vacancy data
 */
export const useVacantSeatData = (): VacantSeatResponse => {
    // Get game state directly from Context - no additional WebSocket connections
    const { gameState, gameFormat, isLoading, error } = useGameStateContext();

    // A Sit & Go freezes its roster once it starts (poker-vm#2343): no player may
    // join a tournament in progress. The engine currently still advertises a
    // vacated seat as available after a bustout (poker-vm#2404), which would let
    // the join / buy-in modal pop on an empty seat mid-tournament. Guard here so
    // the FE never offers a join into a started SNG regardless of that seat state.
    // "Started" = an SNG past its pre-deal bootstrap window: hand > 1, or any
    // finishing result already recorded.
    const isStartedSitAndGo = React.useMemo(() => {
        if (gameFormat !== GameFormat.SIT_AND_GO) return false;
        const handNumber = gameState?.handNumber ?? 0;
        const hasResults = hasElements(gameState?.results ?? []);
        return handNumber > 1 || hasResults;
    }, [gameFormat, gameState?.handNumber, gameState?.results]);

    const userAddress = React.useMemo(() => {
        // Use Cosmos address (b52...) instead of Ethereum address
        return localStorage.getItem(STORAGE_KEYS.cosmosAddress)?.toLowerCase() || null;
    }, []);

    // Memoize players array and maxPlayers to avoid repeated property access
    const { players, maxPlayers } = React.useMemo(() => ({
        players: gameState?.players || [],
        maxPlayers: gameState?.gameOptions?.maxPlayers
    }), [gameState]);

    // Check if user is already playing at the table
    const isUserAlreadyPlaying = React.useMemo(() => {
        return !!(userAddress && hasElements(players) &&
            players.some((player: PlayerDTO) => player.address?.toLowerCase() === userAddress));
    }, [players, userAddress]);

    // Function to check if a specific seat is vacant
    const isSeatVacant = React.useCallback(
        (seatIndex: number) => {
            return !players.some(
                (player: PlayerDTO) => player.seat === seatIndex &&
                isValidPlayerAddress(player.address)
            );
        },
        [players]
    );

    // Get array of all empty seat indexes - optimized to avoid repeated function calls
    const emptySeatIndexes: number[] = React.useMemo(() => {
        // Game state not loaded yet — no seats to show
        if (isNullish(maxPlayers)) return [];

        if (isEmpty(players)) {
            // If no players, all seats are empty
            return Array.from({ length: maxPlayers }, (_, i) => i + 1);
        }

        const occupiedSeats = new Set(
            players
                .filter(player => isValidPlayerAddress(player.address))
                .map(player => player.seat)
        );

        const emptySeatNumbers: number[] = [];
        for (let seatIndex = 1; seatIndex <= maxPlayers; seatIndex++) {
            if (!occupiedSeats.has(seatIndex)) {
                emptySeatNumbers.push(seatIndex);
            }
        }

        return emptySeatNumbers;
    }, [players, maxPlayers]);

    // Function to check if a user can join a specific seat
    const canJoinSeat = React.useCallback(
        (seatIndex: number) => {
            // No joins into a started SNG — roster is frozen (see isStartedSitAndGo).
            if (isStartedSitAndGo) return false;
            const vacant = isSeatVacant(seatIndex);
            const canJoin = !isUserAlreadyPlaying && vacant;
            return canJoin;
        },
        [isSeatVacant, isUserAlreadyPlaying, isStartedSitAndGo]
    );

    // Get array of all empty seat indexes that the user can join
    const availableSeatIndexes = React.useMemo(() => {
        if (isStartedSitAndGo || isUserAlreadyPlaying) return [];
        return emptySeatIndexes;
    }, [emptySeatIndexes, isUserAlreadyPlaying, isStartedSitAndGo]);

    return {
        isUserAlreadyPlaying,
        isSeatVacant,
        canJoinSeat,
        emptySeatIndexes,        // NEW: Array of all empty seat numbers
        availableSeatIndexes,    // NEW: Array of seats user can actually join
        isLoading,
        error
    };
};