/**
 * Transaction formatting utilities
 */

import { BettingLimit } from "@block52/poker-vm-sdk";
import { coerceScheduledStartTimeMs } from "./convertUtils";
import { hasContent, hasValue, isBlank, isEmpty, isNumber, isRecord, isString } from "./guards";
import { truncateMiddle } from "./stringUtils";

export interface TransferEvent {
    type?: string;
    attributes?: Array<{ key?: string; value?: string }>;
}

/**
 * Sum all USDC transfer amounts emitted by a transaction.
 *
 * A create-game transaction can emit separate transfer events for the base
 * creation fee and the optional table-name fee. Looking only at the first
 * event under-reports the actual debit.
 */
export function sumUsdcTransferEvents(events: TransferEvent[]): string | undefined {
    let total = 0n;
    let found = false;

    for (const event of events) {
        if (event.type !== "transfer") continue;

        for (const attribute of event.attributes ?? []) {
            if (attribute.key !== "amount" || !attribute.value) continue;

            const match = attribute.value.match(/(\d+)usdc/);
            if (!match) continue;

            total += BigInt(match[1]);
            found = true;
        }
    }

    return found ? total.toString() : undefined;
}

/** The address-bearing fields of the poker and bank messages, by message type. */
export interface TxMessageSigner {
    /** MsgCreateGame, MsgLeaveGame */
    creator?: string;
    /** MsgJoinGame, MsgPerformAction */
    player?: string;
    /** MsgSend */
    from_address?: string;
}

/**
 * The address that signed (and pays for) a message, or undefined when the
 * message type carries none of the known signer fields.
 */
export function getMessageSigner(msg: TxMessageSigner): string | undefined {
    return msg.creator ?? msg.player ?? msg.from_address;
}

/**
 * Net USDC movement of ONE address across a transaction's transfer events.
 *
 * A transaction can move money between many parties (a buy-in is split into
 * fee shares for several recipients), so the tx total says nothing about what
 * a given wallet gained or lost. Summing only the transfers where `address` is
 * the recipient (credit) or the sender (debit) does.
 *
 * @returns the absolute micro-USDC amount and its direction, or undefined when
 *          the address is not party to a USDC transfer or the net is zero
 */
export function netUsdcTransferFor(
    events: TransferEvent[],
    address: string
): { amount: string; direction: "sent" | "received" } | undefined {
    let net = 0n;

    for (const event of events) {
        if (event.type !== "transfer") continue;

        const attributes = event.attributes ?? [];
        const recipient = attributes.find(a => a.key === "recipient")?.value;
        const sender = attributes.find(a => a.key === "sender")?.value;
        const match = attributes.find(a => a.key === "amount")?.value?.match(/^(\d+)usdc$/);
        if (!match) continue;

        const amount = BigInt(match[1]);
        if (recipient === address) net += amount;
        if (sender === address) net -= amount;
    }

    if (net === 0n) return undefined;
    return net > 0n ? { amount: net.toString(), direction: "received" } : { amount: (-net).toString(), direction: "sent" };
}

/**
 * MsgPerformAction amounts are format-dependent: cash uses USDC micro-units,
 * while sit-and-go and tournament games use chips. The transaction payload
 * does not carry the game format, so hiding this ambiguous amount is safer
 * than labelling chips as USDC.
 */
export function getDisplayableActionAmount(messageType: string, amount?: string): string | undefined {
    return messageType === "MsgPerformAction" ? undefined : amount;
}

/**
 * Format a transaction for display purposes
 * Prioritizes action over messageType and cleans up the display text
 *
 * @param action - The poker action (e.g., "call", "raise", "fold")
 * @param messageType - The Cosmos message type (e.g., "MsgPerformAction", "MsgJoinGame")
 * @returns Formatted display label
 */
export function formatTransactionLabel(action?: string, messageType?: string): string {
    // If we have an action, use it directly (already clean)
    if (action) {
        return capitalizeFirst(action);
    }

    // Otherwise, clean up the messageType
    if (messageType) {
        // Remove "Msg" prefix
        let label = messageType.replace(/^Msg/, "");

        // Convert PascalCase to spaced words (e.g., "PerformAction" -> "Perform Action")
        label = label.replace(/([a-z])([A-Z])/g, "$1 $2");

        return label;
    }

    return "Transaction";
}

