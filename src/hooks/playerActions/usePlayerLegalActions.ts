import { useGameData } from "../../context/gameState/GameDataContext";
import { useGameUI } from "../../context/gameState/GameUIContext";
import { PlayerLegalActionsResult } from "./types";
import { LegalActionDTO, PlayerActionType, PlayerDTO } from "@block52/poker-vm-sdk";
import { useRef, useMemo, useState, useEffect } from "react";
import { hasElements } from "../../utils/guards";
import { STORAGE_KEYS } from "../../constants/storageKeys";

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
    // localStorage is synchronous — read once via useState's initializer so we
    // don't trigger an extra render with a setState-in-effect.
    const [userAddress] = useState<string | null>(
        () => localStorage.getItem(STORAGE_KEYS.cosmosAddress)?.toLowerCase() || null
    );

    const { gameState } = useGameData();
    const { isLoading, error } = useGameUI();

    // Add ref to track last logged state to prevent spam
    const lastLoggedStateRef = useRef<string>("");

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

            if (hasElements(gameState.players)) {
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
            if (hasElements(currentPlayer.legalActions)) {
                const firstActionIndex = currentPlayer.legalActions[0].index;
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
        if (result.isPlayerTurn || hasElements(result.legalActions)) {
            const currentState = JSON.stringify({
                playerSeat: result.playerSeat,
                isPlayerTurn: result.isPlayerTurn,
                gameRound: gameState?.round,
                nextToAct: gameState?.nextToAct,
                legalActionCount: result.legalActions.length
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
                    source: "usePlayerLegalActions (memoized)"
                });
                lastLoggedStateRef.current = currentState;
            }
        }
    }, [result, gameState?.round, gameState?.nextToAct]);

    return result;
}
