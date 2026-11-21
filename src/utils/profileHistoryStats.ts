/**
 * Per-variant records for the profile History panel.
 *
 * The indexer profile still returns biggest_pot_won, biggest_hand_profit and
 * longest_session_blocks, and the page used to print them. They stay 0. The
 * player_stats columns default to 0, and update_player_stats never writes
 * them — GetPlayerProfile only SELECTs the stored zeros. Formatting those
 * zeros (and any chip amount) with formatMicroUsd is what showed 0.00 / 0.00 / 0.
 *
 * Longest session is leave block minus join block, using the same leave block
 * Session History already shows (indexer leave, prize-claim height, or the
 * chain elimination block once that lookup has finished). An open seat has no
 * leave block, so it is left out rather than counted as 0.
 *
 * Biggest pot won is the largest amount a hand record awarded this player
 * (PlayerHand.won_amount, the engine's winner.amount: their share of the pot).
 * Cash hands are micro-USDC. Sit & Go and tournament hands are chips. A
 * selection that mixes those units, or that includes a winning hand whose
 * table format is unknown, has no single figure — the panel shows an em dash.
 *
 * Biggest hand profit is the pot awarded minus what this player put into the
 * hand. The hand list does not record that contribution. Pass `contributed`
 * only when the chain's action log for that hand was actually read
 * (see handContribution). Hands still unread, or no longer on the node, are
 * left out of the figure rather than counted as 0.
 */
import type { PlayerHand } from "../types/players";
import { hasContent, hasValue, isEmpty, isNumber } from "./guards";
import { handKey } from "./handHistory";
import { formatMicroUsd } from "./moneyDisplay";
import type { SessionPrizeRow } from "./playerPrizeClaims";
import { ALL_SESSION_GAMES, filterSessionRows, type SessionGameLabel } from "./sessionGameDisplay";
import { sessionBustFor, sessionLeaveBlock } from "./sessionBust";
import { isCashFormat, isTournamentFormat } from "@block52/poker-vm-sdk";
import { toGameFormat } from "./gameFormatUtils";
import type { GamePrizeMeta } from "./transactionUtils";
import { sameTournamentSession } from "./playerTournamentEntries";

/** Dollars for a cash table. Chips for a Sit & Go or tournament. */
export type HistoryMoneyUnit = "usd" | "chips";

export interface HistorySessionSpan {
    gameId: string;
    joinBlock: number;
    /** Absent while the seat is still open, or a bust block has not been read. */
    leaveBlock?: number;
}

export interface HistoryHandAmount {
    gameId: string;
    /** Set on indexer rows so a chain contribution can be attached to this hand. */
    handNumber?: number;
    /** Pot share awarded to this player. 0 when they did not win the hand. */
    wonAmount: number;
    /**
     * What this player put into the hand, in the same unit as wonAmount.
     * Absent when the hand record does not say — profit is then unknown.
     */
    contributed?: number;
}

export interface HistoryVariantStats {
    /** Undefined when no selected session has a positive length. */
    longestSessionBlocks?: number;
    /** Undefined when no selected winning hand shares one money unit. */
    biggestPotWon?: number;
    potUnit?: HistoryMoneyUnit;
    /** Undefined when no selected hand records what the player put in. */
    biggestHandProfit?: number;
    profitUnit?: HistoryMoneyUnit;
}

/** Cash is USDC. Sit & Go and tournament stacks are chips. Anything else is unknown. */
export function historyMoneyUnit(format: string | undefined): HistoryMoneyUnit | undefined {
    const parsed = toGameFormat(format);
    if (!hasValue(parsed)) return undefined;
    if (isCashFormat(parsed)) return "usd";
    if (isTournamentFormat(parsed)) return "chips";
    return undefined;
}

