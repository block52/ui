import { useEffect, useRef, useState } from "react";
import { ActionDTO, PlayerActionType } from "@block52/poker-vm-sdk";
import { useGameStateContext } from "../../context/GameStateContext";
import { isTournamentFormat } from "../../utils/gameFormatUtils";
import { formatActionName } from "../../components/ActionsLog.utils";
import { formatAmount } from "../../utils/accountUtils";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { isEmpty } from "../../utils/guards";

/**
 * Committed-action echo (docs/plans/2026_07_11_action_feedback_ux.md — Approach C).
 *
 * Derives a transient "you did that / they did that" confirmation from committed
 * state alone: it watches `gameState.previousActions` and emits the newest entry
 * per seat as it lands. Because it renders only what the chain/gateway committed,
 * it can never contradict the authoritative state (unlike an optimistic overlay),
 * and it gives opponent actions the same feedback the table otherwise lacks.
 *
 * The panel already threads `previousActions` to MainActionButtons; this hook is a
 * read-only observer and adds no writes. See PlayerSeating for the render side.
 */

/** Betting actions worth echoing on the felt — skip blind posts, deal, join, muck/show. */
const ECHOED_ACTIONS = new Set<string>([
    PlayerActionType.FOLD,
    PlayerActionType.CHECK,
    PlayerActionType.CALL,
    PlayerActionType.BET,
    PlayerActionType.RAISE,
    PlayerActionType.ALL_IN
]);

export interface ActionEchoEntry {
    /** Committed action index — monotonic within a hand; drives the animation key. */
    index: number;
    seat: number;
    action: PlayerActionType;
    /** Display label, e.g. "Raise $6.00" / "Fold" — reuses the tested formatters. */
    label: string;
    /** True when this is the local player's own action (for emphasis). */
    isMe: boolean;
}

/** Map a committed action to a badge entry. Exported for unit testing. */
export function toEntry(action: ActionDTO, isTournament: boolean, myAddress: string | null): ActionEchoEntry {
    const name = formatActionName(action.action);
    // Amount only reads for chip actions and only when non-zero (fold/check carry "0").
    const amount = action.amount && action.amount !== "0" ? ` ${formatAmount(action.amount, undefined, isTournament)}` : "";
    return {
        index: action.index,
        seat: action.seat,
        action: action.action as PlayerActionType,
        label: `${name}${amount}`,
        isMe: !!myAddress && action.playerId?.toLowerCase() === myAddress
    };
}

/**
 * @returns a map of `seat -> latest echoed action`. An entry's `index` bumps only
 *          when that seat commits a new action, so a consumer can key an animation
 *          off it. History (on mount) and blind/deal noise never echo.
 */
export function useAppliedActions(): Record<number, ActionEchoEntry> {
    const { gameState, gameFormat } = useGameStateContext();
    const isTournament = isTournamentFormat(gameFormat);

    // localStorage is synchronous — read once (no setState-in-effect churn).
    const [myAddress] = useState<string | null>(() => localStorage.getItem(STORAGE_KEYS.cosmosAddress)?.toLowerCase() ?? null);

    const [echoes, setEchoes] = useState<Record<number, ActionEchoEntry>>({});
    // Highest committed index we've already turned into an echo.
    const lastIndexRef = useRef<number>(-1);
    // Hand we're tracking — indexes restart each hand, so a change resets the baseline.
    const handNumberRef = useRef<number | null>(null);
    // First observation baselines to "now" so an in-progress hand doesn't replay.
    const initializedRef = useRef<boolean>(false);

    // Deriving transient echo state from incoming WS-driven game state is exactly
    // the "set state in effect" pattern this rule flags; it's intentional here (and
    // matches useAutoNewHand's precedent). Kept guarded by index/hand refs so it
    // only fires on genuinely new committed actions.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!gameState) return;
        const actions: ActionDTO[] = gameState.previousActions ?? [];
        const maxIndex = actions.reduce((m, a) => Math.max(m, a.index), -1);
        const handNumber = gameState.handNumber;

        // First ever run: adopt the current max as the baseline and echo nothing —
        // opening a table mid-hand should not burst every prior action onto the felt.
        if (!initializedRef.current) {
            initializedRef.current = true;
            handNumberRef.current = handNumber;
            lastIndexRef.current = maxIndex;
            return;
        }

        // New hand: indexes reset to 1, so drop the baseline and clear stale badges.
        if (handNumberRef.current !== handNumber) {
            handNumberRef.current = handNumber;
            lastIndexRef.current = -1;
            setEchoes({});
        }

        const fresh = actions.filter(a => a.index > lastIndexRef.current && ECHOED_ACTIONS.has(a.action));
        if (isEmpty(fresh)) return;
        lastIndexRef.current = maxIndex;

        // Keep only the latest action per seat — a burst (e.g. a reconnect state jump
        // spanning several actions) collapses to one badge per seat, never a replay.
        setEchoes(prev => {
            const next = { ...prev };
            for (const a of fresh) next[a.seat] = toEntry(a, isTournament, myAddress);
            return next;
        });
    }, [gameState, isTournament, myAddress]);
    /* eslint-enable react-hooks/set-state-in-effect */

    return echoes;
}
