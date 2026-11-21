/**
 * Playing style for one wallet, from the public action log of each finished hand.
 *
 * The indexer profile still returns vpip, pfr, aggression_factor, wtsd and
 * won_at_showdown. Those columns stay 0 except aggression_factor, which is only
 * (bets + raises) / calls and drops all-ins. The profile panel does not print
 * them. It sums the same snapshots Biggest Hand Profit reads.
 *
 * VPIP is a preflop call, bet, raise, or all-in. Blinds, antes, dead blinds,
 * checks and folds are forced or free. PFR is a preflop bet or raise, or an
 * all-in whose chips — blinds included — raise the current bet. An all-in that
 * only calls is VPIP and not PFR. Aggression is (bets + raises + all-in raises)
 * / (calls + all-in calls), a ratio, on every street. Saw flop means they did
 * not fold before the flop and a flop was dealt. Showdown means they never
 * folded and the hand reached showdown. Won at showdown means they were awarded
 * chips there.
 *
 * A hand whose log cannot be read is left out of every denominator.
 */
import { PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { PlayerHand } from "../types/players";
import { hasContent, hasElements, hasValue, isNumber, safeLength } from "./guards";
import { handKey } from "./handHistory";
import type { ContributionAction, ContributionSnapshot, HandContributionTarget } from "./handContribution";

const LIVE = new Set<string>([
    PlayerActionType.SMALL_BLIND,
    PlayerActionType.BIG_BLIND,
    PlayerActionType.BET,
    PlayerActionType.CALL,
    PlayerActionType.RAISE,
    PlayerActionType.ALL_IN
]);

const VOLUNTARY = new Set<string>([PlayerActionType.CALL, PlayerActionType.BET, PlayerActionType.RAISE, PlayerActionType.ALL_IN]);

const LATER = new Set<string>([TexasHoldemRound.FLOP, TexasHoldemRound.TURN, TexasHoldemRound.RIVER, TexasHoldemRound.SHOWDOWN]);

const PENDING = "…";
const UNKNOWN = "—";

export interface PlayingStyleHand extends HandContributionTarget {
    /** Indexer won_amount. 0 when they did not win or the figure cannot be read. */
    wonAmount: number;
}

/** One hand's flags. Counts are this hand only. */
export interface HandStyle {
    vpip: boolean;
    pfr: boolean;
    bets: number;
    raises: number;
    calls: number;
    allInRaises: number;
    allInCalls: number;
    sawFlop: boolean;
    showdown: boolean;
    wonShowdown: boolean;
}

export interface PlayingStyleCounts {
    hands: number;
    vpip: number;
    pfr: number;
    /** Bets, raises, and all-ins that raised the bet. */
    aggressive: number;
    /** Calls and all-ins that only called. */
    calls: number;
    sawFlop: number;
    showdown: number;
    wonShowdown: number;
}

export interface PlayingStyleDisplay {
    vpip: string;
    pfr: string;
    aggression: string;
    wtsd: string;
    wssd: string;
}

/** Title, the full name shown in bold, and the rest of the explanation bubble. */
export interface PlayingStyleFigure {
    key: keyof PlayingStyleDisplay;
    title: string;
    name: string;
    explanation: string;
}

export const PLAYING_STYLE_FIGURES: readonly PlayingStyleFigure[] = [
    {
        key: "vpip",
        title: "VPIP",
        name: "Voluntarily put money in pot",
        explanation: "How often you put chips in preflop by choice, by calling or raising, not just posting blinds. It shows how loose you play."
    },
    {
        key: "pfr",
        title: "PFR",
        name: "Preflop raise",
        explanation: "How often you raise preflop. It shows how aggressive you are before the flop."
    },
    {
        key: "aggression",
        title: "Aggression",
        name: "Aggression",
        explanation: "Bets and raises divided by calls. Above 1 means you bet more than you call."
    },
    {
        key: "wtsd",
        title: "WTSD",
        name: "Went to showdown",
        explanation: "Of the hands where you saw the flop, how often you reached showdown."
    },
    {
        key: "wssd",
        title: "W$SD",
        name: "Won money at showdown",
        explanation: "Of the hands that reached showdown, how often you won."
    }
];

/** A whole chip count. A blank amount put nothing in. Anything else is unreadable. */
function wholeChips(amount: string | undefined): number | undefined {
    if (!hasContent(amount)) return 0;
    if (!/^\d+$/.test(amount)) return undefined;
    const value = Number(amount);
    if (!isNumber(value) || !Number.isSafeInteger(value)) return undefined;
    return value;
}

function maxOther(totals: Map<string, number>, playerId: string): number {
    let highest = 0;
    for (const [id, total] of totals) {
        if (id !== playerId && total > highest) highest = total;
    }
    return highest;
}

function preflopStreet(round: string): boolean {
    return !hasContent(round) || round === TexasHoldemRound.ANTE || round === TexasHoldemRound.PREFLOP;
}

/**
 * Finished hands to read, one per table and hand number.
 * A hand number or end block that cannot be queried is counted in `dropped` and not fetched.
 */
export function playingStyleHands(hands: Array<Pick<PlayerHand, "game_id" | "hand_number" | "block_height" | "won_amount">>): {
    hands: PlayingStyleHand[];
    dropped: number;
} {
    const seen = new Set<string>();
    const selected: PlayingStyleHand[] = [];
    let dropped = 0;
    for (const hand of hands) {
        if (!Number.isSafeInteger(hand.hand_number) || hand.hand_number < 1 || !Number.isSafeInteger(hand.block_height) || hand.block_height < 1) {
            dropped += 1;
            continue;
        }
        const key = handKey({ game_id: hand.game_id, hand_number: hand.hand_number });
        if (seen.has(key)) continue;
        seen.add(key);
        const won = isNumber(hand.won_amount) && Number.isSafeInteger(hand.won_amount) && hand.won_amount > 0 ? hand.won_amount : 0;
        selected.push({ gameId: hand.game_id, handNumber: hand.hand_number, blockHeight: hand.block_height, wonAmount: won });
    }
    return { hands: selected, dropped };
}

/**
 * This player's style for one hand.
 * Undefined when the log is missing or a chip amount cannot be read — never a guessed zero hand.
 */
export function styleFromSnapshot(
    snapshot: ContributionSnapshot | null | undefined,
    playerId: string | undefined,
    wonAmount: number
): HandStyle | undefined {
    if (!hasContent(playerId) || !hasValue(snapshot) || !hasElements(snapshot.previousActions)) return undefined;
    const want = playerId.toLowerCase();
    const totals = new Map<string, number>();
    let street = "";
    let vpip = false;
    let pfr = false;
    let bets = 0;
    let raises = 0;
    let calls = 0;
    let allInRaises = 0;
    let allInCalls = 0;
    let foldedPre = false;
    let foldedAny = false;
    let later = false;
    for (const action of snapshot.previousActions) {
        const round = hasContent(action.round) ? action.round : "";
        const bucket = round === TexasHoldemRound.ANTE || round === TexasHoldemRound.PREFLOP ? TexasHoldemRound.PREFLOP : round;
        if (bucket !== street) {
            street = bucket;
            totals.clear();
        }
        const classified = classifyLive(action, want, totals);
        if (!hasValue(classified)) return undefined;
        if (classified.allInRaise) {
            allInRaises += 1;
            if (bucket === TexasHoldemRound.PREFLOP) pfr = true;
        }
        if (classified.allInCall) allInCalls += 1;
        if (!classified.mine) continue;
        if (LATER.has(round)) later = true;
        if (action.action === PlayerActionType.FOLD) {
            foldedAny = true;
            if (preflopStreet(round)) foldedPre = true;
        }
        if (round === TexasHoldemRound.PREFLOP && hasContent(action.action) && VOLUNTARY.has(action.action)) vpip = true;
        if (round === TexasHoldemRound.PREFLOP && (action.action === PlayerActionType.BET || action.action === PlayerActionType.RAISE)) pfr = true;
        if (action.action === PlayerActionType.BET) bets += 1;
        else if (action.action === PlayerActionType.RAISE) raises += 1;
        else if (action.action === PlayerActionType.CALL) calls += 1;
    }
    const flopDealt = later || safeLength(snapshot.communityCards) >= 3 || snapshot.previousActions.some(action => hasContent(action.round) && LATER.has(action.round));
    const sawFlop = !foldedPre && flopDealt;
    const showed = hasElements(snapshot.winners) && snapshot.winners.some(winner => hasElements(winner.cards));
    const showAct = snapshot.previousActions.some(action => action.action === PlayerActionType.SHOW || action.action === PlayerActionType.MUCK);
    const showdown = !foldedAny && (showed || showAct || snapshot.round === TexasHoldemRound.SHOWDOWN);
    const wonChain = wonAtShowdown(snapshot, want);
    if (!hasValue(wonChain)) return undefined;
    const wonIndexer = isNumber(wonAmount) && Number.isSafeInteger(wonAmount) && wonAmount > 0;
    return {
        vpip,
        pfr,
        bets,
        raises,
        calls,
        allInRaises,
        allInCalls,
        sawFlop,
        showdown,
        wonShowdown: showdown && (wonChain > 0 || wonIndexer)
    };
}

interface LiveClass {
    mine: boolean;
    allInRaise: boolean;
    allInCall: boolean;
}

/** Undefined when a live chip amount cannot be read. */
function classifyLive(action: ContributionAction, want: string, totals: Map<string, number>): LiveClass | undefined {
    const name = hasContent(action.action) ? action.action : "";
    const id = hasContent(action.playerId) ? action.playerId.toLowerCase() : "";
    const mine = id === want;
    if (!LIVE.has(name)) return { mine, allInRaise: false, allInCall: false };
    const chips = wholeChips(action.amount);
    if (!hasValue(chips)) return undefined;
    if (!hasContent(id)) return { mine, allInRaise: false, allInCall: false };
    const before = maxOther(totals, id);
    const next = (totals.get(id) ?? 0) + chips;
    if (!Number.isSafeInteger(next)) return undefined;
    totals.set(id, next);
    const raising = mine && name === PlayerActionType.ALL_IN && next > before;
    const calling = mine && name === PlayerActionType.ALL_IN && next <= before;
    return { mine, allInRaise: raising, allInCall: calling };
}

/** Chips the chain awarded this player. Undefined when a winner amount cannot be read. */
function wonAtShowdown(snapshot: ContributionSnapshot, want: string): number | undefined {
    if (!hasElements(snapshot.winners)) return 0;
    let won = 0;
    for (const winner of snapshot.winners) {
        if (!hasContent(winner.address) || winner.address.toLowerCase() !== want) continue;
        const amount = wholeChips(winner.amount);
        if (!hasValue(amount)) return undefined;
        won = amount;
    }
    return won;
}

export function emptyPlayingStyle(): PlayingStyleCounts {
    return { hands: 0, vpip: 0, pfr: 0, aggressive: 0, calls: 0, sawFlop: 0, showdown: 0, wonShowdown: 0 };
}

/** Add one readable hand. The result is a new object. */
export function addHandStyle(total: PlayingStyleCounts, hand: HandStyle): PlayingStyleCounts {
    return {
        hands: total.hands + 1,
        vpip: total.vpip + (hand.vpip ? 1 : 0),
        pfr: total.pfr + (hand.pfr ? 1 : 0),
        aggressive: total.aggressive + hand.bets + hand.raises + hand.allInRaises,
        calls: total.calls + hand.calls + hand.allInCalls,
        sawFlop: total.sawFlop + (hand.sawFlop ? 1 : 0),
        showdown: total.showdown + (hand.showdown ? 1 : 0),
        wonShowdown: total.wonShowdown + (hand.wonShowdown ? 1 : 0)
    };
}

function formatRate(count: number, total: number): string {
    if (!isNumber(count) || !isNumber(total) || !Number.isSafeInteger(count) || !Number.isSafeInteger(total) || total <= 0 || count < 0) return UNKNOWN;
    return `${((100 * count) / total).toFixed(2)}%`;
}

function formatRatio(aggressive: number, calls: number): string {
    if (!isNumber(aggressive) || !isNumber(calls) || !Number.isSafeInteger(aggressive) || !Number.isSafeInteger(calls) || calls <= 0 || aggressive < 0) {
        return UNKNOWN;
    }
    return (aggressive / calls).toFixed(2);
}

/** The five panel figures. Pending reads stay an ellipsis. A zero denominator stays an em dash. */
export function formatPlayingStyle(counts: PlayingStyleCounts, pending: boolean): PlayingStyleDisplay {
    if (pending) return { vpip: PENDING, pfr: PENDING, aggression: PENDING, wtsd: PENDING, wssd: PENDING };
    return {
        vpip: formatRate(counts.vpip, counts.hands),
        pfr: formatRate(counts.pfr, counts.hands),
        aggression: formatRatio(counts.aggressive, counts.calls),
        wtsd: formatRate(counts.showdown, counts.sawFlop),
        wssd: formatRate(counts.wonShowdown, counts.showdown)
    };
}

/** One quiet line: how many hands the figures use, and how many logs the node no longer has. */
export function playingStyleNote(based: number, skipped: number): string | undefined {
    if (!isNumber(based) || !Number.isSafeInteger(based) || based < 0) return undefined;
    if (!isNumber(skipped) || !Number.isSafeInteger(skipped) || skipped < 0) return undefined;
    if (based === 0 && skipped === 0) return undefined;
    const basedNoun = based === 1 ? "hand" : "hands";
    const line = `Based on ${based.toLocaleString()} ${basedNoun}.`;
    if (skipped === 0) return line;
    const skippedNoun = skipped === 1 ? "hand" : "hands";
    return `${line} Skips ${skipped.toLocaleString()} ${skippedNoun} the node no longer has.`;
}