export function historyMoneyUnits(metas: Record<string, GamePrizeMeta | undefined>): Record<string, HistoryMoneyUnit | undefined> {
    const units: Record<string, HistoryMoneyUnit | undefined> = {};
    for (const [id, meta] of Object.entries(metas)) {
        units[id] = historyMoneyUnit(meta?.format);
    }
    return units;
}

/** The indexer hand row, reduced to the amounts this panel can read. No contribution until the chain log is read. */
export function handsForHistory(hands: PlayerHand[]): HistoryHandAmount[] {
    return hands.map(hand => ({ gameId: hand.game_id, handNumber: hand.hand_number, wonAmount: hand.won_amount }));
}

/** Attaches a chain contribution where that hand's log was read. A missing key leaves the hand unmeasured. */
export function withHandContributions(hands: HistoryHandAmount[], contributedByKey: Record<string, number | undefined>): HistoryHandAmount[] {
    return hands.map(hand => {
        if (!isNumber(hand.handNumber)) return hand;
        const contributed = contributedByKey[handKey({ game_id: hand.gameId, hand_number: hand.handNumber })];
        if (!hasValue(contributed)) return hand;
        return { ...hand, contributed };
    });
}

/**
 * One span per session row. The leave block is the one the table prints:
 * the row's own leave (indexer or prize claim), otherwise the elimination
 * block for a confirmed bust.
 */
export function sessionSpansForHistory(
    rows: SessionPrizeRow[],
    metas: Record<string, GamePrizeMeta | undefined>,
    player: string | undefined,
    eliminatedAt: Record<string, number | null | undefined>
): HistorySessionSpan[] {
    return rows.map(row => ({
        gameId: row.gameId,
        joinBlock: row.joinBlock,
        leaveBlock: sessionLeaveBlock(row, hasContent(player) ? sessionBustFor(row, rows, metas[row.gameId], player) : undefined, eliminatedAt[row.gameId])
    }));
}

function positiveLength(span: HistorySessionSpan): number | undefined {
    if (!isNumber(span.joinBlock) || !isNumber(span.leaveBlock)) return undefined;
    if (!Number.isSafeInteger(span.joinBlock) || !Number.isSafeInteger(span.leaveBlock)) return undefined;
    const length = span.leaveBlock - span.joinBlock;
    if (length <= 0) return undefined;
    return length;
}

function longestBlocks(spans: HistorySessionSpan[]): number | undefined {
    let best: number | undefined;
    for (const span of spans) {
        const length = positiveLength(span);
        if (!hasValue(length)) continue;
        if (!hasValue(best) || length > best) best = length;
    }
    return best;
}

/** One unit shared by every id, or undefined when the set is empty, mixed, or missing a format. */
export function sharedHistoryUnit(gameIds: string[], units: Record<string, HistoryMoneyUnit | undefined>): HistoryMoneyUnit | undefined {
    if (isEmpty(gameIds)) return undefined;
    let agreed: HistoryMoneyUnit | undefined;
    for (const gameId of gameIds) {
        const unit = units[gameId];
        if (!hasValue(unit)) return undefined;
        if (!hasValue(agreed)) {
            agreed = unit;
            continue;
        }
        if (agreed !== unit) return undefined;
    }
    return agreed;
}

function finiteNumber(value: number): boolean {
    return isNumber(value) && Number.isFinite(value);
}

/**
 * Records for the sessions and hands the variant filter keeps.
 * `filterKey` is ALL_SESSION_GAMES or a Session History label such as
 * "Tournament · Texas Hold'em".
 */
