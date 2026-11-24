import type { TournamentStateDTO } from "../types/tournament";
import { followTarget, gameIdFromTableId, tournamentProgress, type MyTournamentTable } from "./tournamentFollow";

const TID = "0xf7c46fa0c66eb470c6ddf1e4797ec75839099f3cd8e31c2ad5ca5e2b4b344d81";
const ME = "b521zc0wnv0rjuh796ytpkpuf59l73gzefc0wrwpra";

const table = (ordinal: number, broken: boolean) => ({
    tableId: `${TID}/t${ordinal}`,
    ordinal,
    players: [],
    broken,
    handNumber: 1,
    atBoundary: false
});

const state = (overrides: Partial<TournamentStateDTO> = {}): TournamentStateDTO => ({
    tournamentId: TID,
    status: "running",
    options: {
        buyIn: "1000000",
        startingStack: "1500",
        seatsPerTable: 9,
        minEntrants: 2,
        maxEntrants: 27,
        startTime: 1,
        blindStructure: { preset: "turbo" },
        actionTimeoutSeconds: 5
    },
    entrants: [
        { address: ME, status: "playing", tableId: `${TID}/t3`, seat: 4, stack: "1500" },
        { address: "b521other", status: "playing", tableId: `${TID}/t3`, seat: 1, stack: "1500" },
        { address: "b521gone", status: "busted", stack: "0" }
    ],
    tables: [table(1, true), table(2, false), table(3, false)],
    level: 1,
    prizePool: "0",
    payouts: [],
    results: [],
    seq: 1,
    ...overrides
});

describe("gameIdFromTableId", () => {
    it("replaces the last slash with a dash", () => {
        expect(gameIdFromTableId(`${TID}/t1`)).toBe(`${TID}-t1`);
    });
    it("throws on an id without a slash", () => {
        expect(() => gameIdFromTableId("nope")).toThrow();
    });
});

describe("tournamentProgress", () => {
    it("finds the wallet's table, its number among live tables and the players remaining", () => {
        const p = tournamentProgress(state(), ME.toUpperCase());
        expect(p.playersRemaining).toBe(2);
        expect(p.myTable).toEqual({ gameId: `${TID}-t3`, tableId: `${TID}/t3`, seat: 4, tableNumber: 2, tableCount: 2 });
    });
    it("has no table for a busted entrant, a stranger or no wallet", () => {
        expect(tournamentProgress(state(), "b521gone").myTable).toBeUndefined();
        expect(tournamentProgress(state(), "b521nobody").myTable).toBeUndefined();
        expect(tournamentProgress(state(), undefined).myTable).toBeUndefined();
    });
});

describe("followTarget", () => {
    const at = (n: number): MyTournamentTable => ({ gameId: `${TID}-t${n}`, tableId: `${TID}/t${n}`, seat: 1, tableNumber: n, tableCount: 3 });

    it("sends a moved player to the new table", () => {
        expect(followTarget(`${TID}-t1`, at(1), at(2))).toBe(`${TID}-t2`);
    });
    it("stays when the player has not moved", () => {
        expect(followTarget(`${TID}-t1`, at(1), at(1))).toBeUndefined();
    });
    it("does not drag a spectator of another table away", () => {
        expect(followTarget(`${TID}-t3`, at(1), at(2))).toBeUndefined();
    });
    it("stays when there is no current table (busted) or no history", () => {
        expect(followTarget(`${TID}-t1`, at(1), undefined)).toBeUndefined();
        expect(followTarget(`${TID}-t1`, undefined, at(2))).toBeUndefined();
    });
});
