/**
 * Multi-table tournament lobby (ui#980 slices 2-3, poker-vm#2613).
 *
 * Pure, unit-tested logic behind the /tournaments page: reading the chain's
 * tournament state, finding which tournaments exist, and turning one into the
 * numbers and flags a lobby card shows.
 *
 * SDK GAP (block52/poker-vm sdk 1.24.0): the SDK has the TournamentStatus and
 * TournamentEntrantStatus types but not the engine's TournamentStateDTO, a
 * `getTournament` query, or a list query. {@link TournamentStateDTO} below is
 * therefore the narrowest read of `GET /block52/pokerchain/poker/v1/tournament/{id}`
 * the lobby needs, and {@link tournamentIdsFromTxSearch} finds tournaments through
 * the `tournament_created` event until the chain has a list query. Replace both
 * with the SDK's when it ships them.
 */
import {
    TOURNAMENT_ENTRANT_STATUSES,
    TOURNAMENT_STATUSES,
    expandBlindLevel,
    resolveBlindPreset,
    type BlindStructureDTO,
    type TournamentEntrantStatus,
    type TournamentStatus
} from "@block52/poker-vm-sdk";
import { isNullish, isNumber, isRecord, isString } from "./guards";
import { gameIdFromTableId } from "./tournamentFollow";

export interface TournamentEntrantView {
    address: string;
    status: TournamentEntrantStatus;
    tableId?: string;
}

export interface TournamentOptionsView {
    /** Gross buy-in per entrant, micro-USDC string. */
    buyIn: string;
    /** Flat entry fee inside the buy-in, paid to the creator, micro-USDC string (absent = none). */
    entryFee?: string;
    /** Protocol cut in basis points, set by the chain at creation. */
    protocolFeeBps?: number;
    startingStack: string;
    seatsPerTable: number;
    minEntrants: number;
    maxEntrants: number;
    /** Scheduled start, unix MILLISECONDS (the create message carries seconds). */
    startTime: number;
    blindStructure: BlindStructureDTO;
    actionTimeoutSeconds: number;
}

/** What the lobby reads of the engine's TournamentStateDTO. */
export interface TournamentStateDTO {
    tournamentId: string;
    status: TournamentStatus;
    options: TournamentOptionsView;
    entrants: TournamentEntrantView[];
    /** Micro-USDC string. "0" until the tournament starts; the lobby projects it while registering. */
    prizePool: string;
}

export interface TournamentRecord {
    state: TournamentStateDTO;
    /** The creator's address (the chain stores it beside the state). */
    creator: string;
}

const MICRO = /^[0-9]+$/;

function requireString(value: unknown, name: string): string {
    if (!isString(value)) throw new Error(`tournament ${name} must be a string`);
    return value;
}

function requireMicro(value: unknown, name: string): string {
    const s = requireString(value, name);
    if (!MICRO.test(s)) throw new Error(`tournament ${name} must be a non-negative integer string, got "${s}"`);
    return s;
}

function requireInt(value: unknown, name: string): number {
    if (!isNumber(value) || !Number.isInteger(value)) throw new Error(`tournament ${name} must be an integer`);
    return value;
}

function isTournamentStatus(value: string): value is TournamentStatus {
    return TOURNAMENT_STATUSES.some(s => s === value);
}

function isEntrantStatus(value: string): value is TournamentEntrantStatus {
    return TOURNAMENT_ENTRANT_STATUSES.some(s => s === value);
}

function parseEntrant(raw: unknown): TournamentEntrantView {
    if (!isRecord(raw)) throw new Error("tournament entrant must be an object");
    const status = requireString(raw.status, "entrant status");
    if (!isEntrantStatus(status)) throw new Error(`unknown tournament entrant status "${status}"`);
    return {
        address: requireString(raw.address, "entrant address"),
        status,
        ...(isString(raw.tableId) && raw.tableId !== "" ? { tableId: raw.tableId } : {})
    };
}

function parseBlindStructure(raw: unknown): BlindStructureDTO {
    if (!isRecord(raw)) throw new Error("tournament options.blindStructure must be an object");
    // The structure is the SDK's own BlindStructureDTO, written by the engine; the lobby only displays it.
    return raw as unknown as BlindStructureDTO;
}

