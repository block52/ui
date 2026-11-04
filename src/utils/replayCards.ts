/**
 * Hole cards a replay viewer is entitled to see (ui#816 follow-up).
 *
 * The chain's public state masks every hole card ("X") except those of players
 * whose hand is tabled (status `showing`, or `cardsShown` for a player who busted
 * on the showdown — poker-vm#2758), so a hand's steps only ever carry real cards at the
 * showdown itself. A replay knows more than any single step:
 *   - cards shown at showdown (read once from the hand's final state), and
 *   - the viewer's own cards, from the authenticated GameState query signed
 *     with their key (the node checks the signed timestamp against the queried
 *     block's own time, so each query signs that block's timestamp).
 * These are overlaid on every step of the hand, replacing only masked hands.
 */
import type { PlayerDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { isMaskedHand, isRevealedHand } from "../bus/deriveEvents";
import { hasElements } from "../utils/guards";

/** gRPC method path of the authenticated (per-player masking) game state query. */
export const GAME_STATE_PATH = "/pokerchain.poker.v1.Query/GameState";

/** Lower-cased player address → that player's hole cards. */
export type KnownHoleCards = ReadonlyMap<string, string[]>;

export const NO_KNOWN_CARDS: KnownHoleCards = new Map();

const normalise = (address: string | undefined): string => (address ?? "").toLowerCase();

/** Every hand the state reveals (showdown "showing" players, or the viewer's own), by address. */
export function revealedHoleCards(state: TexasHoldemStateDTO | null | undefined): Map<string, string[]> {
    const known = new Map<string, string[]>();
    for (const player of state?.players ?? []) {
        if (isRevealedHand(player.holeCards) && normalise(player.address)) {
            known.set(normalise(player.address), [...(player.holeCards as string[])]);
        }
    }
    return known;
}

/** The hole cards of `address` in `state`, when they are real cards; else null. */
export function ownHoleCards(state: TexasHoldemStateDTO | null | undefined, address: string | null | undefined): string[] | null {
    if (!address) return null;
    return revealedHoleCards(state).get(normalise(address)) ?? null;
}

/** Later maps win for the same address. */
export function mergeKnownHoleCards(...parts: KnownHoleCards[]): Map<string, string[]> {
    const merged = new Map<string, string[]>();
    for (const part of parts) {
        for (const [address, cards] of part) merged.set(address, cards);
    }
    return merged;
}

/** A stable identity for a set of known cards (effect keys). */
export function knownHoleCardsKey(known: KnownHoleCards): string {
    return [...known.entries()]
        .map(([address, cards]) => `${address}=${cards.join(",")}`)
        .sort()
        .join("|");
}

/**
 * `state` with each masked hand replaced by its known cards. Hands that are
 * already real, players with no cards dealt, and unknown players are untouched;
 * the same object comes back when nothing changes.
 */
export function overlayKnownHoleCards(state: TexasHoldemStateDTO, known: KnownHoleCards): TexasHoldemStateDTO {
    if (known.size === 0 || !hasElements(state.players)) return state;
    let changed = false;
    const players = state.players.map((player: PlayerDTO) => {
        const cards = known.get(normalise(player.address));
        if (!cards || !isMaskedHand(player.holeCards)) return player;
        changed = true;
        return { ...player, holeCards: [...cards] };
    });
    return changed ? { ...state, players } : state;
}

interface BlockResponse {
    result?: { block?: { header?: { time?: unknown } } };
}

/**
 * The block's timestamp, in Unix seconds, from a CometBFT `/block?height=H`
 * response. CometBFT writes RFC 3339 with nanoseconds, which Date.parse does
 * not promise to read, so the fraction is cut to milliseconds first.
 */
export function parseBlockTime(response: unknown): number {
    const time = (response as BlockResponse)?.result?.block?.header?.time;
    if (typeof time !== "string") throw new Error("Block response has no header time");
    const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(time);
    if (!match) throw new Error(`Unrecognised block time: ${time}`);
    const [, base, fraction, zone] = match;
    const ms = Date.parse(`${base}${fraction ? fraction.slice(0, 4) : ""}${zone}`);
    if (Number.isNaN(ms)) throw new Error(`Unrecognised block time: ${time}`);
    return Math.floor(ms / 1000);
}
