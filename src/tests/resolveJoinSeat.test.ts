import { GameFormat, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { resolveJoinSeat } from "../hooks/playerActions/joinTable";

// resolveJoinSeat must never produce seat 0: the SNG/tournament engine seats
// a 0 literally (the "not-seated" sentinel, seats are 1-indexed) instead of
// treating it as random, so a "random seat" join landed broken (ui#440).
// Cash: the requested seat, else the lowest empty seat. Sit & Go and
// tournament: a seat drawn at random from the empty seats (ui#969).

const state = (maxPlayers: number, occupiedSeats: number[]): TexasHoldemStateDTO =>
    ({
        gameOptions: { maxPlayers },
        players: occupiedSeats.map(seat => ({ seat }))
    } as unknown as TexasHoldemStateDTO);

const CASH = GameFormat.CASH;

describe("resolveJoinSeat — cash", () => {
    it("returns an explicitly requested seat as-is", () => {
        expect(resolveJoinSeat(2, state(9, [1]), CASH)).toBe(2);
    });

    it("picks the lowest empty seat when none is requested", () => {
        expect(resolveJoinSeat(undefined, state(2, []), CASH)).toBe(1);
        expect(resolveJoinSeat(undefined, state(2, [1]), CASH)).toBe(2);
    });

    it("treats the seat-0 sentinel as no seat rather than seating at 0", () => {
        expect(resolveJoinSeat(0, state(9, [1, 2]), CASH)).toBe(3);
    });

    it("skips occupied seats", () => {
        expect(resolveJoinSeat(undefined, state(9, [1, 2, 3, 5]), CASH)).toBe(4);
    });

    it("throws when the table is full instead of falling back to 0", () => {
        expect(() => resolveJoinSeat(undefined, state(2, [1, 2]), CASH)).toThrow("No available seats");
    });

    it("throws when game state has not loaded (no defaults — Commandment 7)", () => {
        expect(() => resolveJoinSeat(undefined, undefined, CASH)).toThrow("game state not loaded yet");
    });
});

describe.each([GameFormat.SIT_AND_GO, GameFormat.TOURNAMENT])("resolveJoinSeat — %s (seat drawn)", format => {
    it("draws from the empty seats with the given source", () => {
        const source = jest.fn(() => 2);
        // Empty seats are [2, 4, 5, 6]; index 2 is seat 5.
        expect(resolveJoinSeat(undefined, state(6, [1, 3]), format, new Set(), source)).toBe(5);
        expect(source).toHaveBeenCalledWith(4);
    });

    it("ignores a requested seat, so a seat can't be picked", () => {
        expect(resolveJoinSeat(4, state(6, [1, 3]), format, new Set(), () => 0)).toBe(2);
    });

    it("never draws a seat an earlier attempt lost, even if state still shows it empty", () => {
        // Empty seats [2, 4, 5, 6] minus lost seat 2 → [4, 5, 6].
        expect(resolveJoinSeat(undefined, state(6, [1, 3]), format, new Set([2]), () => 0)).toBe(4);
    });

    it("reaches more than the lowest seat with the default source", () => {
        const seen = new Set<number>();
        for (let i = 0; i < 300; i++) {
            seen.add(resolveJoinSeat(undefined, state(4, []), format));
        }
        expect([...seen].sort()).toEqual([1, 2, 3, 4]);
    });

    it("throws when every open seat has been lost", () => {
        expect(() => resolveJoinSeat(undefined, state(3, [1]), format, new Set([2, 3]))).toThrow("No available seats");
    });

    it("throws when game state has not loaded", () => {
        expect(() => resolveJoinSeat(undefined, undefined, format)).toThrow("game state not loaded yet");
    });
});

describe("resolveJoinSeat — format not loaded", () => {
    it("refuses to join rather than guess between a chosen and a drawn seat", () => {
        expect(() => resolveJoinSeat(3, state(9, []), undefined)).toThrow("game format not loaded yet");
        expect(() => resolveJoinSeat(undefined, state(9, []), undefined)).toThrow("game format not loaded yet");
    });
});
