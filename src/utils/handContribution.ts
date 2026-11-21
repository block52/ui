/**
 * What one player put into a finished hand, from the chain's public action log.
 *
 * The indexer hand list has won_amount (the engine's winner.amount: that
 * player's share of the pot) and not the chips they put in. The hand's final
 * public state — the same snapshot hand replay reads at the hand_ended block —
 * carries previousActions for that hand. Amounts are the chips moved by that
 * action (a raise is the extra chips, not the total), the same unit as
 * won_amount: micro-USDC on cash, chips on Sit & Go and tournament.
 *
 * Contribution is blinds, antes, dead blinds, bets, calls, raises and all-ins.
 * Join, leave and top-up amounts are a buy-in, not this hand. Fold, check,
 * deal, muck and show move no chips.
 *
 * An uncalled excess is subtracted only when another player is all-in for less,
 * because that excess never enters the pot the chain awards. A bet everyone
 * folds to is paid back inside won_amount, so it stays in the sum and the two
 * cancel in profit (won_amount − contributed). Subtracting it again would
 * count the same chips twice.
 */
import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { PlayerHand } from "../types/players";
import { hasContent, hasElements, hasValue, isNumber } from "./guards";
import { handKey } from "./handHistory";
import { snapshotHeights } from "./handReplay";
import { sharedHistoryUnit, type HistoryMoneyUnit } from "./profileHistoryStats";
import { ALL_SESSION_GAMES, filterSessionRows, type SessionGameLabel } from "./sessionGameDisplay";

/** Chip-moving actions. Ante and dead small blind are chain names the SDK enum does not list. */
const CONTRIBUTING = new Set<string>([
    PlayerActionType.SMALL_BLIND,
    PlayerActionType.BIG_BLIND,
    PlayerActionType.BET,
    PlayerActionType.CALL,
    PlayerActionType.RAISE,
    PlayerActionType.ALL_IN,
    "ante",
    "dead-small-blind"
]);

export interface ContributionAction {
    playerId?: string;
    action?: string;
    amount?: string;
    /** Street the action was dealt on. Playing style uses it; contribution does not. */
    round?: string;
}

/** One pot winner on a public snapshot. Playing style uses the address, amount, and whether cards were shown. */
export interface HandLogWinner {
    address?: string;
    amount?: string;
    cards?: string[];
}

/** The fields of a public game state this read uses. A full chain snapshot satisfies it. */
export interface ContributionSnapshot {
    handNumber?: number;
    previousActions?: ContributionAction[] | null;
    communityCards?: string[];
    round?: string;
    winners?: HandLogWinner[];
}

export interface HandContributionTarget {
    gameId: string;
    handNumber: number;
    blockHeight: number;
}

/** Same identity My Hands uses: one table cannot repeat a hand number. */
export function handKeyForTarget(hand: Pick<HandContributionTarget, "gameId" | "handNumber">): string {
    return handKey({ game_id: hand.gameId, hand_number: hand.handNumber });
}

/** A whole chip count. A blank amount put nothing in. Anything else unreadable makes the hand unknown. */
function chipAmount(amount: string | undefined): number | undefined {
    if (!hasContent(amount)) return 0;
    if (!/^\d+$/.test(amount)) return undefined;
    const value = Number(amount);
    if (!isNumber(value) || !Number.isSafeInteger(value)) return undefined;
    return value;
}

/**
 * Chips (or micro-USDC) this player put into the hand.
 * Undefined when the log is missing or an amount cannot be read — never a guessed 0.
 */
export function contributionFromActions(actions: ContributionAction[] | null | undefined, playerId: string | undefined): number | undefined {
    if (!hasContent(playerId) || !hasElements(actions)) return undefined;
    const want = playerId.toLowerCase();
    const totals = new Map<string, number>();
    const allIn = new Set<string>();
    for (const action of actions) {
        const id = hasContent(action.playerId) ? action.playerId.toLowerCase() : "";
        if (!hasContent(id)) continue;
        const name = hasContent(action.action) ? action.action : "";
        if (name === PlayerActionType.ALL_IN) allIn.add(id);
        if (!CONTRIBUTING.has(name)) continue;
        const chips = chipAmount(action.amount);
        if (!hasValue(chips)) return undefined;
        const next = (totals.get(id) ?? 0) + chips;
        if (!Number.isSafeInteger(next)) return undefined;
        totals.set(id, next);
    }
    const mine = totals.get(want) ?? 0;
    let highestOther = 0;
    let shorterAllIn = false;
    for (const [id, total] of totals) {
        if (id === want) continue;
        if (total > highestOther) highestOther = total;
        if (allIn.has(id) && total < mine) shorterAllIn = true;
    }
    const excess = mine > highestOther ? mine - highestOther : 0;
    return shorterAllIn ? mine - excess : mine;
}

