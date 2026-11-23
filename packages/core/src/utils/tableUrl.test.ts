import { gameIdFromRoute, isTournamentTablePath, parseTournamentGameId, tableUrl, tournamentGameId, tournamentUrl } from "./tableUrl";

const TOURNAMENT = "0xface4d5c131b7d806a87883d234dd1929a296c5e01b904e293d24dbe2eada97e";

describe("tableUrl", () => {
    it("routes a tournament table to /tournament/<id>/table/<n>", () => {
        expect(tableUrl(`${TOURNAMENT}-t2`)).toBe(`/tournament/${TOURNAMENT}/table/2`);
        expect(tableUrl(`${TOURNAMENT}-t12`)).toBe(`/tournament/${TOURNAMENT}/table/12`);
    });

    it("keeps every other game at /table/<id>", () => {
        expect(tableUrl("0xabcdef0123")).toBe("/table/0xabcdef0123");
        expect(tableUrl("0xnothex-t1")).toBe("/table/0xnothex-t1");
        expect(tableUrl(`${TOURNAMENT}-final`)).toBe(`/table/${TOURNAMENT}-final`);
    });
});

describe("parseTournamentGameId / tournamentGameId", () => {
    it("splits a directed table's game id and rebuilds it", () => {
        expect(parseTournamentGameId(`${TOURNAMENT}-t3`)).toEqual({ tournamentId: TOURNAMENT, tableNumber: 3 });
        expect(tournamentGameId(TOURNAMENT, 3)).toBe(`${TOURNAMENT}-t3`);
        expect(tournamentGameId(TOURNAMENT, "3")).toBe(`${TOURNAMENT}-t3`);
    });

    it("is undefined for a game id that is not a tournament table", () => {
        expect(parseTournamentGameId("0xabc")).toBeUndefined();
        expect(parseTournamentGameId(`${TOURNAMENT}-t`)).toBeUndefined();
        expect(parseTournamentGameId(`${TOURNAMENT}-t1x`)).toBeUndefined();
    });
});

describe("tournamentUrl", () => {
    it("is the tournament's own page", () => {
        expect(tournamentUrl(TOURNAMENT)).toBe(`/tournament/${TOURNAMENT}`);
    });
});

describe("gameIdFromRoute", () => {
    it("reads /table/:id", () => {
        expect(gameIdFromRoute({ id: "0xabc" })).toBe("0xabc");
    });

    it("builds the game id from /tournament/:tournamentId/table/:n", () => {
        expect(gameIdFromRoute({ tournamentId: TOURNAMENT, n: "2" })).toBe(`${TOURNAMENT}-t2`);
    });

    it("round-trips tableUrl", () => {
        const gameId = `${TOURNAMENT}-t4`;
        const [, , tournamentId, , n] = tableUrl(gameId).split("/");
        expect(gameIdFromRoute({ tournamentId, n })).toBe(gameId);
    });

    it("is undefined when the params name no table", () => {
        expect(gameIdFromRoute({})).toBeUndefined();
        expect(gameIdFromRoute({ tournamentId: TOURNAMENT })).toBeUndefined();
    });
});

describe("isTournamentTablePath", () => {
    it("matches a tournament's table page only", () => {
        expect(isTournamentTablePath("/tournament/0xabc/table/2")).toBe(true);
        expect(isTournamentTablePath("/tournament/0xabc")).toBe(false);
        expect(isTournamentTablePath("/tournaments")).toBe(false);
        expect(isTournamentTablePath("/table/0xabc")).toBe(false);
    });
});
