/**
 * Out-of-the-money Sit & Go and tournament rows on Session History.
 *
 * The chain does not emit a bust event. A finish is `gameState.results[]`
 * (the same list the results modal reads): entries are added as players are
 * eliminated, and place 1 is written only when the tournament is over.
 * `payout` "0" is an unpaid place. `gameState.players[].status` "busted" is
 * the seat after that elimination. `finishing_order` is not a place.
 *
 * The leave block is the `hand_ended` block of the first hand whose public
 * state shows that player in `results` or `busted`. A hand still in progress
 * has no `hand_ended` tx. A failed or pruned read is not a block — a later
 * hand is never reported in its place.
 */
import { isTournamentFormat, PlayerStatus } from "@block52/poker-vm-sdk";
import { hasContent, hasElements, hasValue, isNumber, isRecord, isString } from "./guards";
import { handEndedQuery } from "./handReplay";
import type { SessionPrizeRow } from "./playerPrizeClaims";
import { prizeMicroIsPositive } from "./prizeDisplay";
import { placeOrdinal, type GamePrizeMeta, type GameResultPlace, type GameSeatSnapshot } from "./transactionUtils";

/** Cash-out cell for a confirmed out-of-the-money finish. Amount is always 0. */
export interface SessionBust {
    /** "5th", from results[].place. Absent when the place is not in the record. */
    placeLabel?: string;
}

export interface SessionEliminationLookup {
    gameId: string;
    /** gameState.handNumber. Includes a hand that has not ended yet. */
    handCount: number;
}

/** What one hand probe found. `open` = no hand_ended tx. `unknown` = the read failed. */
export type HandProbe = { status: "open" } | { status: "unknown" } | { status: "ended"; block: number; eliminated: boolean };

export interface EliminationReaders {
    handEnded: (query: string) => Promise<unknown>;
    stateAt: (gameId: string, height: number) => Promise<unknown>;
}

function isOpenSession(row: SessionPrizeRow): boolean {
    return !row.isPrize && !hasValue(row.leaveBlock) && !hasValue(row.cashOut);
}

/** Latest still-open join of this game, or -1. A tied join block keeps the later row. */
function latestOpenIndex(rows: SessionPrizeRow[], gameId: string): number {
    const key = gameId.toLowerCase();
    let best = -1;
    rows.forEach((candidate, index) => {
        if (!isOpenSession(candidate) || candidate.gameId.toLowerCase() !== key) return;
        if (best < 0 || candidate.joinBlock >= rows[best].joinBlock) best = index;
    });
    return best;
}

function resultFor(results: GameResultPlace[] | undefined, player: string): GameResultPlace | undefined {
    if (!hasElements(results) || !hasContent(player)) return undefined;
    const want = player.toLowerCase();
    return results.find(result => result.playerId.toLowerCase() === want);
}

/** A recorded payout of 0. A missing or non-digit payout is not proof they cashed nothing. */
function payoutIsUnpaid(payout: string | undefined): boolean {
    if (!hasContent(payout) || !/^\d+$/.test(payout)) return false;
    return !prizeMicroIsPositive(payout);
}

function tournamentHasWinner(results: GameResultPlace[] | undefined): boolean {
    return hasElements(results) && results.some(result => result.place === 1);
}

/**
 * True when this seat still has chips. An absent players array is treated as
 * still in, so a record that didn't include seats is not called a bust.
 */
function stillSeatedWithChips(players: GameSeatSnapshot[] | undefined, player: string): boolean {
    if (!hasValue(players)) return true;
    const want = player.toLowerCase();
    const seat = players.find(candidate => candidate.address.toLowerCase() === want);
    if (!hasValue(seat)) return false;
    if (seat.status === PlayerStatus.BUSTED) return false;
    if (seat.stack === "0") return false;
    return true;
}

/**
 * 0.00 (and a place, when results name one) for the latest open Sit & Go or
 * tournament join of this game. Undefined keeps the row on "—": cash games,
 * prize rows, a seat still in a running tournament, a paid place waiting on
 * its claim, and a finish whose payout or seat the record doesn't settle.
 */
export function sessionBustFor(
    row: SessionPrizeRow,
    rows: SessionPrizeRow[],
    meta: GamePrizeMeta | undefined,
    player: string
): SessionBust | undefined {
    const index = rows.indexOf(row);
    if (index < 0 || latestOpenIndex(rows, row.gameId) !== index) return undefined;
    if (!hasContent(player) || !hasValue(meta) || !isTournamentFormat(meta.format)) return undefined;
    const own = resultFor(meta.results, player);
    if (hasValue(own)) {
        if (!payoutIsUnpaid(own.payout)) return undefined;
        const ordinal = placeOrdinal(own.place);
        return hasContent(ordinal) ? { placeLabel: ordinal } : {};
    }
    if (!tournamentHasWinner(meta.results) || stillSeatedWithChips(meta.players, player)) return undefined;
    return {};
}

/** Indexer leave block when the session closed; otherwise the elimination block for a bust row. */
export function sessionLeaveBlock(row: SessionPrizeRow, bust: SessionBust | undefined, eliminatedAt: number | null | undefined): number | undefined {
    if (hasValue(row.leaveBlock)) return row.leaveBlock;
    if (!hasValue(bust) || !isNumber(eliminatedAt)) return undefined;
    return eliminatedAt;
}