/**
 * Extract the Cosmos message type from a transaction's hex-encoded bytes.
 *
 * Cosmos SDK transactions embed each message's protobuf type URL as a plain
 * ASCII string (e.g. "/pokerchain.poker.v1.MsgCreateGame"), length-prefixed
 * inside the tx bytes. Rather than maintaining a hardcoded lookup of every
 * message type (which drifts every time the chain adds a new `Msg*`), we decode
 * the type URL directly out of the hex and derive a human-readable label from
 * it. Any newly added message type is therefore labelled automatically.
 *
 * @param hexTx - lowercase hex string of the raw transaction bytes
 * @returns a display label (e.g. "Create Game"), or null if no type URL found
 */
export function extractMessageTypeFromHex(hexTx: string): string | null {
    if (!hexTx) return null;

    // A type URL starts with "/" (0x2f) and is a run of printable URL-safe
    // characters: letters, digits, ".", "_" and further "/" separators.
    // Decode the hex to ASCII first, then match the URL pattern on the text.
    const ascii = hexToAscii(hexTx);
    const match = ascii.match(/\/[A-Za-z0-9._]+\.(Msg[A-Za-z0-9]+)/);
    if (!match) return null;

    // match[1] is the bare message name (e.g. "MsgCreateGame").
    const messageName = match[1];

    // A few message types have curated labels that differ from the plain
    // derived form; everything else auto-derives via formatTransactionLabel
    // (strip "Msg", space-case) so new message types need no maintenance here.
    if (messageName in MESSAGE_TYPE_LABEL_OVERRIDES) {
        return MESSAGE_TYPE_LABEL_OVERRIDES[messageName];
    }

    return formatTransactionLabel(undefined, messageName);
}

/**
 * Curated display labels for message types whose derived name isn't the
 * friendliest. Keyed by bare message name (e.g. "MsgSend"). Only add an entry
 * when the auto-derived label ("Send", "Withdraw Delegator Reward", ...) is
 * genuinely worse — do NOT mirror the whole message set here.
 */
const MESSAGE_TYPE_LABEL_OVERRIDES: { [messageName: string]: string } = {
    MsgSend: "Bank Send (Transfer)",
    MsgWithdrawDelegatorReward: "Withdraw Rewards"
};

/**
 * Decode a hex string to ASCII, keeping only printable characters.
 * Non-printable bytes become spaces so they act as delimiters between the
 * printable runs (such as embedded type URLs) we care about.
 */