/** Validates the engine's TournamentStateDTO JSON. Throws on a malformed state; the chain must provide every field (no defaults). */
export function parseTournamentState(raw: unknown): TournamentStateDTO {
    if (!isRecord(raw)) throw new Error("tournament state must be an object");
    const status = requireString(raw.status, "status");
    if (!isTournamentStatus(status)) throw new Error(`unknown tournament status "${status}"`);
    const o = raw.options;
    if (!isRecord(o)) throw new Error("tournament options must be an object");
    if (!Array.isArray(raw.entrants)) throw new Error("tournament entrants must be an array");
    const options: TournamentOptionsView = {
        buyIn: requireMicro(o.buyIn, "options.buyIn"),
        ...(isNullish(o.entryFee) ? {} : { entryFee: requireMicro(o.entryFee, "options.entryFee") }),
        ...(isNullish(o.protocolFeeBps) ? {} : { protocolFeeBps: requireInt(o.protocolFeeBps, "options.protocolFeeBps") }),
        startingStack: requireMicro(o.startingStack, "options.startingStack"),
        seatsPerTable: requireInt(o.seatsPerTable, "options.seatsPerTable"),
        minEntrants: requireInt(o.minEntrants, "options.minEntrants"),
        maxEntrants: requireInt(o.maxEntrants, "options.maxEntrants"),
        startTime: requireInt(o.startTime, "options.startTime"),
        blindStructure: parseBlindStructure(o.blindStructure),
        actionTimeoutSeconds: requireInt(o.actionTimeoutSeconds, "options.actionTimeoutSeconds")
    };
    return {
        tournamentId: requireString(raw.tournamentId, "tournamentId"),
        status,
        options,
        entrants: raw.entrants.map(parseEntrant),
        prizePool: requireMicro(raw.prizePool, "prizePool")
    };
}

/** Parses the Tournament query response: `{ tournament: "<TournamentStateDTO JSON>", creator }`. */
export function parseTournamentResponse(raw: unknown): TournamentRecord {
    if (!isRecord(raw)) throw new Error("tournament response must be an object");
    const json = requireString(raw.tournament, "response.tournament");
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error("tournament response.tournament is not valid JSON");
    }
    return { state: parseTournamentState(parsed), creator: requireString(raw.creator, "response.creator") };
}

/**
 * The tournament ids in a CometBFT `tx_search` result for
 * `tournament_created.tournament_id EXISTS`, in the order the search returned
 * them (ask for descending, newest first), without duplicates. Interim discovery
 * until the chain has a list query (SDK gap, see the file header).
 */
export function tournamentIdsFromTxSearch(raw: unknown): string[] {
    if (!isRecord(raw) || !isRecord(raw.result) || !Array.isArray(raw.result.txs)) {
        throw new Error("tx_search response has no result.txs");
    }
    const ids: string[] = [];
    for (const tx of raw.result.txs) {
        if (!isRecord(tx) || !isRecord(tx.tx_result) || !Array.isArray(tx.tx_result.events)) continue;
        for (const event of tx.tx_result.events) {
            if (!isRecord(event) || event.type !== "tournament_created" || !Array.isArray(event.attributes)) continue;
            for (const attr of event.attributes) {
                if (isRecord(attr) && attr.key === "tournament_id" && isString(attr.value) && !ids.includes(attr.value)) ids.push(attr.value);
            }
        }
    }
    return ids;
}

/** The event query that finds every tournament the chain has created. */
export const TOURNAMENT_CREATED_QUERY = "tournament_created.tournament_id EXISTS";

/** What one entrant pays and what part of it reaches the prize pool. All micro-USDC bigint. */
export interface TournamentEntryCost {
    /** What the player pays to register (the buy-in). */
    gross: bigint;
    /** Inside the buy-in, to the creator. Never refunded. */
    entryFee: bigint;
    /** Inside the buy-in, to validators. Never refunded. */
    protocolCut: bigint;
    /** Gross minus entry fee and protocol cut: escrowed, the prize-pool share, and all that unregistering refunds. */
    net: bigint;
}

/**
 * Mirrors pokerchain `feesFor`: the entry fee and the protocol cut both come OUT
 * of the buy-in (unlike a sit-and-go's owner fee), so the player pays exactly the
 * buy-in and the escrow is what is left.
 */
