import { useMemo } from "react";
import { PlayerDTO } from "@block52/poker-vm-sdk";
import { useGameData } from "../../context/gameState/GameDataContext";

/**
 * Shared seat -> player index for the live game state (#2455).
 *
 * The WebSocket hands us a fresh `gameState.players` array on every message.
 * Historically each seat component re-scanned that array with
 * `players.find(p => p.seat === n)`, so a single 9-seat table update ran
 * ~9 independent O(n) scans (O(n²) overall) every message. This hook builds
 * one `Map<seat, PlayerDTO>` per update; consumers do O(1) `.get(seat)`.
 *
 * Built once and memoized on the players array reference, so it recomputes
 * exactly when the players list changes — the same cadence the per-seat
 * scans it replaces would have fired on.
 */
export const usePlayersBySeat = (): Map<number, PlayerDTO> => {
    const { gameState } = useGameData();

    return useMemo<Map<number, PlayerDTO>>(() => {
        const bySeat = new Map<number, PlayerDTO>();
        if (Array.isArray(gameState?.players)) {
            for (const player of gameState.players) {
                bySeat.set(player.seat, player);
            }
        }
        return bySeat;
    }, [gameState?.players]);
};