/**
 * The hand's final public state. The end block is first; if that block already
 * shows the next hand, the block before it still has this hand's last action.
 * Undefined when neither block can be read or neither is still this hand.
 */
export async function readHandLogAtHeights(
    hand: HandContributionTarget,
    stateAt: (gameId: string, height: number) => Promise<ContributionSnapshot>
): Promise<ContributionSnapshot | undefined> {
    if (!Number.isSafeInteger(hand.handNumber) || hand.handNumber < 1) return undefined;
    if (!Number.isSafeInteger(hand.blockHeight) || hand.blockHeight < 1) return undefined;
    for (const height of snapshotHeights(hand.blockHeight)) {
        try {
            const state = await stateAt(hand.gameId, height);
            if (state.handNumber !== hand.handNumber) continue;
            return state;
        } catch (err) {
            console.error("Failed to read hand state for contribution:", err);
        }
    }
    return undefined;
}

/** Contribution from the hand's final public state. Undefined when that state cannot be read. */
export async function readContributionAtHeights(
    playerId: string,
    hand: HandContributionTarget,
    stateAt: (gameId: string, height: number) => Promise<ContributionSnapshot>
): Promise<number | undefined> {
    if (!hasContent(playerId)) return undefined;
    const state = await readHandLogAtHeights(hand, stateAt);
    if (!hasValue(state)) return undefined;
    return contributionFromActions(state.previousActions, playerId);
}

/**
 * Current node, then the nodes after it (the official history node when the
 * current one prunes). The first log that can be summed wins. Null when none can.
 */
export async function readHandContribution<T>(
    playerId: string,
    hand: HandContributionTarget,
    endpoints: T[],
    stateAt: (endpoint: T, gameId: string, height: number) => Promise<ContributionSnapshot>
): Promise<number | null> {
    if (!hasElements(endpoints)) return null;
    for (const endpoint of endpoints) {
        const value = await readContributionAtHeights(playerId, hand, (gameId, height) => stateAt(endpoint, gameId, height));
        if (hasValue(value)) return value;
    }
    return null;
}

/**
 * Hands in this filter when they share one money unit. Undefined when the
 * selection is empty, mixes cash with chips, or a table format is unknown —
 * profit has no single figure then, and nothing is fetched.
 */
export function profitHandsToMeasure(
    hands: Array<Pick<PlayerHand, "game_id" | "hand_number" | "block_height">>,
    labels: Record<string, SessionGameLabel | undefined>,
    units: Record<string, HistoryMoneyUnit | undefined>,
    filterKey: string
): HandContributionTarget[] | undefined {
    const selected = filterSessionRows(
        hands.map(hand => ({ ...hand, gameId: hand.game_id })),
        labels,
        hasContent(filterKey) ? filterKey : ALL_SESSION_GAMES
    );
    if (!hasValue(sharedHistoryUnit(selected.map(hand => hand.gameId), units))) return undefined;
    return selected.map(hand => ({ gameId: hand.game_id, handNumber: hand.hand_number, blockHeight: hand.block_height }));
}

/** Shown once the read has finished and at least one selected hand had no action log on the node. */
export function handContributionNote(unavailable: number, requested: number): string | undefined {
    if (!isNumber(unavailable) || !Number.isSafeInteger(unavailable) || unavailable <= 0) return undefined;
    if (!isNumber(requested) || !Number.isSafeInteger(requested) || requested < unavailable) return undefined;
    const noun = requested === 1 ? "hand" : "hands";
    return `Skips ${unavailable.toLocaleString()} of ${requested.toLocaleString()} ${noun} no longer on the node.`;
}