export function tournamentEntryCost(options: Pick<TournamentOptionsView, "buyIn" | "entryFee" | "protocolFeeBps">): TournamentEntryCost {
    const gross = BigInt(options.buyIn);
    const entryFee = isNullish(options.entryFee) ? 0n : BigInt(options.entryFee);
    const bps = isNullish(options.protocolFeeBps) || options.protocolFeeBps <= 0 ? 0n : BigInt(options.protocolFeeBps);
    const protocolCut = (gross * bps) / 10000n;
    return { gross, entryFee, protocolCut, net: gross - entryFee - protocolCut };
}

export type TournamentLobbyPhase =
    /** Registration is open and the start time has not passed. */
    | "open"
    /** Registration is open and full. */
    | "full"
    /** Start time reached but the chain has not run the start yet (it starts at the next block). */
    | "starting"
    | "running"
    | "finished"
    | "cancelled";

export interface TournamentLobbyCard {
    tournamentId: string;
    creator: string;
    phase: TournamentLobbyPhase;
    status: TournamentStatus;
    registered: number;
    minEntrants: number;
    maxEntrants: number;
    startsAtMs: number;
    /** ms until the start; 0 once passed. */
    msUntilStart: number;
    /** Gross buy-in and the escrowed share, micro-USDC. */
    cost: TournamentEntryCost;
    /** The fixed prize pool once started; the projected pool (registered x net) while registering. */
    prizePoolMicro: bigint;
    prizePoolIsProjected: boolean;
    startingStack: string;
    seatsPerTable: number;
    /** The opening level, e.g. "25/50 blinds, 5 min levels". */
    blindLabel: string;
    /** Registering and under the minimum: the tournament cancels at the start time unless more register. */
    atRiskOfCancelling: boolean;
    /** The viewer is registered (status "registered" or already "playing"). */
    isRegistered: boolean;
    /** The viewer is playing right now: the game id of their table and its number (`<id>-t<n>`). */
    myTable?: { gameId: string; number: number };
    canRegister: boolean;
    canUnregister: boolean;
    /** Why the viewer cannot register, for the disabled button; undefined when they can. */
    registerBlockedReason?: string;
}

/** Entrants that count toward the field: registered, or already playing/busted after the start. */
function countedEntrants(entrants: TournamentEntrantView[]): TournamentEntrantView[] {
    return entrants.filter(e => e.status !== "unregistered");
}

export function tournamentPhase(state: TournamentStateDTO, nowMs: number): TournamentLobbyPhase {
    switch (state.status) {
        case "running":
            return "running";
        case "finished":
            return "finished";
        case "cancelled":
            return "cancelled";
        case "registering":
            if (nowMs >= state.options.startTime) return "starting";
            return countedEntrants(state.entrants).length >= state.options.maxEntrants ? "full" : "open";
    }
}

/** The table an entrant is playing at: its game id and number (the `n` of `<tournamentId>/t<n>`), or undefined when they are not seated. */
function tablePlayedBy(entrant: TournamentEntrantView | undefined): { gameId: string; number: number } | undefined {
    if (isNullish(entrant) || entrant.status !== "playing" || isNullish(entrant.tableId)) return undefined;
    return { gameId: gameIdFromTableId(entrant.tableId), number: Number(entrant.tableId.slice(entrant.tableId.lastIndexOf("/") + 2)) };
}

/**
 * The lobby card for a tournament as seen by `viewer` (undefined = no wallet).
 * Registration closes at the start time, so the buttons follow the clock rather
 * than waiting for the chain to flip the status.
 */
