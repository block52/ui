import { Deck, GameVariant, PlayerActionType, PlayerDTO, PlayerStatus, PokerSolver, TexasHoldemRound, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { isMaskedHand, isRevealedHand } from "../bus/deriveEvents";
import { hasElements, hasValue } from "./guards";
import { describeShownHand } from "./showdownSummary";

export interface FinishingSeat {
    seat: number;
    /** Present so the recap can tell the viewer's row from the other seats. */
    address?: string;
    cards: string[];
    description: string;
    won: string | null;
    winningCards?: string[];
}

export interface FinishingHand {
    handNumber: number;
    board: string[];
    players: FinishingSeat[];
}

/** Cards already shown this hand, keyed by address. Survives a later bust or fold. */
export interface HandRevealLedger {
    handNumber: number;
    shown: Map<string, { seat: number; cards: string[] }>;
    /** The viewer's own hole cards, including when they folded or mucked. */
    ownCards: string[] | null;
}

export interface CaptureContext {
    viewer?: string | null;
    shown?: ReadonlyMap<string, { seat: number; cards: string[] }>;
    ownCards?: string[] | null;
    variant?: GameVariant;
}

export const normalizeCard = (card: string) => card.toUpperCase().replace(/^10/, "T");

/** Prefer the engine's winning combination; older snapshots can use revealed cards only. */
export function finishingWinnerCards(hand: FinishingHand): Set<string> {
    return new Set(hand.players.filter(player => player.won !== null).flatMap(player => {
        if (player.winningCards !== undefined) return player.winningCards.map(normalizeCard);
        if (player.cards.length !== 2 || hand.board.length !== 5) return [];
        try {
            return PokerSolver.evaluatePartialHand([...player.cards, ...hand.board].map(card => Deck.fromString(normalizeCard(card))))
                .bestHand.map(card => normalizeCard(card.mnemonic || card.toString()));
        } catch { return []; }
    }));
}

const validCards = (cards: string[] = []) => cards.filter(card => /^(?:[2-9TJQKA]|10)[CDHS]$/i.test(card));

/** A full real hand. Masked, partial, and garbage tokens are not cards we can show. */
function holeCardsIfShown(cards: string[] | undefined): string[] {
    if (!cards || !isRevealedHand(cards)) return [];
    const parsed = validCards(cards);
    return parsed.length === cards.length ? parsed : [];
}

function hasShowAction(state: TexasHoldemStateDTO, address: string): boolean {
    return (state.previousActions ?? []).some(action =>
        action.action === PlayerActionType.SHOW && action.playerId?.toLowerCase() === address
    );
}

function playedThisHand(state: TexasHoldemStateDTO, address: string): boolean {
    return (state.previousActions ?? []).some(action => action.playerId?.toLowerCase() === address);
}

/**
 * Hole cards the table has made public on this frame.
 * Folded and mucked opponents stay hidden even if this client still has the
 * viewer's copy of a hand. A busted player keeps the cards when this hand
 * actually dealt them in — the end frame often relabels a shown all-in as
 * `busted` and that used to drop the hand.
 */
function publiclyShownNow(player: PlayerDTO, state: TexasHoldemStateDTO, remembered: boolean): string[] {
    const cards = holeCardsIfShown(player.holeCards);
    if (cards.length === 0) return [];
    const address = player.address.toLowerCase();
    if (
        player.status === PlayerStatus.SHOWING
        || player.status === PlayerStatus.ALL_IN
        || hasShowAction(state, address)
        || remembered
        || (player.status === PlayerStatus.BUSTED && (remembered || playedThisHand(state, address)))
    ) {
        return cards;
    }
    return [];
}

export function createHandRevealLedger(handNumber = -1): HandRevealLedger {
    return { handNumber, shown: new Map(), ownCards: null };
}

/**
 * Remember every hand this viewer is allowed to know, as the streets arrive.
 * The end frame is not a safe sole source: showdown can flip a seat to
 * `busted` or `folded` and clear the cards that were face up a frame earlier.
 */
export function observeRevealedCards(
    ledger: HandRevealLedger,
    state: TexasHoldemStateDTO,
    viewer: string | null,
    previous: TexasHoldemStateDTO | null
): void {
    if (ledger.handNumber !== state.handNumber) {
        ledger.handNumber = state.handNumber;
        ledger.shown.clear();
        ledger.ownCards = null;
    }
    const viewerAddress = viewer?.toLowerCase() ?? null;
    const sameHand = previous?.handNumber === state.handNumber;
    const prevByAddress = new Map(
        (sameHand ? previous?.players ?? [] : []).map(player => [player.address.toLowerCase(), player])
    );
    for (const player of state.players ?? []) {
        const address = player.address.toLowerCase();
        const cards = holeCardsIfShown(player.holeCards);
        if (viewerAddress && address === viewerAddress && cards.length > 0) ledger.ownCards = cards;
        const prev = prevByAddress.get(address);
        // A deal to the viewer is not a public show. Fold and muck are not either.
        const flipped = !!prev
            && isMaskedHand(prev.holeCards)
            && cards.length > 0
            && player.status !== PlayerStatus.FOLDED
            && player.status !== PlayerStatus.MUCKED
            && player.status !== PlayerStatus.ACTIVE
            && player.status !== PlayerStatus.SEATED;
        if (cards.length > 0 && (
            flipped
            || player.status === PlayerStatus.SHOWING
            || player.status === PlayerStatus.ALL_IN
            || hasShowAction(state, address)
            || (player.status === PlayerStatus.BUSTED && (ledger.shown.has(address) || playedThisHand(state, address)))
            || ledger.shown.has(address)
        )) {
            ledger.shown.set(address, { seat: player.seat, cards });
        }
    }
}

function seatSnapshot(
    seat: number,
    address: string,
    cards: string[],
    state: TexasHoldemStateDTO,
    board: string[],
    variant: GameVariant | undefined
): FinishingSeat {
    const winner = (state.winners ?? []).find(w => w.address.toLowerCase() === address);
    return {
        seat,
        address,
        cards,
        description: winner?.description || (cards.length >= 2 ? describeShownHand(cards, board, variant)?.description : null) || "Cards not shown",
        won: winner ? winner.amount : null,
        // Retain only already-visible cards, never hidden winner hole cards.
        ...(winner?.cards?.length ? { winningCards: validCards(winner.cards).map(normalizeCard)
            .filter(card => [...board, ...cards].map(normalizeCard).includes(card)) } : {})
    };
}

/**
 * The hand the bust modal keeps. Public showdown and all-in hands, voluntary
 * shows, and the viewer's own cards. Hidden and mucked opponent cards are
 * left out. `context.shown` is what earlier frames of this same hand revealed,
 * so a final frame that relabels those seats cannot drop them.
 */
/**
 * This end snapshot is the hand the finisher actually played: they won the pot,
 * they acted in it, or their hole cards are face up on this frame. A result
 * left over from an earlier bust is not this hand.
 */
export function playerInEndHand(state: TexasHoldemStateDTO, playerId: string): boolean {
    if (state.round !== TexasHoldemRound.END || !playerId) return false;
    const address = playerId.toLowerCase();
    if ((state.winners ?? []).some(winner => winner.address?.toLowerCase() === address)) return true;
    if (playedThisHand(state, address)) return true;
    const player = (state.players ?? []).find(seat => seat.address?.toLowerCase() === address);
    return hasValue(player) && hasElements(holeCardsIfShown(player.holeCards));
}

/** Every finisher the current end snapshot can show without borrowing another hand. */
export function endHandFinisherIds(state: TexasHoldemStateDTO): string[] {
    if (state.round !== TexasHoldemRound.END || !hasElements(state.winners)) return [];
    const ids: string[] = [];
    for (const result of state.results ?? []) {
        if (!result.playerId || !playerInEndHand(state, result.playerId)) continue;
        const address = result.playerId.toLowerCase();
        if (!ids.includes(address)) ids.push(address);
    }
    return ids;
}

/** Viewer cards plus at least one pot winner's cards. Anything less is not the showdown. */
export function finishingHandReady(hand: FinishingHand | null | undefined): boolean {
    if (!hand) return false;
    const shown = hand.players.filter(player => player.cards.length >= 2);
    return hasElements(hand.board) && shown.some(player => hasValue(player.won)) && shown.length >= 2;
}

/**
 * Label for one seat in the result modal. The viewer's row is always "Your Cards".
 * A pot winner who beat the viewer is named; everyone else stays a seat number.
 */
export function finishingSeatHeading(player: FinishingSeat, viewerAddress: string | null, viewerWon: boolean): string {
    const yours = !!viewerAddress && player.address?.toLowerCase() === viewerAddress.toLowerCase();
    if (yours) return "Your Cards";
    if (!viewerWon && hasValue(player.won)) return `Beaten by Seat ${player.seat}`;
    return `Seat ${player.seat}`;
}

/**
 * The showdown in `state` for `viewer`, or null when their cards or the pot
 * winner's cards are not actually in that snapshot.
 */
export function showdownForViewer(state: TexasHoldemStateDTO, viewer: string): FinishingHand | null {
    const hand = captureFinishingHand(state, { viewer });
    return finishingHandReady(hand) ? hand : null;
}

export function captureFinishingHand(state: TexasHoldemStateDTO, context: CaptureContext = {}): FinishingHand {
    const board = validCards(state.communityCards);
    const viewer = context.viewer?.toLowerCase() ?? null;
    const shown = context.shown ?? new Map<string, { seat: number; cards: string[] }>();
    const seen = new Set<string>();
    const players = (state.players ?? []).map(player => {
        const address = player.address.toLowerCase();
        seen.add(address);
        const remembered = shown.get(address)?.cards ?? [];
        const livePublic = publiclyShownNow(player, state, remembered.length > 0);
        const liveOwn = viewer === address ? holeCardsIfShown(player.holeCards) : [];
        const own = liveOwn.length > 0 ? liveOwn : (viewer === address ? (context.ownCards ?? []) : []);
        const cards = livePublic.length > 0 ? livePublic : (remembered.length > 0 ? remembered : own);
        return seatSnapshot(player.seat, address, cards, state, board, context.variant);
    });
    const removed = [...shown.entries()]
        .filter(([address, info]) => !seen.has(address) && info.cards.length > 0)
        .map(([address, info]) => seatSnapshot(info.seat, address, info.cards, state, board, context.variant))
        .sort((a, b) => a.seat - b.seat);
    return { handNumber: state.handNumber, board, players: [...players, ...removed] };
}

// In-memory only: scoped by table and wallet, with no private cards or disk persistence.
const snapshots = new Map<string, FinishingHand>();
const listeners = new Set<() => void>();
const key = (table: string, player: string) => `${table}:${player.toLowerCase()}`;
export const getFinishingHand = (table: string, player: string) => snapshots.get(key(table, player)) ?? null;
export const subscribeFinishingHand = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

function snapshotWeight(hand: FinishingHand): number {
    return hand.board.length + hand.players.reduce((sum, player) => sum + player.cards.length, 0);
}

export function saveFinishingHand(table: string, player: string, hand: FinishingHand) {
    const id = key(table, player);
    const previous = snapshots.get(id);
    // A complete showdown stays. A thinner frame of the same hand must not wipe it.
    // A different hand replaces the stored one only when the stored one never had
    // both the viewer's cards and the pot winner's cards.
    if (previous) {
        if (previous.handNumber === hand.handNumber) {
            if (snapshotWeight(hand) < snapshotWeight(previous) || JSON.stringify(previous) === JSON.stringify(hand)) return;
        } else if (finishingHandReady(previous) || !finishingHandReady(hand)) {
            return;
        }
    }
    snapshots.set(id, hand);
    if (snapshots.size > 90) snapshots.delete(snapshots.keys().next().value!);
    listeners.forEach(listener => listener());
}