/** Games on this page whose bust row still needs an elimination block. */
export function eliminationLookupsFor(
    visible: SessionPrizeRow[],
    rows: SessionPrizeRow[],
    metas: Record<string, GamePrizeMeta | undefined>,
    player: string | undefined
): SessionEliminationLookup[] {
    if (!hasContent(player)) return [];
    const lookups: SessionEliminationLookup[] = [];
    const seen = new Set<string>();
    for (const row of visible) {
        const key = row.gameId.toLowerCase();
        if (seen.has(key)) continue;
        const meta = metas[row.gameId];
        if (!hasValue(sessionBustFor(row, rows, meta, player))) continue;
        if (!hasValue(meta) || !isNumber(meta.handNumber) || meta.handNumber < 1) continue;
        seen.add(key);
        lookups.push({ gameId: row.gameId, handCount: meta.handNumber });
    }
    return lookups;
}

function blockHeight(value: unknown): number | undefined {
    if (isNumber(value) && Number.isSafeInteger(value) && value > 0) return value;
    if (!isString(value) || !/^\d+$/.test(value)) return undefined;
    const height = Number(value);
    return Number.isSafeInteger(height) && height > 0 ? height : undefined;
}

function txSucceeded(tx: Record<string, unknown>): boolean {
    if (isNumber(tx.code)) return tx.code === 0;
    return isString(tx.code) && tx.code === "0";
}

function attributeValue(attributes: unknown, key: string): string | undefined {
    if (!Array.isArray(attributes)) return undefined;
    for (const attribute of attributes) {
        if (!isRecord(attribute) || attribute.key !== key || !isString(attribute.value)) continue;
        return attribute.value;
    }
    return undefined;
}

/**
 * Block height of the first successful hand_ended tx in a GetTxsEvent body.
 * Undefined when the hand has no such tx (it has not ended, or the page is empty).
 */
export function handEndedBlock(body: unknown): number | undefined {
    if (!isRecord(body) || !Array.isArray(body.tx_responses)) return undefined;
    for (const tx of body.tx_responses) {
        if (!isRecord(tx) || !txSucceeded(tx)) continue;
        const events = tx.events;
        if (Array.isArray(events)) {
            for (const event of events) {
                if (!isRecord(event) || event.type !== "hand_ended") continue;
                const height = blockHeight(attributeValue(event.attributes, "block_height"));
                if (hasValue(height)) return height;
            }
        }
        const height = blockHeight(tx.height);
        if (hasValue(height)) return height;
    }
    return undefined;
}

function readPublicState(body: unknown): Record<string, unknown> | undefined {
    if (!isRecord(body)) return undefined;
    let parsed: unknown = body.game_state ?? body.gameState;
    if (isString(parsed)) {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            return undefined;
        }
    }
    if (!isRecord(parsed)) return undefined;
    return isRecord(parsed.gameState) ? parsed.gameState : parsed;
}

/**
 * True when this height's public state already lists the player in results or
 * as busted. Null when the body is not a game state. False when it is, and
 * the player is not eliminated in it yet.
 */
export function playerIsEliminated(body: unknown, player: string): boolean | null {
    if (!hasContent(player)) return null;
    const state = readPublicState(body);
    if (!hasValue(state)) return null;
    const want = player.toLowerCase();
    const results = Array.isArray(state.results) ? state.results : undefined;
    if (hasValue(results)) {
        for (const result of results) {
            if (!isRecord(result) || !isString(result.playerId)) continue;
            if (result.playerId.toLowerCase() === want) return true;
        }
    }
    const seats = Array.isArray(state.players) ? state.players : undefined;
    if (!hasValue(seats)) return hasValue(results) ? false : null;
    for (const seat of seats) {
        if (!isRecord(seat) || !isString(seat.address) || seat.address.toLowerCase() !== want) continue;
        return seat.status === PlayerStatus.BUSTED;
    }
    return false;
}

/**
 * Block of the earliest ended hand where `probe` says the player is eliminated.
 * An in-progress hand (no hand_ended) is above that hand, so the search drops
 * below it. Any failed read aborts: a later block is not a stand-in.
 */
export async function eliminationBlockFromHands(handCount: number, probe: (handNumber: number) => Promise<HandProbe>): Promise<number | undefined> {
    if (!Number.isSafeInteger(handCount) || handCount < 1) return undefined;
    const seen = new Map<number, HandProbe>();
    const ask = async (hand: number): Promise<HandProbe> => {
        const cached = seen.get(hand);
        if (hasValue(cached)) return cached;
        const hit = await probe(hand);
        seen.set(hand, hit);
        return hit;
    };
    let lo = 1;
    let hi = handCount;
    let found: number | undefined;
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const hit = await ask(mid);
        if (hit.status === "unknown") return undefined;
        if (hit.status === "open") {
            hi = mid - 1;
            continue;
        }
        if (!hit.eliminated) {
            lo = mid + 1;
            continue;
        }
        found = hit.block;
        hi = mid - 1;
    }
    return found;
}

async function probeHand(gameId: string, hand: number, player: string, readers: EliminationReaders): Promise<HandProbe> {
    let query: string;
    try {
        query = handEndedQuery(gameId, hand);
    } catch (err) {
        console.error("Failed to build hand_ended query:", err);
        return { status: "unknown" };
    }
    try {
        const block = handEndedBlock(await readers.handEnded(query));
        if (!hasValue(block)) return { status: "open" };
        const eliminated = playerIsEliminated(await readers.stateAt(gameId, block), player);
        if (!hasValue(eliminated)) return { status: "unknown" };
        return { status: "ended", block, eliminated };
    } catch (err) {
        console.error(`Failed to read elimination for ${gameId} hand ${hand}:`, err);
        return { status: "unknown" };
    }
}

/** Elimination block for one game, or undefined when the hand history can't show it. */
export async function findEliminationBlock(gameId: string, handCount: number, player: string, readers: EliminationReaders): Promise<number | undefined> {
    return eliminationBlockFromHands(handCount, hand => probeHand(gameId, hand, player, readers));
}