export function profileHistoryStats(
    sessions: HistorySessionSpan[],
    hands: HistoryHandAmount[],
    labels: Record<string, SessionGameLabel | undefined>,
    units: Record<string, HistoryMoneyUnit | undefined>,
    filterKey: string
): HistoryVariantStats {
    const selectedSessions = filterSessionRows(sessions, labels, hasContent(filterKey) ? filterKey : ALL_SESSION_GAMES);
    const selectedHands = filterSessionRows(hands, labels, hasContent(filterKey) ? filterKey : ALL_SESSION_GAMES);

    const wins = selectedHands.filter(hand => finiteNumber(hand.wonAmount) && hand.wonAmount > 0);
    const potUnit = sharedHistoryUnit(
        wins.map(hand => hand.gameId),
        units
    );
    let biggestPotWon: number | undefined;
    if (hasValue(potUnit)) {
        for (const hand of wins) {
            if (!hasValue(biggestPotWon) || hand.wonAmount > biggestPotWon) biggestPotWon = hand.wonAmount;
        }
    }

    const measured = selectedHands.filter(hand => {
        const contributed = hand.contributed;
        return hasValue(contributed) && finiteNumber(contributed) && finiteNumber(hand.wonAmount);
    });
    const profitUnit = sharedHistoryUnit(
        measured.map(hand => hand.gameId),
        units
    );
    let biggestHandProfit: number | undefined;
    if (hasValue(profitUnit)) {
        for (const hand of measured) {
            const contributed = hand.contributed;
            if (!hasValue(contributed) || !finiteNumber(contributed)) continue;
            const profit = hand.wonAmount - contributed;
            if (!Number.isFinite(profit)) continue;
            if (!hasValue(biggestHandProfit) || profit > biggestHandProfit) biggestHandProfit = profit;
        }
    }

    return {
        longestSessionBlocks: longestBlocks(selectedSessions),
        biggestPotWon,
        potUnit: hasValue(biggestPotWon) ? potUnit : undefined,
        biggestHandProfit,
        profitUnit: hasValue(biggestHandProfit) ? profitUnit : undefined
    };
}

/**
 * Micro-USDC the cash-out cell prints. Undefined when the cell is an em dash
 * (the seat is still open). A bust is 0, which the cell prints as 0.00.
 * A recorded cash-out, including a prize, is that amount.
 */
export function settledSessionCashOut(row: { isPrize: boolean; prizeTxHash?: string; cashOut?: number }, isBust: boolean): number | undefined {
    if (row.isPrize && hasContent(row.prizeTxHash)) return hasValue(row.cashOut) ? row.cashOut : undefined;
    if (isBust) return 0;
    return hasValue(row.cashOut) ? row.cashOut : undefined;
}

export interface VariantSessionMoney {
    buyIn: number;
    /** Undefined when the table shows an em dash. 0 is a settled bust. */
    cashOut?: number;
}

export interface VariantMoneyTotals {
    totalBuyIn?: number;
    totalCashOut?: number;
    netProfit?: number;
    /** Open seats left out of the three totals. */
    excludedOpen: number;
}

/**
 * Buy-in, cash-out, and net for the sessions whose cash-out cell is a number.
 * An open seat (no cash-out) is counted in excludedOpen and left out of every
 * total, so an unfinished session does not change the net.
 */
export function variantMoneyTotals(sessions: VariantSessionMoney[]): VariantMoneyTotals {
    let totalBuyIn = 0;
    let totalCashOut = 0;
    let counted = 0;
    let excludedOpen = 0;
    for (const session of sessions) {
        if (!hasValue(session.cashOut) || !Number.isFinite(session.buyIn) || !Number.isFinite(session.cashOut)) {
            if (!hasValue(session.cashOut)) excludedOpen += 1;
            continue;
        }
        totalBuyIn += session.buyIn;
        totalCashOut += session.cashOut;
        counted += 1;
    }
    if (counted === 0) return { excludedOpen };
    return { totalBuyIn, totalCashOut, netProfit: totalCashOut - totalBuyIn, excludedOpen };
}

export interface SettledSessionWindow {
    gameId: string;
    joinBlock: number;
    /** Undefined while the seat is open. 0 is a settled bust. */
    cashOut?: number;
}

