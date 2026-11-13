import type { TournamentStateDTO } from "../types/tournament";
import { liveTournamentTables, tournamentStandings } from "./tournamentTables";

const T = "0xface4d5c";

const tournament = (over: Partial<TournamentStateDTO>): TournamentStateDTO =>
    ({ tournamentId: T, status: "running", entrants: [], tables: [], results: [], ...over }) as unknown as TournamentStateDTO;

describe("liveTournamentTables", () => {
    it("lists the live tables in table order with their route", () => {
        const t = tournament({
            tables: [
                { tableId: `${T}/t3`, ordinal: 3, players: ["a", "b"], broken: false, handNumber: 7, atBoundary: false },
                { tableId: `${T}/t1`, ordinal: 1, players: ["c"], broken: false, handNumber: 9, atBoundary: false },
                { tableId: `${T}/t2`, ordinal: 2, players: [], broken: true, handNumber: 4, atBoundary: true }
            ]
        });
        expect(liveTournamentTables(t)).toEqual([
            { number: 1, gameId: `${T}-t1`, url: `/tournament/${T}/table/1`, players: 1, handNumber: 9 },
            { number: 3, gameId: `${T}-t3`, url: `/tournament/${T}/table/3`, players: 2, handNumber: 7 }
        ]);
    });

    it("is empty before the tournament starts", () => {
        expect(liveTournamentTables(tournament({ tables: [] }))).toEqual([]);
    });
});

describe("tournamentStandings", () => {
    it("orders finished places best first and keeps shared places", () => {
        const t = tournament({
            results: [
                { place: 13, playerId: "b", payout: "0" },
                { place: 1, playerId: "w", payout: "9720000" },
                { place: 13, playerId: "c", payout: "0" },
                { place: 2, playerId: "r", payout: "6561000" }
            ] as never
        });
        expect(tournamentStandings(t).map(r => `${r.place}:${r.address}`)).toEqual(["1:w", "2:r", "13:b", "13:c"]);
    });

    it("does not reorder the record's own results", () => {
        const results = [{ place: 2, playerId: "r", payout: "1" }, { place: 1, playerId: "w", payout: "2" }] as never;
        const t = tournament({ results });
        tournamentStandings(t);
        expect((t.results as unknown as { place: number }[])[0].place).toBe(2);
    });
});
