import { useMemo } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { PlayerDTO, TexasHoldemStateDTO, WinnerDTO } from "@block52/poker-vm-sdk";
import { formatUSDCToSimpleDollars } from "../../utils/numberUtils";
import { WinnerInfo, WinnerInfoReturn } from "../../types/index";
import { hasElements } from "../../utils/guards";

/**
 * Extract winner information from game state
 * @param gameData The parsed game data
 * @returns Array of winner information or null if no winners
 */
function getWinnerInfo(gameData: TexasHoldemStateDTO) {
    if (!gameData) return null;

    // Check for explicit winners array in the game data
    if (hasElements(gameData.winners)) {
        return gameData.winners.map((winner: WinnerDTO) => {
            // Prefer the engine-stamped winner.seat (SDK 1.2.15+): it's captured
            // at win time, so it survives the winner LEAVING the table (players[]
            // lookup would yield seat 0 — #2378). Fall back to resolving from
            // players[] for backends that don't stamp it yet, which keeps the
            // winner banner working while the winner is still seated.
            const player = gameData.players?.find((p: PlayerDTO) => p.address?.toLowerCase() === winner.address?.toLowerCase());

            // winType is derived from whether cards were revealed: a showdown win
            // carries the winning hand; an uncontested win (everyone folded) does
            // not. Fixes the previously-hardcoded "Showdown" label on fold wins.
            return {
                seat: winner.seat ?? player?.seat ?? 0,
                address: winner.address,
                amount: winner.amount.toString(),
                formattedAmount: formatUSDCToSimpleDollars(winner.amount.toString()),
                winType: hasElements(winner.cards) ? "showdown" : "uncontested",
                description: winner.description,
                handName: winner.name,
                cards: winner.cards
            };
        });
    }

    // No winners yet
    return null;
}

/**
 * Custom hook to fetch and provide winner information
 * @param tableId The ID of the table (not used - Context manages subscription)
 * @returns Object containing winner information
 */
export const useWinnerInfo = (): WinnerInfoReturn => {
    // Get game state directly from Context - no additional WebSocket connections
    const { gameState, isLoading, error } = useGameStateContext();

    // Content fingerprint of everything getWinnerInfo actually reads, so the
    // result is recomputed when the WINNERS change rather than on every render.
    //
    // Two reasons this matters. This hook is instantiated ~20 times per render
    // pass (Table, all 9 seats, ActionsLog, plus useWinnerCards doubling each of
    // them), and it allocates two Maps and runs ethers formatUnits per winner.
    // And `gameState` is a fresh object on every WS frame, so keying the memo on
    // it directly would miss every time — while winners in fact change once per
    // hand. Same approach as usePlayerChipData's actionsFingerprint (#2455).
    //
    // The leading "s" distinguishes "no game state" ("") from a loaded state
    // with no winners and no players.
    const fingerprint = useMemo(() => {
        if (!gameState) {
            return "";
        }
        const winners = gameState.winners
            .map(w => `${w.seat ?? ""}:${w.address}:${w.amount}:${w.name ?? ""}:${w.description ?? ""}:${(w.cards ?? []).join(",")}`)
            .join("|");
        // getWinnerInfo falls back to a players[] lookup when winner.seat is
        // absent, so the address->seat mapping is part of the input too.
        const seats = gameState.players.map(p => `${p.seat}:${p.address}`).join("|");
        return `s${winners}#${seats}`;
    }, [gameState]);

    // `gameState` is deliberately NOT a dependency: `fingerprint` encodes every
    // field read below, so an unchanged fingerprint means an unchanged result.
    return useMemo<WinnerInfoReturn>(() => {
        const defaultState: WinnerInfoReturn = {
            winnerInfo: null as WinnerInfo[] | null,
            winnerBySeat: new Map<number, WinnerInfo>(),
            error
        };

        // If still loading or error occurred, return default values
        if (isLoading || error || !gameState) {
            return defaultState;
        }

        try {
            // Process winner information
            const winners = getWinnerInfo(gameState);
            // Build the seat index once so per-seat consumers do O(1) lookups
            // instead of each re-scanning winnerInfo by seat (#2455).
            const winnerBySeat = new Map<number, WinnerInfo>();
            if (winners) {
                for (const winner of winners) {
                    winnerBySeat.set(winner.seat, winner);
                }
            }
            const result: WinnerInfoReturn = {
                winnerInfo: winners,
                winnerBySeat,
                error: null
            };

            return result;
        } catch (err) {
            console.error("Error parsing winner information:", err);
            return {
                ...defaultState,
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fingerprint, isLoading, error]);
};