/**
 * The hand counts toward this variant's pot and profit when it was dealt in a
 * settled session: the latest join of that table at or before the hand's end
 * block, and that seat has a cash-out (including 0.00). An open seat is left
 * out, the same way the buy-in, cash-out, and net cards skip it.
 *
 * A multi-table tournament row is one table id (`<tournamentId>-t1`) and covers
 * a hand on every `<tournamentId>-t*` table.
 */
export function handBelongsToSettledSession(hand: { gameId: string; blockHeight: number }, sessions: SettledSessionWindow[]): boolean {
    let owner: SettledSessionWindow | undefined;
    for (const session of sessions) {
        if (!sameTournamentSession(session.gameId, hand.gameId) || !isNumber(session.joinBlock) || session.joinBlock > hand.blockHeight) continue;
        if (!hasValue(owner) || session.joinBlock >= owner.joinBlock) owner = session;
    }
    return hasValue(owner) && hasValue(owner.cashOut) && Number.isFinite(owner.cashOut);
}

/** Buy-in and the cash-out the table shows, for one selected set of rows. */
export function variantMoneyFromRows(
    selected: SessionPrizeRow[],
    allRows: SessionPrizeRow[],
    metas: Record<string, GamePrizeMeta | undefined>,
    player: string | undefined
): VariantMoneyTotals {
    return variantMoneyTotals(
        selected.map(row => ({
            buyIn: row.buyIn,
            cashOut: settledSessionCashOut(row, hasContent(player) && hasValue(sessionBustFor(row, allRows, metas[row.gameId], player)))
        }))
    );
}

/** Green, red, or the card's own colour, from the cents the money cards print. */
export function historyNetClass(netMicro: number): string {
    const label = formatMicroUsd(netMicro, true);
    if (!hasContent(label) || label === "0.00" || label === "—") return "";
    if (label.startsWith("-")) return "text-red-400";
    return "text-green-400";
}

/**
 * Days of app state Block52 still has, measured 2026-11-13: earliest retained
 * height 677990 was 2026-10-21, about 23 days behind the chain tip. The default
 * Texas Hodl node keeps roughly 6 days and Session History retries Block52 when
 * a height is pruned, so this is the window a leave block can still be read.
 * Finding the live boundary is a binary search of historical queries, which is
 * too much to do on each profile view.
 */
export const SESSION_CHAIN_STATE_DAYS = 23;

/** One line under the History cards. Older than this, leave block and length stay "—". */
export function sessionStateRetentionNote(days: number = SESSION_CHAIN_STATE_DAYS): string {
    const windowDays = Number.isSafeInteger(days) && days > 0 ? days : SESSION_CHAIN_STATE_DAYS;
    return `Leave block, session length, and hand details are only available for roughly the last ${windowDays} days, since nodes don't keep older chain state. Older rows show —.`;
}

/** Caption under the money cards when open seats were left out. */
export function openSessionTotalsNote(excludedOpen: number): string | undefined {
    if (!Number.isFinite(excludedOpen) || excludedOpen < 1) return undefined;
    if (excludedOpen === 1) return "1 open session isn't in these totals";
    return `${excludedOpen.toLocaleString()} open sessions aren't in these totals`;
}

/** "18.40" for cash, "24,600 chips" for a tournament. An unknown figure is an em dash, never 0. */
export function formatHistoryAmount(amount: number | undefined, unit: HistoryMoneyUnit | undefined, loading: boolean): string {
    if (loading) return "…";
    if (!hasValue(amount) || !hasValue(unit) || !Number.isFinite(amount)) return "—";
    if (unit === "chips") {
        const grouped = Math.abs(amount).toLocaleString();
        return amount < 0 ? `-${grouped} chips` : `${grouped} chips`;
    }
    return formatMicroUsd(amount, true);
}

/** Block count, or an em dash when no closed session was measured. */
export function formatHistoryBlocks(blocks: number | undefined, loading: boolean): string {
    if (loading) return "…";
    if (!hasValue(blocks)) return "—";
    return blocks.toLocaleString();
}