export function buildTournamentCard(record: TournamentRecord, viewer: string | undefined, nowMs: number): TournamentLobbyCard {
    const { state, creator } = record;
    const phase = tournamentPhase(state, nowMs);
    const cost = tournamentEntryCost(state.options);
    const registered = countedEntrants(state.entrants).length;
    const mine = isNullish(viewer) ? undefined : state.entrants.find(e => e.address === viewer);
    const isRegistered = !isNullish(mine) && mine.status !== "unregistered";
    const registering = phase === "open" || phase === "full";
    const isProjected = state.status === "registering";

    let registerBlockedReason: string | undefined;
    if (isNullish(viewer)) registerBlockedReason = "Connect a wallet to register";
    else if (isRegistered) registerBlockedReason = "You are registered";
    else if (phase === "full") registerBlockedReason = "The tournament is full";
    else if (!registering) registerBlockedReason = "Registration is closed";

    const myTable = tablePlayedBy(mine);

    return {
        tournamentId: state.tournamentId,
        creator,
        phase,
        status: state.status,
        registered,
        minEntrants: state.options.minEntrants,
        maxEntrants: state.options.maxEntrants,
        startsAtMs: state.options.startTime,
        msUntilStart: Math.max(0, state.options.startTime - nowMs),
        cost,
        prizePoolMicro: isProjected ? cost.net * BigInt(registered) : BigInt(state.prizePool),
        prizePoolIsProjected: isProjected,
        startingStack: state.options.startingStack,
        seatsPerTable: state.options.seatsPerTable,
        blindLabel: openingLevelLabel(state.options.blindStructure),
        atRiskOfCancelling: registering && registered < state.options.minEntrants,
        isRegistered,
        ...(isNullish(myTable) ? {} : { myTable }),
        canRegister: isNullish(registerBlockedReason),
        canUnregister: registering && !isNullish(mine) && mine.status === "registered",
        ...(isNullish(registerBlockedReason) ? {} : { registerBlockedReason })
    };
}

/** Cards ordered for the lobby: open registration first (soonest start), then running, then finished/cancelled (in the order given, newest first). */
export function sortTournamentCards(cards: TournamentLobbyCard[]): TournamentLobbyCard[] {
    const rank = (c: TournamentLobbyCard): number => {
        // A tournament the viewer is playing in comes first.
        if (!isNullish(c.myTable)) return -1;
        switch (c.phase) {
            case "open":
            case "full":
            case "starting":
                return 0;
            case "running":
                return 1;
            default:
                return 2;
        }
    };
    return cards
        .map((card, index) => ({ card, index }))
        .sort((a, b) => {
            const r = rank(a.card) - rank(b.card);
            if (r !== 0) return r;
            if (rank(a.card) === 0) return a.card.startsAtMs - b.card.startsAtMs;
            return a.index - b.index;
        })
        .map(x => x.card);
}

/** The label on a card's status chip. */
export function phaseLabel(phase: TournamentLobbyPhase): string {
    switch (phase) {
        case "open":
            return "Registering";
        case "full":
            return "Full";
        case "starting":
            return "Starting";
        case "running":
            return "In play";
        case "finished":
            return "Finished";
        case "cancelled":
            return "Cancelled";
    }
}

/** "25/50 blinds, 5 min levels": the structure's opening level, as the engine will play it. Empty when the structure cannot be expanded. */
export function openingLevelLabel(structure: BlindStructureDTO): string {
    try {
        const level = expandBlindLevel(resolveBlindPreset(structure), 0);
        return `${Number(level.smallBlind).toLocaleString("en-US")}/${Number(level.bigBlind).toLocaleString("en-US")} blinds, ${level.durationMinutes} min levels`;
    } catch {
        return "";
    }
}

/** micro-USDC to "$1.25" (digits past cents are kept only when non-zero: $0.333333 stays exact). */
export function formatUsdc(micro: bigint): string {
    const whole = micro / 1_000_000n;
    const frac = (micro % 1_000_000n).toString().padStart(6, "0");
    const cents = frac.slice(0, 2);
    const rest = frac.slice(2).replace(/0+$/, "");
    return `$${whole.toLocaleString("en-US")}.${cents}${rest}`;
}

/**
 * The honest escrow wording for the register and unregister dialogs. Nothing here
 * promises a full refund: block52/pokerchain#470 is an open decision, and today
 * unregistering or a cancelled tournament refunds only the escrowed net buy-in.
 */
export function escrowStatement(cost: TournamentEntryCost): { register: string; unregister: string } {
    const fees = cost.entryFee + cost.protocolCut;
    const feeNote = fees > 0n ? ` The ${formatUsdc(fees)} of fees inside the buy-in (entry fee and protocol fee) is taken at registration and is not refunded.` : "";
    return {
        register: `You pay ${formatUsdc(cost.gross)} now. ${formatUsdc(cost.net)} of it is held in escrow for the prize pool.${feeNote}`,
        unregister: `Unregistering returns the ${formatUsdc(cost.net)} held in escrow, not the full ${formatUsdc(cost.gross)} buy-in.${feeNote} If the tournament is cancelled for too few entrants, the refund is currently the same escrowed amount.`
    };
}
