/**
 * Provably fair hand verification (ui#972).
 *
 * How Block52 deals today: the transaction that starts a hand (MsgPerformAction
 * "new-hand") carries `seed=<64 hex>`. Every validator shuffles a standard
 * 52-card deck from it — an HKDF-SHA256 byte stream (no salt, info
 * "poker/deck/v1") feeding a Fisher–Yates shuffle with rejection sampling
 * (pokerchain `x/poker/types/deck.go` ShuffleFromVRF; the SDK's
 * `Deck.shuffleFromSeed` is its byte-for-byte port) — and the engine deals from
 * the top of that deck:
 *
 *   1. hole cards one at a time to the dealt-in seats in ascending seat order,
 *      round after round (2 each in Hold'em, 4 in Omaha);
 *   2. five cards set aside — the engine draws them at the deal and never
 *      shows them;
 *   3. the board, street by street, from the cards after those.
 *
 * So once a hand is over, anyone can recompute its deck from the seed and check
 * every card the table showed. Everything here is pure; the chain data comes
 * from `useHandVerification`.
 */
import { Deck, TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { hasContent, hasElements, hasValue, isEmpty, isNullish, isRecord, isString } from "./guards";

/** Cards the engine draws at the deal and sets aside before the board. */
export const SET_ASIDE_CARDS = 5;

/** The most players a table can deal to (inference searches 2..this). */
export const MAX_DEALT_PLAYERS = 10;

/** Names the derivation in a downloaded record, so a later scheme can be told apart. */
export const DEAL_PROTOCOL = "block52/deal/seed-v1";

export const DERIVATION_DESCRIPTION = 'HKDF-SHA256 over the seed (no salt, info "poker/deck/v1"), then a Fisher–Yates shuffle of a standard deck';
export const DEAL_ORDER_DESCRIPTION = "Hole cards one at a time to the dealt-in seats in ascending order, then 5 cards set aside, then the board street by street";

const SEED_PARAM = /(?:^|&)seed=([0-9a-fA-F]{64})(?:&|$)/;

/** The 32-byte seed in a new-hand's data (`seed=<64 hex>`), lower-cased; null when there is none. */
export function parseDealSeed(data: string | null | undefined): string | null {
    if (!isString(data)) return null;
    const match = SEED_PARAM.exec(data);
    return match ? match[1].toLowerCase() : null;
}

/** The deck the chain shuffles from `seedHex`, top card first (e.g. ["8H", "3S", …]). */
export function deckFromSeed(seedHex: string): string[] {
    const deck = new Deck();
    deck.shuffleFromSeed(seedHex);
    // toString() brackets the top card; the order is what matters here.
    return deck.toString().replace(/[[\]]/g, "").split("-");
}

/** SHA-256 of the seed bytes, hex — the `SeedHash` the chain records for a shuffle. */
export function seedDigest(seedHex: string): string {
    const deck = new Deck();
    deck.shuffleFromSeed(seedHex);
    return deck.seedHash;
}

/** Where the deal puts each card, for `players` dealt-in seats. */
export function holeCardIndex(players: number, round: number, position: number): number {
    return round * players + position;
}

export function boardStartIndex(players: number, holeCardsPerPlayer: number): number {
    return holeCardsPerPlayer * players + SET_ASIDE_CARDS;
}

/** Do this many dealt-in players put `board` and every `shownHand` where the deck says? */
export function dealReproduces(deck: string[], players: number, holeCardsPerPlayer: number, board: string[], shownHands: string[][]): boolean {
    const start = boardStartIndex(players, holeCardsPerPlayer);
    if (!board.every((card, i) => deck[start + i] === card)) return false;
    return shownHands.every(hand => positionOfHand(deck, players, holeCardsPerPlayer, hand) !== null);
}

/** The deal position (0-based, in seat order) whose cards are `hand`; null when none. */
export function positionOfHand(deck: string[], players: number, holeCardsPerPlayer: number, hand: string[]): number | null {
    if (hand.length !== holeCardsPerPlayer) return null;
    for (let position = 0; position < players; position++) {
        const dealt = new Set(Array.from({ length: holeCardsPerPlayer }, (_, round) => deck[holeCardIndex(players, round, position)]));
        if (hand.every(card => dealt.has(card))) return position;
    }
    return null;
}

export interface ResolvedPlayers {
    /** How many seats were dealt in; null when the evidence doesn't say. */
    players: number | null;
    /** True when `players` came from the hand's own end state, so positions map to seats. */
    seatsKnown: boolean;
}

/**
 * How many seats were dealt in. The hand's own end state says directly
 * (`dealtSeats`); when it can't be read (the next hand started in the same
 * block) or disagrees (a player left mid-hand), the count is the one that puts
 * the cards where the deck says. Card positions are unique, so any board card
 * fixes it. The board decides when there is one, so a bad shown hand fails
 * only its own check; the shown hands decide only when no board was dealt.
 */
export function resolvePlayers(deck: string[], holeCardsPerPlayer: number, board: string[], shownHands: string[][], dealtSeats: number[] | null): ResolvedPlayers {
    const fromState = hasValue(dealtSeats) && dealtSeats.length >= 2 ? dealtSeats.length : null;
    if (isEmpty(board) && isEmpty(shownHands)) {
        return hasValue(fromState) ? { players: fromState, seatsKnown: true } : { players: null, seatsKnown: false };
    }
    const fits = (n: number): boolean => (isEmpty(board) ? dealReproduces(deck, n, holeCardsPerPlayer, [], shownHands) : dealReproduces(deck, n, holeCardsPerPlayer, board, []));
    if (hasValue(fromState) && fits(fromState)) return { players: fromState, seatsKnown: true };
    const candidates: number[] = [];
    for (let n = 2; n <= MAX_DEALT_PLAYERS; n++) {
        if (fits(n)) candidates.push(n);
    }
    return candidates.length === 1 ? { players: candidates[0], seatsKnown: false } : { players: null, seatsKnown: false };
}

export type CheckId = "seed" | "board" | "shown";
export type CheckStatus = "pass" | "fail" | "skipped";

export interface VerificationCheck {
    id: CheckId;
    status: CheckStatus;
    title: string;
    detail: string;
}

/** verified: shown cards checked out. nothing-shown: no card was shown to check. */
export type Verdict = "verified" | "nothing-shown" | "failed" | "unavailable";

export interface HandEvidence {
    /** The seed from the hand's new-hand transaction; null when it carried none. */
    seed: string | null;
    holeCardsPerPlayer: number;
    /** The community cards the table showed. */
    board: string[];
    /** The hands shown at showdown. */
    shownHands: string[][];
    /** Dealt-in seats in deal order, when the hand's own end state could be read. */
    dealtSeats: number[] | null;
}

export interface DealtHand {
    /** 0-based deal position, in seat order. */
    position: number;
    /** The seat, when known (see ResolvedPlayers.seatsKnown). */
    seat: number | null;
    cards: string[];
    /** Whether the table showed this hand. */
    shown: boolean;
}

export interface HandVerification {
    verdict: Verdict;
    checks: VerificationCheck[];
    /** The recomputed deck, top first; null without a seed. */
    deck: string[] | null;
    players: number | null;
    hands: DealtHand[];
    setAside: string[];
    /** The board as the recomputed deck deals it, as far as the hand went. */
    board: string[];
}

export const SEED_CHECK_TITLE = "Seed recorded on chain";
export const BOARD_CHECK_TITLE = "Board matches the recomputed deck";
export const SHOWN_CHECK_TITLE = "Shown hands match the deal";

function plural(n: number, one: string, many: string): string {
    return `${n} ${n === 1 ? one : many}`;
}

/** Check a finished hand's shown cards against the deck its seed produces. */
export function verifyHand(evidence: HandEvidence): HandVerification {
    const { seed, holeCardsPerPlayer: hc, board, shownHands, dealtSeats } = evidence;
    if (isNullish(seed)) {
        return {
            verdict: "unavailable",
            checks: [
                {
                    id: "seed",
                    status: "fail",
                    title: "No seed recorded for this hand",
                    detail: "This hand was shuffled from chain state rather than a seed in its transaction, so it can't be recomputed here yet."
                }
            ],
            deck: null,
            players: null,
            hands: [],
            setAside: [],
            board: []
        };
    }

    const deck = deckFromSeed(seed);
    const { players, seatsKnown } = resolvePlayers(deck, hc, board, shownHands, dealtSeats);
    const checks: VerificationCheck[] = [
        {
            id: "seed",
            status: "pass",
            title: SEED_CHECK_TITLE,
            detail: "The transaction that started this hand carried a 32-byte seed. The deck below is recomputed from it in your browser."
        }
    ];

    if (isEmpty(board)) {
        checks.push({ id: "board", status: "skipped", title: BOARD_CHECK_TITLE, detail: "The hand ended before the flop, so no board was dealt." });
    } else if (isNullish(players)) {
        checks.push({ id: "board", status: "fail", title: BOARD_CHECK_TITLE, detail: "No deal from this deck puts these cards on the board." });
    } else {
        const start = boardStartIndex(players, hc);
        checks.push({
            id: "board",
            status: "pass",
            title: BOARD_CHECK_TITLE,
            detail: `${plural(board.length, "community card is", "community cards are")} the deck's cards ${start + 1}–${start + board.length}, after ${hc * players} hole cards and ${SET_ASIDE_CARDS} set aside.`
        });
    }

    if (isEmpty(shownHands)) {
        checks.push({ id: "shown", status: "skipped", title: SHOWN_CHECK_TITLE, detail: "No hands were shown." });
    } else {
        const matched = isNullish(players) ? 0 : shownHands.filter(hand => positionOfHand(deck, players, hc, hand) !== null).length;
        checks.push(
            matched === shownHands.length
                ? { id: "shown", status: "pass", title: SHOWN_CHECK_TITLE, detail: `${plural(shownHands.length, "hand shown at showdown is", "hands shown at showdown are")} exactly what the deal gave those seats.` }
                : { id: "shown", status: "fail", title: SHOWN_CHECK_TITLE, detail: `${matched} of ${plural(shownHands.length, "shown hand", "shown hands")} match the recomputed deal.` }
        );
    }

    const hands: DealtHand[] = [];
    if (hasValue(players)) {
        for (let position = 0; position < players; position++) {
            const cards = Array.from({ length: hc }, (_, round) => deck[holeCardIndex(players, round, position)]);
            hands.push({
                position,
                seat: seatsKnown && hasValue(dealtSeats) ? dealtSeats[position] : null,
                cards,
                shown: shownHands.some(hand => hand.length === cards.length && hand.every(card => cards.includes(card)))
            });
        }
    }

    const statuses = checks.map(check => check.status);
    const verdict: Verdict = statuses.includes("fail") ? "failed" : checks.some(c => c.id !== "seed" && c.status === "pass") ? "verified" : "nothing-shown";
    const start = hasValue(players) ? boardStartIndex(players, hc) : 0;
    return {
        verdict,
        checks,
        deck,
        players,
        hands,
        setAside: hasValue(players) ? deck.slice(hc * players, hc * players + SET_ASIDE_CARDS) : [],
        board: hasValue(players) ? deck.slice(start, start + board.length) : []
    };
}

// ---- chain data parsing ------------------------------------------------------

export interface TxRef {
    hash: string;
    height: number;
}

export interface TxSearchHit extends TxRef {
    /** Events of the tx, attributes flattened to key → value (the first of each key). */
    events: Array<{ type: string; attributes: Record<string, string> }>;
}

/** The first tx of a CometBFT tx_search result, with its events; null when there is none. */
export function parseFirstTx(response: unknown): TxSearchHit | null {
    const result = isRecord(response) && isRecord(response.result) ? response.result : null;
    const txs = result && Array.isArray(result.txs) ? result.txs : [];
    const first: unknown = txs[0];
    if (!isRecord(first) || !isString(first.hash)) return null;
    const height = Number(first.height);
    if (!Number.isInteger(height) || height <= 0) return null;
    const rawEvents = isRecord(first.tx_result) && Array.isArray(first.tx_result.events) ? first.tx_result.events : [];
    const events = rawEvents.filter(isRecord).map(event => {
        const attributes: Record<string, string> = {};
        for (const attribute of Array.isArray(event.attributes) ? event.attributes : []) {
            if (isRecord(attribute) && isString(attribute.key) && isString(attribute.value) && !(attribute.key in attributes)) {
                attributes[attribute.key] = attribute.value;
            }
        }
        return { type: isString(event.type) ? event.type : "", attributes };
    });
    return { hash: first.hash, height, events };
}

const splitCards = (value: string | undefined): string[] => (hasContent(value) ? value.split(",") : []);

/** The board and shown hole cards from a hand-end tx's `hand_completed` event; null when absent. */
export function parseHandCompleted(hit: TxSearchHit | null, holeCardsPerPlayer: number): { board: string[]; shownHands: string[][] } | null {
    const event = hit?.events.find(e => e.type === "hand_completed");
    if (!event) return null;
    const revealed = splitCards(event.attributes.revealed_hole_cards);
    const shownHands: string[][] = [];
    for (let i = 0; i + holeCardsPerPlayer <= revealed.length; i += holeCardsPerPlayer) {
        shownHands.push(revealed.slice(i, i + holeCardsPerPlayer));
    }
    return { board: splitCards(event.attributes.community_cards), shownHands };
}

/** The seed of the new-hand message in a REST `cosmos/tx/v1beta1/txs/{hash}` reply. */
export function parseNewHandSeed(response: unknown): string | null {
    const tx = isRecord(response) && isRecord(response.tx) ? response.tx : null;
    const body = tx && isRecord(tx.body) ? tx.body : null;
    const messages = body && Array.isArray(body.messages) ? body.messages : [];
    for (const message of messages) {
        if (isRecord(message) && message.action === "new-hand") {
            return parseDealSeed(isString(message.data) ? message.data : null);
        }
    }
    return null;
}

/** Seats dealt into `handNumber`, in deal order — only when `state` is that hand's own end state. */
export function dealtSeatsFromState(state: TexasHoldemStateDTO | null | undefined, handNumber: number, holeCardsPerPlayer: number): number[] | null {
    if (!state || state.handNumber !== handNumber) return null;
    const seats = (state.players ?? []).filter(p => Array.isArray(p.holeCards) && p.holeCards.length === holeCardsPerPlayer).map(p => p.seat);
    return hasElements(seats) ? [...seats].sort((a, b) => a - b) : null;
}

/** Is hand `handNumber` still being played at the live table? */
export type HandPhase = "running" | "ended" | "unknown";

export function handPhase(state: Pick<TexasHoldemStateDTO, "handNumber" | "round"> | null | undefined, handNumber: number): HandPhase {
    if (!state || !Number.isInteger(state.handNumber)) return "unknown";
    if (handNumber < state.handNumber) return "ended";
    if (handNumber === state.handNumber) return state.round === TexasHoldemRound.END ? "ended" : "running";
    return "unknown";
}

export interface VerificationRecordInput {
    tableId: string;
    handNumber: number;
    startTx: TxRef | null;
    endHeight: number | null;
    evidence: HandEvidence;
    verification: HandVerification;
}

/** Everything needed to redo the checks offline, as the downloadable record. */
export function verificationRecord(input: VerificationRecordInput): Record<string, unknown> {
    const { tableId, handNumber, startTx, endHeight, evidence, verification } = input;
    return {
        protocol: DEAL_PROTOCOL,
        tableId,
        handNumber,
        startTx,
        endHeight,
        seed: evidence.seed,
        seedSha256: hasValue(evidence.seed) ? seedDigest(evidence.seed) : null,
        derivation: DERIVATION_DESCRIPTION,
        dealOrder: DEAL_ORDER_DESCRIPTION,
        holeCardsPerPlayer: evidence.holeCardsPerPlayer,
        shown: { board: evidence.board, hands: evidence.shownHands },
        recomputed: {
            deck: verification.deck,
            players: verification.players,
            hands: verification.hands,
            setAside: verification.setAside,
            board: verification.board
        },
        verdict: verification.verdict,
        checks: verification.checks.map(({ id, status, detail }) => ({ id, status, detail }))
    };
}

// ---- presentation ------------------------------------------------------------

/** Where a verification stands, as the verify window shows it. */
export type VerificationStatus = "idle" | "pending" | "loading" | "ready" | "error";

export type BannerTone = "pending" | "verified" | "neutral" | "failed";

export interface VerificationBanner {
    tone: BannerTone;
    text: string;
}

/** The verify window's headline for a status and (once ready) its verdict. */
export function verificationBanner(status: VerificationStatus, verification: HandVerification | null, error: string | null): VerificationBanner {
    if (status === "pending") return { tone: "pending", text: "Hand still running — verification opens when it ends." };
    if (status === "error") return { tone: "neutral", text: error ?? "This hand can't be verified right now." };
    if (status !== "ready" || isNullish(verification)) return { tone: "neutral", text: "Reading the hand from the chain…" };
    switch (verification.verdict) {
        case "verified":
            return { tone: "verified", text: "Verified — every card shown matches the deck recomputed from this hand's seed." };
        case "nothing-shown":
            return { tone: "neutral", text: "Deck recomputed — no cards were shown in this hand to check against." };
        case "failed":
            return { tone: "failed", text: "Verification failed — see the checks below." };
        case "unavailable":
            return { tone: "neutral", text: "This hand can't be recomputed here yet." };
    }
}

/** The three checks with a shared detail, for while there are no results yet. */
export function placeholderChecks(detail: string): Array<Pick<VerificationCheck, "id" | "title" | "detail">> {
    return [
        { id: "seed", title: SEED_CHECK_TITLE, detail },
        { id: "board", title: BOARD_CHECK_TITLE, detail },
        { id: "shown", title: SHOWN_CHECK_TITLE, detail }
    ];
}

/** The hand before the live one, offered beside it; null before hand 2. */
export function previousHand(state: Pick<TexasHoldemStateDTO, "handNumber"> | null | undefined): number | null {
    if (!state || !Number.isInteger(state.handNumber) || state.handNumber < 2) return null;
    return state.handNumber - 1;
}

/** "Seat 4", or the deal position when seats can't be labelled. */
export function dealtHandLabel(hand: Pick<DealtHand, "seat" | "position">): string {
    return hasValue(hand.seat) ? `Seat ${hand.seat}` : `Player ${hand.position + 1}`;
}

/** File name for a downloaded verification record. */
export function verificationRecordFileName(tableId: string, handNumber: number): string {
    return `block52-hand-${tableId.slice(0, 10)}-${handNumber}.json`;
}
