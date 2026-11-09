/**
 * Seat draw for Sit & Go and tournament joins (ui#969).
 *
 * At a Sit & Go a player doesn't pick a seat: the client draws one at random
 * from the empty seats. Cash tables keep seat choice (poker-vm#333).
 *
 * The engine's `drawSeats` (poker-vm `pvm/go/engine/tournament.go`, the
 * multi-table director) is seeded from chain entropy because every validator
 * must reach the same seating. This draw is a single client's local pick, so
 * there is nothing to agree on: it uses the browser's CSPRNG instead.
 */
import { GameFormat, TxExecutionError } from "@block52/poker-vm-sdk";
import { isTournamentFormat } from "./gameFormatUtils";
import { hasValue, isEmpty, isString } from "./guards";

/** A uniform random integer in [0, n). */
export type RandomInt = (n: number) => number;

/** Largest range a single 32-bit draw can cover. */
const UINT32_RANGE = 2 ** 32;

/**
 * Uniform integer in [0, n) from `crypto.getRandomValues`. Rejection sampling
 * drops the top slice of the 32-bit range that `n` doesn't divide evenly, so
 * no seat is more likely than another (no modulo bias).
 */
export function cryptoRandomInt(n: number): number {
    if (!Number.isInteger(n) || n <= 0 || n > UINT32_RANGE) {
        throw new Error(`cryptoRandomInt needs an integer range in 1..2^32, got ${n}`);
    }
    const limit = UINT32_RANGE - (UINT32_RANGE % n);
    const buf = new Uint32Array(1);
    for (;;) {
        crypto.getRandomValues(buf);
        if (buf[0] < limit) {
            return buf[0] % n;
        }
    }
}

/**
 * Seats a Sit & Go or tournament joiner gets by draw instead of by choice.
 * An unloaded format is not drawn: callers that join must check the format
 * is loaded first (resolveJoinSeat throws on it).
 */
export function seatsAreDrawn(format: GameFormat | undefined): boolean {
    return hasValue(format) && isTournamentFormat(format);
}

/** The seats 1..maxPlayers that are neither occupied nor excluded, ascending. */
export function openSeats(maxPlayers: number, occupied: Iterable<number>, exclude: ReadonlySet<number> = new Set()): number[] {
    const taken = new Set(occupied);
    const open: number[] = [];
    for (let seat = 1; seat <= maxPlayers; seat++) {
        if (!taken.has(seat) && !exclude.has(seat)) {
            open.push(seat);
        }
    }
    return open;
}

/** Picks one of `seats` uniformly at random. Throws when there are none. */
export function drawSeat(seats: number[], randomInt: RandomInt = cryptoRandomInt): number {
    if (isEmpty(seats)) {
        throw new Error("No available seats to join");
    }
    const i = randomInt(seats.length);
    if (!Number.isInteger(i) || i < 0 || i >= seats.length) {
        throw new Error(`Seat draw returned ${i}, outside 0..${seats.length - 1}`);
    }
    return seats[i];
}

/**
 * pokerchain `types.ErrSeatTaken` (`x/poker/types/errors.go`): another join
 * claimed the seat first, either in committed state or earlier in the same
 * block (`PendingSeats`, pokerchain#153).
 */
export const SEAT_TAKEN_CODE = 1110;
const SEAT_TAKEN_LOG = "seat already taken";

/**
 * Did the chain reject this join because the seat was taken? Matches the
 * module's code AND its registered message, since a bare ABCI code is only
 * unique within its codespace.
 */
export function isSeatTakenError(err: unknown): boolean {
    return err instanceof TxExecutionError && err.code === SEAT_TAKEN_CODE && isString(err.rawLog) && err.rawLog.includes(SEAT_TAKEN_LOG);
}
