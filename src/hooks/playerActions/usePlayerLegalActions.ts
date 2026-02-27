import { useGameStateContext } from "../../context/GameStateContext";
import { PlayerLegalActionsResult } from "./types";
import { LegalActionDTO, PlayerActionType, PlayerDTO } from "@block52/poker-vm-sdk";
import { useRef, useMemo, useState, useEffect } from "react";

// 🔍 DEBUG: Enhanced logging utility for easy data export (same as GameStateContext)
const debugLog = (eventType: string, data: any) => {

    // Access the global debug logs array if it exists
    if (typeof window !== "undefined" && (window as any).debugLogs) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            eventType,
            data
        };
        (window as any).debugLogs.push(logEntry);
    }
};

/**
 * Custom hook to fetch the legal actions for the current player
 * 
 * NOTE: Table identification and player legal actions are handled through GameStateContext subscription.
 * Components call subscribeToTable(tableId) which creates a WebSocket connection with both tableAddress 
 * and playerId (player address) parameters. This hook reads the real-time legal actions from that context.
 * 
 * @returns Object containing the player's legal actions and related information
 */
export function usePlayerLegalActions(): PlayerLegalActionsResult {
    // 🎯 PERFORMANCE FIX: Move localStorage access outside render cycle
    const [userAddress, setUserAddress] = useState<string | null>(null);

    useEffect(() => {
        // Use Cosmos address instead of Ethereum address
        const address = localStorage.getItem("user_cosmos_address")?.toLowerCase();
        setUserAddress(address || null);
    }, []);

    // Get game state directly from Context - table ID managed by subscription
    const { gameState, isLoading, error } = useGameStateContext();

    // Add ref to track last logged state to prevent spam
    const lastLoggedStateRef = useRef<string>("");

    // 🔍 DEBUG: Only log when meaningful state changes occur
    const renderCount = useRef(0);
    renderCount.current += 1;

    // 🎯 PERFORMANCE FIX: Memoize expensive calculations
    // Only recalculate when relevant game state properties change
    const result = useMemo((): PlayerLegalActionsResult => {
        // Default return value for error/loading states
        const defaultReturn: PlayerLegalActionsResult = {
            legalActions: [],
            isSmallBlindPosition: false,
            isBigBlindPosition: false,
            isDealerPosition: false,
            isPlayerTurn: false,
            playerStatus: null,
            playerSeat: null,
            sitInMethod: null,
            pendingSitOut: null,
            isLoading,
            error,
            foldActionIndex: null,
            actionTurnIndex: 0,
            isPlayerInGame: false
        };

        // Handle loading and error states
        if (isLoading || error || !gameState || !userAddress) {
            return defaultReturn;
        }

        try {
            // Try to find the current player in the table data
            let currentPlayer: PlayerDTO | null = null;
            let isPlayerInGame = false;

            if (gameState.players?.length > 0) {
                // Find player with exact address match (case-insensitive)
                currentPlayer = gameState.players?.find((player: PlayerDTO) => player.address?.toLowerCase() === userAddress) ?? null;
                isPlayerInGame = !!currentPlayer;
            }



            // If there's still no player found, return default
            if (!currentPlayer) {
                return defaultReturn;
            }

            // Check if it's the player's turn
            const isPlayerTurn: boolean = gameState.nextToAct === currentPlayer.seat;

            // Find the fold action index
            let foldActionIndex: number | null = null;
            if (Array.isArray(currentPlayer.legalActions)) {
                const foldAction = currentPlayer.legalActions.find((action: LegalActionDTO) => action.action === PlayerActionType.FOLD);
                if (foldAction) {
                    foldActionIndex = foldAction.index;
                }
            }

            // Calculate the common action turn index
            let actionTurnIndex: number = 0;
            if (Array.isArray(currentPlayer.legalActions) && currentPlayer.legalActions.length > 0) {
                const firstActionIndex = currentPlayer.legalActions[0].index;

                // Verify that all actions have the same index (for debugging)
                const allSameIndex = currentPlayer.legalActions.every((action: LegalActionDTO) => action.index === firstActionIndex);

                if (!allSameIndex) {
                    // Actions have different indices - use first one
                }

                actionTurnIndex = firstActionIndex;
            }

            // Extract and return all the relevant information
            return {
                legalActions: Array.isArray(currentPlayer.legalActions) ? currentPlayer.legalActions : [],
                isSmallBlindPosition: currentPlayer.isSmallBlind || gameState.smallBlindPosition === currentPlayer.seat,
                isBigBlindPosition: currentPlayer.isBigBlind || gameState.bigBlindPosition === currentPlayer.seat,
                isDealerPosition: currentPlayer.isDealer || gameState.dealer === currentPlayer.seat,
                isPlayerTurn,
                playerStatus: currentPlayer.status || null,
                playerSeat: currentPlayer.seat || null,
                sitInMethod: currentPlayer.sitInMethod || null,
                pendingSitOut: currentPlayer.pendingSitOut || null,
                isLoading: false,
                error: null,
                foldActionIndex,
                actionTurnIndex,
                isPlayerInGame
            };
        } catch (err) {
            console.error("⚠️ Error parsing player legal actions:", err);
            return {
                ...defaultReturn,
                error: err instanceof Error ? err : new Error("Unknown error occurred")
            };
        }
    }, [
        // 🎯 Only recalculate when these specific properties change
        gameState,
        userAddress,
        isLoading,
        error
    ]);

    // 🔍 DEBUG: Optimized logging - only when result actually changes
    useEffect(() => {
        if (result.isPlayerTurn || result.legalActions.length > 0) {
            const currentState = JSON.stringify({
                playerSeat: result.playerSeat,
                isPlayerTurn: result.isPlayerTurn,
                gameRound: gameState?.round,
                nextToAct: gameState?.nextToAct,
                legalActionCount: result.legalActions.length,
                renderCount: renderCount.current
            });

            // Only log if the state actually changed
            if (currentState !== lastLoggedStateRef.current) {
                debugLog("LEGAL ACTIONS CALCULATED", {
                    timestamp: new Date().toISOString(),
                    playerSeat: result.playerSeat,
                    isPlayerTurn: result.isPlayerTurn,
                    gameRound: gameState?.round,
                    nextToAct: gameState?.nextToAct,
                    legalActions: result.legalActions.map(action => ({
                        action: action.action,
                        min: action.min,
                        max: action.max,
                        index: action.index
                    })),
                    renderCount: renderCount.current,
                    source: "usePlayerLegalActions (memoized)"
                });
                lastLoggedStateRef.current = currentState;
            }
        }
    }, [result, gameState?.round, gameState?.nextToAct]);

    return result;
}
