import { GameFormat, TxExecutionError } from "@block52/poker-vm-sdk";
import { cryptoRandomInt, drawSeat, isSeatTakenError, openSeats, SEAT_TAKEN_CODE, seatsAreDrawn } from "./seatDraw";

describe("cryptoRandomInt", () => {
    it("stays inside [0, n)", () => {
        for (let i = 0; i < 500; i++) {
            const v = cryptoRandomInt(9);
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(9);
        }
    });

    it("returns 0 for a range of one", () => {
        expect(cryptoRandomInt(1)).toBe(0);
    });

    it("rejects a range it can't draw from", () => {
        expect(() => cryptoRandomInt(0)).toThrow("1..2^32");
        expect(() => cryptoRandomInt(-3)).toThrow("1..2^32");
        expect(() => cryptoRandomInt(2.5)).toThrow("1..2^32");
        expect(() => cryptoRandomInt(2 ** 32 + 1)).toThrow("1..2^32");
    });

    it("redraws values in the biased top slice instead of folding them", () => {
        // n = 3 leaves 2^32 % 3 = 1 value (2^32 - 1) above the limit; feed it
        // first and check the draw comes from the next value instead.
        const values = [2 ** 32 - 1, 7];
        const spy = jest.spyOn(crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(buf: T): T => {
            (buf as unknown as Uint32Array)[0] = values.shift() as number;
            return buf;
        });
        try {
            expect(cryptoRandomInt(3)).toBe(7 % 3);
            expect(spy).toHaveBeenCalledTimes(2);
        } finally {
            spy.mockRestore();
        }
    });

    it("is roughly uniform", () => {
        const counts = new Array(6).fill(0);
        const draws = 60_000;
        for (let i = 0; i < draws; i++) {
            counts[cryptoRandomInt(6)]++;
        }
        // Expected 10,000 each; a fair source stays well within ±5%.
        for (const c of counts) {
            expect(c).toBeGreaterThan(9_500);
            expect(c).toBeLessThan(10_500);
        }
    });
});

describe("seatsAreDrawn", () => {
    it("draws seats at a Sit & Go and a tournament", () => {
        expect(seatsAreDrawn(GameFormat.SIT_AND_GO)).toBe(true);
        expect(seatsAreDrawn(GameFormat.TOURNAMENT)).toBe(true);
    });

    it("keeps seat choice at a cash table", () => {
        expect(seatsAreDrawn(GameFormat.CASH)).toBe(false);
    });

    it("draws nothing while the format hasn't loaded", () => {
        expect(seatsAreDrawn(undefined)).toBe(false);
    });
});

describe("openSeats", () => {
    it("lists every seat on an empty table", () => {
        expect(openSeats(4, [])).toEqual([1, 2, 3, 4]);
    });

    it("skips occupied and excluded seats", () => {
        expect(openSeats(6, [1, 4], new Set([2]))).toEqual([3, 5, 6]);
    });

    it("is empty when the table is full", () => {
        expect(openSeats(2, [1, 2])).toEqual([]);
    });
});

describe("drawSeat", () => {
    it("returns the seat the source picks", () => {
        expect(drawSeat([2, 5, 7], () => 0)).toBe(2);
        expect(drawSeat([2, 5, 7], () => 2)).toBe(7);
    });

    it("asks the source for a range the size of the seat list", () => {
        const source = jest.fn(() => 1);
        drawSeat([3, 6, 8, 9], source);
        expect(source).toHaveBeenCalledWith(4);
    });

    it("always returns one of the seats with the default source", () => {
        const seats = [2, 3, 6, 9];
        for (let i = 0; i < 200; i++) {
            expect(seats).toContain(drawSeat(seats));
        }
    });

    it("reaches every seat, not just the lowest", () => {
        const seen = new Set<number>();
        for (let i = 0; i < 500; i++) {
            seen.add(drawSeat([1, 2, 3]));
        }
        expect([...seen].sort()).toEqual([1, 2, 3]);
    });

    it("returns the only seat left", () => {
        expect(drawSeat([4])).toBe(4);
    });

    it("throws when no seat is open (no fallback seat — Commandment 7)", () => {
        expect(() => drawSeat([])).toThrow("No available seats");
    });

    it("rejects a source that returns an index outside the list", () => {
        expect(() => drawSeat([1, 2], () => 2)).toThrow("outside 0..1");
        expect(() => drawSeat([1, 2], () => -1)).toThrow("outside 0..1");
        expect(() => drawSeat([1, 2], () => 0.5)).toThrow("outside 0..1");
    });
});

describe("isSeatTakenError", () => {
    const failed = (code: number, rawLog?: string) => new TxExecutionError("join game", { transactionHash: "ABC", code, rawLog });

    it("matches the chain's seat-taken rejection", () => {
        expect(isSeatTakenError(failed(SEAT_TAKEN_CODE, "failed to execute message; message index: 0: seat 3 is already claimed in this block: seat already taken"))).toBe(true);
        expect(isSeatTakenError(failed(SEAT_TAKEN_CODE, "seat 3 is already occupied: seat already taken"))).toBe(true);
    });

    it("ignores other rejections", () => {
        expect(isSeatTakenError(failed(1111, "no available seats in game"))).toBe(false);
        expect(isSeatTakenError(failed(5, "insufficient funds"))).toBe(false);
    });

    it("needs the message too, since a bare code is only unique per module", () => {
        expect(isSeatTakenError(failed(SEAT_TAKEN_CODE, "some other module's error"))).toBe(false);
        expect(isSeatTakenError(failed(SEAT_TAKEN_CODE))).toBe(false);
    });

    it("ignores errors that never reached the chain", () => {
        expect(isSeatTakenError(new Error("seat already taken"))).toBe(false);
        expect(isSeatTakenError(undefined)).toBe(false);
    });
});