function hexToAscii(hex: string): string {
    const bytes = hex.match(/.{1,2}/g);
    if (!bytes) return "";

    let out = "";
    for (const byte of bytes) {
        const code = parseInt(byte, 16);
        out += code >= 0x20 && code <= 0x7e ? String.fromCharCode(code) : " ";
    }
    return out;
}

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirst(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Format transfer direction indicator
 *
 * @param direction - "sent" or "received"
 * @returns "+" for received, "-" for sent, empty string if no direction
 */
export function formatTransferDirection(direction?: "sent" | "received"): string {
    if (direction === "received") return "+";
    if (direction === "sent") return "-";
    return "";
}

/**
 * Get CSS class for transfer direction color
 *
 * @param direction - "sent" or "received"
 * @returns Tailwind CSS class for text color
 */
export function getTransferDirectionClass(direction?: "sent" | "received"): string {
    if (direction === "received") return "text-green-400";
    if (direction === "sent") return "text-orange-400";
    return "";
}

/**
 * Format a shortened hash for display
 *
 * @param hash - Full transaction or game hash
 * @param startChars - Number of characters to show at start (default 8)
 * @param endChars - Number of characters to show at end (default 8)
 * @returns Formatted hash like "abc12345...xyz78901"
 */
export function formatShortHash(hash: string, startChars = 8, endChars = 8): string {
    if (!hash) return "";
    if (hash.length <= startChars + endChars + 3) return hash;
    return truncateMiddle(hash, startChars, endChars);
}

/**
 * Format a game ID for display (shorter format)
 *
 * @param gameId - Full game ID
 * @returns Shortened game ID like "abc123..."
 */
export function formatGameId(gameId?: string): string {
    if (!gameId) return "";
    if (gameId.length <= 9) return gameId;
    return `${gameId.slice(0, 6)}...`;
}

/** Game formats as the chain names them (GameFormat in the SDK). */
export type ChainGameFormat = "cash" | "sit-and-go" | "tournament";

const PLACE_ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

/** 1 → "1st", 2 → "2nd", …; falls back to "Nth" past 10th. */
export function placeOrdinal(place: number): string {
    if (!Number.isFinite(place) || place < 1) return "";
    return PLACE_ORDINALS[place - 1] ?? `${place}th`;
}

/**
 * Attributes of a chain `sng_prize_claimed` event for `player` (case-insensitive),
 * or undefined when this tx did not settle that player's prize.
 *
 * Claim winnings broadcasts the same MsgLeaveGame as a cash leave (see
 * claimWinnings.ts); the event is what distinguishes a prize payout.
 */
export function findSngPrizeClaimed(events: TransferEvent[] | undefined, player: string): { amount?: string; gameId?: string; player?: string } | undefined {
    if (!events || !player) return undefined;
    const want = player.toLowerCase();
    for (const event of events) {
        if (event.type !== "sng_prize_claimed") continue;
        const fields = Object.fromEntries((event.attributes ?? []).filter(a => a.key).map(a => [a.key!, a.value ?? ""]));
        if ((fields.player || "").toLowerCase() !== want) continue;
        return { amount: fields.amount || undefined, gameId: fields.game_id || undefined, player: fields.player };
    }
    return undefined;
}

/**
 * Place (1-based) of `player` in a MsgLeaveGame finishing_order, or undefined
 * when the order is missing/empty or the player is not listed.
 *
 * WARNING: Do not use this alone for prize-claim labels. Early ITM claims pass a
 * place-sorted list of *busted* players only (finishingOrderFromState), so a 3rd
 * place finisher sits at index 0 and would be misread as a win. Prefer
 * placeFromGameResults / placeFromPrizePayouts via resolvePrizePlace.
 */
export function placeFromFinishingOrder(finishingOrder: string[] | undefined, player: string): number | undefined {
    if (!hasValue(finishingOrder) || isEmpty(finishingOrder) || !player) return undefined;
    const want = player.toLowerCase();
    const index = finishingOrder.findIndex(addr => (addr || "").toLowerCase() === want);
    return index >= 0 ? index + 1 : undefined;
}

/** One entry of gameState.results from a /game/{id} response. */
export interface GameResultPlace {
    place: number;
    playerId: string;
    payout?: string;
}

/** One seat from gameState.players, only the fields a session row needs. */
export interface GameSeatSnapshot {
    address: string;
    /** Chain player status, e.g. "busted" or "active". Absent when the seat omitted it. */
    status?: string;
    /** Chip or micro-USDC stack, as the chain sent it. Absent when it was not a digit string. */
    stack?: string;
}

/** One entry of gameState.payouts (prize schedule by place). */
export interface GamePayoutPlace {
    place: number;
    amount: string;
}

/** True finishing place from gameState.results[].place (not finishing_order index). */
export function placeFromGameResults(results: GameResultPlace[] | undefined, player: string): number | undefined {
    if (!hasValue(results) || isEmpty(results) || !player) return undefined;
    const want = player.toLowerCase();
    const hit = results.find(r => (r.playerId || "").toLowerCase() === want);
    if (!hit || !Number.isFinite(hit.place) || hit.place < 1) return undefined;
    return hit.place;
}

/** Infer place by matching claimed micro-USDC amount to gameState.payouts. */
export function placeFromPrizePayouts(prizeAmount: string | undefined, payouts: GamePayoutPlace[] | undefined): number | undefined {
    if (!prizeAmount || !/^\d+$/.test(prizeAmount) || !hasValue(payouts) || isEmpty(payouts)) return undefined;
    const hits = payouts.filter(p => p.amount === prizeAmount && Number.isFinite(p.place) && p.place >= 1);
    if (hits.length !== 1) return undefined;
    return hits[0].place;
}

/** Prefer results, then payout amount. Never finishing_order index (early ITM is incomplete). */
export function resolvePrizePlace(args: {
    player: string;
    results?: GameResultPlace[];
    payouts?: GamePayoutPlace[];
    prizeAmount?: string;
}): number | undefined {
    return placeFromGameResults(args.results, args.player) ?? placeFromPrizePayouts(args.prizeAmount, args.payouts);
}

/**
 * Parsed fields from a /block52/pokerchain/poker/v1/game/{id} response.
 * Variant and stakes ride along with the prize fields: one cached getGame
 * serves both the explorer's place labels and the profile session table.
 */
export interface GamePrizeMeta {
    format?: ChainGameFormat;
    results?: GameResultPlace[];
    payouts?: GamePayoutPlace[];
    /** Chain variant string, e.g. "texas-holdem". Absent when the game record has none. */
    variant?: string;
    /** "no-limit" | "pot-limit" | "fixed-limit". Absent on legacy tables and when unrecognized. */
    bettingLimit?: string;
    smallBlind?: string;
    bigBlind?: string;
    minBuyIn?: string;
    maxBuyIn?: string;
    /** Epoch ms. Absent when the table has no scheduled start. */
    scheduledStartTime?: number;
    /**
     * Hands dealt so far, including a hand still in progress. 0 before the first
     * hand. Absent when the record has no handNumber.
     */
    handNumber?: number;
    /**
     * Seats as the chain last stored them. Absent when the record has no players
     * array — an empty array means the table sent one and nobody is seated.
     */
    players?: GameSeatSnapshot[];
}

function parseGameObject(response: unknown): Record<string, unknown> | undefined {
    try {
        const raw = (response as { game?: unknown })?.game;
        const game = isString(raw) ? JSON.parse(raw) : raw;
        return isRecord(game) ? game : undefined;
    } catch {
        return undefined;
    }
}

/** The format from a /block52/pokerchain/poker/v1/game/{id} response, or undefined. */
export function parseGameFormat(response: unknown): ChainGameFormat | undefined {
    const format = parseGameObject(response)?.format;
    return format === "cash" || format === "sit-and-go" || format === "tournament" ? format : undefined;
}

/** Results + payout schedule + format from a /game/{id} response. */
export function parseGamePrizeMeta(response: unknown): GamePrizeMeta {
    const game = parseGameObject(response);
    if (!game) return {};
    const format = game.format;
    const gs = (isRecord(game.gameState) ? game.gameState : undefined) as { results?: unknown; payouts?: unknown } | undefined;
    const resultsRaw = Array.isArray(gs?.results) ? gs!.results : undefined;
    const payoutsRaw = Array.isArray(gs?.payouts) ? gs!.payouts : undefined;
    const results = resultsRaw
        ?.map((r): GameResultPlace | undefined => {
            if (!isRecord(r)) return undefined;
            const place = Number((r as { place?: unknown }).place);
            const playerId = String((r as { playerId?: unknown }).playerId ?? "");
            const payout = (r as { payout?: unknown }).payout;
            if (!playerId || !Number.isFinite(place) || place < 1) return undefined;
            return { place, playerId, payout: isString(payout) ? payout : undefined };
        })
        .filter((r): r is GameResultPlace => !!r);
    const payouts = payoutsRaw
        ?.map((p): GamePayoutPlace | undefined => {
            if (!isRecord(p)) return undefined;
            const place = Number((p as { place?: unknown }).place);
            const amount = String((p as { amount?: unknown }).amount ?? "");
            if (!amount || !Number.isFinite(place) || place < 1) return undefined;
            return { place, amount };
        })
        .filter((p): p is GamePayoutPlace => !!p);
    return {
        format: format === "cash" || format === "sit-and-go" || format === "tournament" ? format : undefined,
        results,
        payouts,
        ...readSessionTableFields(game),
        ...readTournamentSeats(isRecord(game.gameState) ? game.gameState : undefined)
    };
}

/** Hand count and seats from the same game record. Only values the chain sent. */
function readTournamentSeats(state: Record<string, unknown> | undefined): Pick<GamePrizeMeta, "handNumber" | "players"> {
    if (!hasValue(state)) return {};
    const fields: Pick<GamePrizeMeta, "handNumber" | "players"> = {};
    if (isNumber(state.handNumber) && Number.isSafeInteger(state.handNumber) && state.handNumber >= 0) {
        fields.handNumber = state.handNumber;
    }
    if (!Array.isArray(state.players)) return fields;
    const players: GameSeatSnapshot[] = [];
    for (const player of state.players) {
        if (!isRecord(player) || !isString(player.address) || isBlank(player.address)) continue;
        const seat: GameSeatSnapshot = { address: player.address };
        if (isString(player.status) && hasContent(player.status)) seat.status = player.status;
        if (isString(player.stack) && /^\d+$/.test(player.stack)) seat.stack = player.stack;
        players.push(seat);
    }
    fields.players = players;
    return fields;
}

/** Variant, limit and stake fields from the same game record. Only values the chain sent. */
function readSessionTableFields(game: Record<string, unknown>): Partial<GamePrizeMeta> {
    const fields: Partial<GamePrizeMeta> = {};
    if (isString(game.variant) && hasContent(game.variant)) fields.variant = game.variant;
    const options = readGameOptions(game);
    if (!hasValue(options)) return fields;
    const bettingLimit = readBettingLimit(options.bettingLimit);
    if (hasValue(bettingLimit)) fields.bettingLimit = bettingLimit;
    const smallBlind = digitString(options.smallBlind);
    if (hasValue(smallBlind)) fields.smallBlind = smallBlind;
    const bigBlind = digitString(options.bigBlind);
    if (hasValue(bigBlind)) fields.bigBlind = bigBlind;
    const minBuyIn = digitString(options.minBuyIn);
    if (hasValue(minBuyIn)) fields.minBuyIn = minBuyIn;
    const maxBuyIn = digitString(options.maxBuyIn);
    if (hasValue(maxBuyIn)) fields.maxBuyIn = maxBuyIn;
    const scheduledStartTime = coerceScheduledStartTimeMs(options.scheduledStartTime);
    if (hasValue(scheduledStartTime)) fields.scheduledStartTime = scheduledStartTime;
    return fields;
}

/** gameState.gameOptions on the single-game endpoint; some records keep options at the root. */
function readGameOptions(game: Record<string, unknown>): Record<string, unknown> | undefined {
    const state = game.gameState;
    if (isRecord(state) && isRecord(state.gameOptions)) return state.gameOptions;
    return isRecord(game.gameOptions) ? game.gameOptions : undefined;
}

function readBettingLimit(value: unknown): string | undefined {
    if (value === BettingLimit.NO_LIMIT || value === BettingLimit.POT_LIMIT || value === BettingLimit.FIXED_LIMIT) return value;
    return undefined;
}

function digitString(value: unknown): string | undefined {
    if (!isString(value) || !/^\d+$/.test(value)) return undefined;
    return value;
}

const gamePrizeMetaCache = new Map<string, Promise<GamePrizeMeta>>();

/**
 * Look up each game's prize meta once (cached for the session). Failed lookups
 * resolve empty and are retried later. Format never changes; results may grow
 * as more players bust, so callers that need a place should re-fetch after a miss.
 */
export async function fetchGamePrizeMeta(
    getGame: (gameId: string) => Promise<unknown>,
    gameIds: Iterable<string | undefined>
): Promise<Record<string, GamePrizeMeta>> {
    const ids = [...new Set([...gameIds].filter((id): id is string => !!id))];
    const entries = await Promise.all(
        ids.map(async id => {
            let pending = gamePrizeMetaCache.get(id);
            if (!pending) {
                pending = getGame(id).then(parseGamePrizeMeta, () => ({}));
                gamePrizeMetaCache.set(id, pending);
            }
            const meta = await pending;
            if (!meta.format && isEmpty(meta.results) && isEmpty(meta.payouts)) gamePrizeMetaCache.delete(id);
            return [id, meta] as const;
        })
    );
    return Object.fromEntries(entries);
}

/**
 * Look up each game's format once (cached for the session; a game's format
 * never changes). Failed lookups resolve to undefined and are retried later.
 */
export async function fetchGameFormats(
    getGame: (gameId: string) => Promise<unknown>,
    gameIds: Iterable<string | undefined>
): Promise<Record<string, ChainGameFormat | undefined>> {
    const meta = await fetchGamePrizeMeta(getGame, gameIds);
    return Object.fromEntries(Object.entries(meta).map(([id, m]) => [id, m.format]));
}

/** Test hook: forget cached game formats / prize meta. */
export function clearGameFormatCache(): void {
    gamePrizeMetaCache.clear();
}
