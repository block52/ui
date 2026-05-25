import { useEffect, useRef } from "react";
import { PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { useGameStateContext } from "../../context/GameStateContext";

/**
 * Watchdog for issue #409: hole cards occasionally not visible to the owning player.
 *
 * The owning player should always see their two hole cards once a hand reaches PREFLOP and they
 * are in an active status. If we see ourselves with an in-hand status but a missing/incomplete
 * holeCards array, the WebSocket state is out of sync with what the server thinks we own —
 * something a manual page refresh has historically fixed. This hook performs that recovery
 * automatically by tearing down and re-establishing the subscription.
 *
 * Guarded against loops: at most 2 attempts per handNumber, with a 1.5s grace period so transient
 * message-ordering hiccups (state arriving a tick before the per-player cards) self-heal first.
 */

const ROUNDS_THAT_DEAL_CARDS: ReadonlySet<TexasHoldemRound> = new Set([
    TexasHoldemRound.PREFLOP,
    TexasHoldemRound.FLOP,
    TexasHoldemRound.TURN,
    TexasHoldemRound.RIVER,
    TexasHoldemRound.SHOWDOWN
]);

const STATUSES_WITH_HOLE_CARDS: ReadonlySet<PlayerStatus> = new Set([
    PlayerStatus.ACTIVE,
    PlayerStatus.ALL_IN,
    PlayerStatus.SHOWING
]);

const MAX_ATTEMPTS_PER_HAND = 2;
const GRACE_PERIOD_MS = 1500;

export const useHoleCardWatchdog = (tableId: string | undefined): void => {
    const { gameState, subscribeToTable, unsubscribeFromTable, isReplayMode } = useGameStateContext();

    // Per-hand attempt counter — reset when handNumber advances.
    const attemptRef = useRef<{ handNumber: number; count: number }>({ handNumber: -1, count: 0 });
    // Pending recovery timer; nulled out when healthy or when fired.
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!tableId || !gameState || isReplayMode) return;

        const round = gameState.round;
        if (!round || !ROUNDS_THAT_DEAL_CARDS.has(round)) return;

        const ownAddress = localStorage.getItem("user_cosmos_address");
        if (!ownAddress) return;

        const me = gameState.players?.find(p => p.address?.toLowerCase() === ownAddress.toLowerCase());
        const isUnhealthy = !!me
            && !!me.status
            && STATUSES_WITH_HOLE_CARDS.has(me.status)
            && (me.holeCards?.length ?? 0) !== 2;

        // Healthy (or not applicable): cancel any pending recovery and bail.
        if (!isUnhealthy) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        // Reset attempt budget when we cross into a new hand.
        const handNumber = gameState.handNumber ?? 0;
        if (attemptRef.current.handNumber !== handNumber) {
            attemptRef.current = { handNumber, count: 0 };
        }
        if (attemptRef.current.count >= MAX_ATTEMPTS_PER_HAND) return;

        // Do not stack timers — if one is already scheduled, let it run.
        if (timerRef.current) return;

        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            attemptRef.current.count += 1;
            console.error(
                `[useHoleCardWatchdog] Owning player status=${me.status} but holeCards.length=${me.holeCards?.length ?? 0} ` +
                `in round=${round} (hand #${handNumber}). Re-subscribing (attempt ${attemptRef.current.count}/${MAX_ATTEMPTS_PER_HAND}). ` +
                "See https://github.com/block52/ui/issues/409"
            );
            unsubscribeFromTable();
            subscribeToTable(tableId);
        }, GRACE_PERIOD_MS);
    }, [
        tableId,
        gameState,
        isReplayMode,
        subscribeToTable,
        unsubscribeFromTable
    ]);

    // Clean up any pending timer on unmount.
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);
};
