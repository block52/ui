import { ActionDTO, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { CLOSING_BET_FLIGHT_MS, CLOSING_BET_HOLD_MS } from "../bus/timing";
import { CHIP_ACTIONS, seatBetChipAmount } from "./chipUtils";
import { hasContent, hasValue, isEmpty, isNullish } from "./guards";

/**
 * Chips for the bet that closed a street, when the snapshot already moved on
 * (block52/ui#975).
 *
 * The engine folds that bet into the same update as the next street, or into
 * the all-in runout. `sumOfBets` is then 0 (or still the pre-call number on a
 * runout sub-frame) and the seat is often `SHOWING`, so the normal chip path
 * draws nothing. The amount comes only from `previousActions`. A seat with no
 * positive chip action in that street is left out — nothing is invented.
 *
 * This never writes `nextToAct`. A runout sub-frame stays at -1 (ui#968).
 */

export interface ClosingSeat {
    address: string;
    seat: number;
    status: PlayerStatus;
    sumOfBets?: string;
}

export interface ClosingBetDraw {
    address: string;
    seat: number;
    /** Street total, in the same wire units as the actions. */
    amount: string;
    /** Newest chip action for that seat on the closed street. */
    action: ActionDTO;
}

export interface ClosingBetView {
    draws: ClosingBetDraw[];
    /** Portion of the drawn chips already inside the snapshot pot. */
    potHoldback: string;
    /**
     * The snapshot pot already includes these bets (the street advanced and
     * this is not a runout sub-frame). The chips should collect into it.
     * Runout sub-frames keep the pre-collect pot, so this stays false until
     * the result.
     */
    collectedIntoPot: boolean;
    /** Stable id of the closed street's chip actions. Empty when nothing is drawn. */
    key: string;
}

export interface ClosingPot {
    pots: string[];
    totalPot: string | undefined;
}

const ROUND_ORDER: readonly TexasHoldemRound[] = [
    TexasHoldemRound.ANTE,
    TexasHoldemRound.PREFLOP,
    TexasHoldemRound.FLOP,
    TexasHoldemRound.TURN,
    TexasHoldemRound.RIVER,
    TexasHoldemRound.SHOWDOWN,
    TexasHoldemRound.END
];

const WHOLE_CHIP = /^\d+$/;

const EMPTY_VIEW: ClosingBetView = {
    draws: [],
    potHoldback: "0",
    collectedIntoPot: false,
    key: ""
};

function roundIndex(round: string | undefined): number {
    if (!hasContent(round)) return -1;
    return ROUND_ORDER.indexOf(round as TexasHoldemRound);
}

function wholeChips(amount: string | undefined): bigint | null {
    if (!hasContent(amount) || !WHOLE_CHIP.test(amount) || amount === "0") return null;
    return BigInt(amount);
}

function committed(sumOfBets: string | undefined): bigint {
    if (!hasContent(sumOfBets) || !WHOLE_CHIP.test(sumOfBets)) return 0n;
    return BigInt(sumOfBets);
}

function isChipAction(action: ActionDTO): boolean {
    return CHIP_ACTIONS.includes(action.action) && hasValue(wholeChips(action.amount));
}

/** Ante blinds stay live for preflop, matching the normal chip pile. */
function streetRounds(round: TexasHoldemRound): readonly TexasHoldemRound[] {
    if (round === TexasHoldemRound.ANTE || round === TexasHoldemRound.PREFLOP) {
        return [TexasHoldemRound.ANTE, TexasHoldemRound.PREFLOP];
    }
    return [round];
}

function latestChipRound(actions: readonly ActionDTO[]): TexasHoldemRound | null {
    let found: TexasHoldemRound | null = null;
    let index = -1;
    for (const action of actions) {
        if (!isChipAction(action)) continue;
        if (roundIndex(action.round) < 0) continue;
        if (action.index >= index) {
            index = action.index;
            found = action.round;
        }
    }
    return found;
}

/**
 * True when the painted snapshot has already moved the closed street's chips
 * into the pot. A runout sub-frame advances the round but keeps the previous
 * pot and a cleared turn pointer, so the chips are not in the pot yet.
 */
export function closingBetsCollected(
    painted: TexasHoldemRound,
    closed: TexasHoldemRound,
    nextToAct: number | undefined,
    winners: readonly unknown[] | undefined
): boolean {
    if (roundIndex(painted) <= roundIndex(closed)) return false;
    const runoutSubFrame = nextToAct === -1
        && isEmpty(winners ? [...winners] : undefined)
        && painted !== TexasHoldemRound.END
        && painted !== TexasHoldemRound.SHOWDOWN;
    return !runoutSubFrame;
}

function streetTotal(address: string, rounds: readonly TexasHoldemRound[], actions: readonly ActionDTO[]): bigint {
    return actions.reduce((sum, action) => {
        if (action.playerId !== address || !rounds.includes(action.round) || !isChipAction(action)) return sum;
        const amount = wholeChips(action.amount);
        return isNullish(amount) ? sum : sum + amount;
    }, 0n);
}

function newestChipAction(address: string, rounds: readonly TexasHoldemRound[], actions: readonly ActionDTO[]): ActionDTO | null {
    let newest: ActionDTO | null = null;
    for (const action of actions) {
        if (action.playerId !== address || !rounds.includes(action.round) || !isChipAction(action)) continue;
        if (!newest || action.index >= newest.index) newest = action;
    }
    return newest;
}

export function deriveClosingBets(input: {
    round: TexasHoldemRound | undefined;
    nextToAct: number | undefined;
    winners: readonly unknown[] | undefined;
    players: readonly ClosingSeat[];
    previousActions: readonly ActionDTO[];
}): ClosingBetView {
    const paintedIndex = roundIndex(input.round);
    const closed = latestChipRound(input.previousActions);
    if (paintedIndex < 0 || !input.round || !closed) return EMPTY_VIEW;

    const rounds = streetRounds(closed);
    const collectedIntoPot = closingBetsCollected(input.round, closed, input.nextToAct, input.winners);
    const draws: ClosingBetDraw[] = [];
    let holdback = 0n;

    for (const player of input.players) {
        if (!hasContent(player.address)) continue;
        const street = streetTotal(player.address, rounds, input.previousActions);
        if (street <= 0n) continue;
        const normal = BigInt(seatBetChipAmount(player, input.round, [...input.previousActions]) || "0");
        if (street <= normal) continue;
        const action = newestChipAction(player.address, rounds, input.previousActions);
        if (!action) continue;

        const inPot = collectedIntoPot ? street : (street < committed(player.sumOfBets) ? street : committed(player.sumOfBets));
        const newlyInPot = inPot > normal ? inPot - normal : 0n;
        holdback += newlyInPot;
        draws.push({
            address: player.address,
            seat: player.seat,
            amount: street.toString(),
            action
        });
    }

    if (isEmpty(draws)) return EMPTY_VIEW;

    const indexes = input.previousActions
        .filter(action => rounds.includes(action.round) && isChipAction(action))
        .map(action => action.index)
        .sort((a, b) => a - b);

    return {
        draws,
        potHoldback: holdback.toString(),
        collectedIntoPot,
        key: `${closed}:${indexes.join(".")}`
    };
}

function nonNegative(amount: string | undefined): bigint {
    if (!hasContent(amount) || !WHOLE_CHIP.test(amount)) return 0n;
    return BigInt(amount);
}

/**
 * Subtract `holdback` from the pot the table paints, so the chips in front of
 * the seats are not also inside the pot number. Current-round money that lives
 * only in `totalPot` (the gap above the pots array) is reduced first; the rest
 * comes off the last pot, which is the side pot a short all-in just created.
 * Pots are never taken below zero.
 */
export function applyPotHoldback(
    pots: readonly string[],
    totalPot: string | undefined,
    holdback: string
): ClosingPot {
    const hold = nonNegative(holdback);
    if (hold === 0n) {
        return { pots: [...pots], totalPot };
    }

    const values = pots.map(pot => nonNegative(pot));
    const potSum = values.reduce((sum, pot) => sum + pot, 0n);
    const total = hasContent(totalPot) ? nonNegative(totalPot) : potSum;
    let remaining = hold < total ? hold : total;
    const excess = total > potSum ? total - potSum : 0n;
    const fromExcess = remaining < excess ? remaining : excess;
    remaining -= fromExcess;

    const next = [...values];
    for (let index = next.length - 1; index >= 0 && remaining > 0n; index -= 1) {
        const take = remaining < next[index] ? remaining : next[index];
        next[index] -= take;
        remaining -= take;
    }

    const subtracted = (hold < total ? hold : total) - remaining;
    return {
        pots: next.map(pot => pot.toString()),
        totalPot: (total - subtracted).toString()
    };
}

export type ClosingBetPhase = "off" | "shown" | "collecting";

/**
 * Whether the drawn chips are still in front of the seats.
 * A runout (`collectedIntoPot` false) keeps them up. A collected snapshot
 * holds them for {@link CLOSING_BET_HOLD_MS}, flies them for
 * {@link CLOSING_BET_FLIGHT_MS}, then lets the pot show the full amount.
 * `collectAt` is the result beat of a runout, which skips the hold because
 * the chips were already up.
 */
export function closingBetPhase(
    view: ClosingBetView,
    clock: { key: string; at: number; collectAt: number | null; now: number }
): ClosingBetPhase {
    if (isEmpty(view.draws) || clock.key !== view.key) return "off";
    if (!view.collectedIntoPot) return "shown";
    if (hasValue(clock.collectAt)) {
        return clock.now - clock.collectAt < CLOSING_BET_FLIGHT_MS ? "collecting" : "off";
    }
    if (clock.at === Number.NEGATIVE_INFINITY) return "off";
    const elapsed = clock.now - clock.at;
    if (elapsed < CLOSING_BET_HOLD_MS) return "shown";
    if (elapsed < CLOSING_BET_HOLD_MS + CLOSING_BET_FLIGHT_MS) return "collecting";
    return "off";
}
