import { describe, it, expect } from "@jest/globals";
import { GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { GameWithFormat } from "./convertUtils";
import {
    tableDisplayName,
    shortTableId,
    variantAbbreviation,
    formatLabel,
    isTableFull,
    seatFillPercent,
    matchesFormatFilter,
    countByFormat,
    matchesTableSearch,
    sortLobbyTables,
    formatBlinds,
    formatTableBuyIn,
    sngPrizeInfo,
    remainingCount
} from "./lobbyTables";

const GAME_ID = "0x34ab12cd56ef7890aa11bb22cc33dd44ee55ff6600112233445566778899840d";

const game = (overrides: Partial<GameWithFormat>): GameWithFormat => ({
    gameId: GAME_ID,
    minBuyIn: "400000",
    maxBuyIn: "2000000",
    minPlayers: 2,
    maxPlayers: 9,
    currentPlayers: 0,
    gameFormat: GameFormat.CASH,
    gameVariant: GameVariant.TEXAS_HOLDEM,
    smallBlind: "10000",
    bigBlind: "20000",
    status: "waiting",
    ...overrides
});

describe("lobbyTables", () => {
    describe("tableDisplayName", () => {
        it("uses the on-chain name when present", () => {
            expect(tableDisplayName(GAME_ID, "friday")).toBe("friday");
        });

        it("falls back to Table + last 5 chars, matching the table page", () => {
            expect(tableDisplayName(GAME_ID)).toBe("Table 9840d");
            expect(tableDisplayName(GAME_ID, "  ")).toBe("Table 9840d");
            expect(tableDisplayName(GAME_ID, null)).toBe("Table 9840d");
        });
    });

    describe("shortTableId", () => {
        it("keeps 0x, 2 leading and 4 trailing hex chars", () => {
            expect(shortTableId(GAME_ID)).toBe("0x34…840d");
        });

        it("returns short ids whole", () => {
            expect(shortTableId("0xabcd")).toBe("0xabcd");
        });
    });

    describe("variantAbbreviation / formatLabel", () => {
        it("abbreviates Texas Hold'em to NLH", () => {
            expect(variantAbbreviation(GameVariant.TEXAS_HOLDEM)).toBe("NLH");
        });

        it("spells out other variants", () => {
            expect(variantAbbreviation(GameVariant.OMAHA)).toBe("Omaha");
        });

        it("labels formats", () => {
            expect(formatLabel(GameFormat.CASH)).toBe("Cash");
            expect(formatLabel(GameFormat.SIT_AND_GO)).toBe("Sit & Go");
            expect(formatLabel(GameFormat.TOURNAMENT)).toBe("Tournament");
        });
    });

    describe("seats", () => {
        it("detects full tables", () => {
            expect(isTableFull({ currentPlayers: 9, maxPlayers: 9 })).toBe(true);
            expect(isTableFull({ currentPlayers: 3, maxPlayers: 9 })).toBe(false);
        });

        it("computes a clamped fill percentage", () => {
            expect(seatFillPercent({ currentPlayers: 3, maxPlayers: 9 })).toBe(33);
            expect(seatFillPercent({ currentPlayers: 4, maxPlayers: 4 })).toBe(100);
            expect(seatFillPercent({ currentPlayers: 0, maxPlayers: 0 })).toBe(0);
        });
    });

    describe("format filter", () => {
        const games = [game({ gameFormat: GameFormat.CASH }), game({ gameFormat: GameFormat.SIT_AND_GO }), game({ gameFormat: GameFormat.TOURNAMENT })];

        it("filters by tab", () => {
            expect(games.filter(g => matchesFormatFilter(g, "cash"))).toHaveLength(1);
            expect(games.filter(g => matchesFormatFilter(g, "sng"))).toHaveLength(1);
            expect(games.filter(g => matchesFormatFilter(g, "all"))).toHaveLength(3);
        });

        it("counts per tab", () => {
            expect(countByFormat(games)).toEqual({ all: 3, cash: 1, sng: 1 });
        });
    });

    describe("matchesTableSearch", () => {
        it("matches name, fallback name and id case-insensitively", () => {
            expect(matchesTableSearch({ gameId: GAME_ID, name: "friday" }, "FRI")).toBe(true);
            expect(matchesTableSearch({ gameId: GAME_ID }, "table 9840d")).toBe(true);
            expect(matchesTableSearch({ gameId: GAME_ID }, "34ab12")).toBe(true);
            expect(matchesTableSearch({ gameId: GAME_ID }, "nope")).toBe(false);
        });

        it("matches everything for a blank query", () => {
            expect(matchesTableSearch({ gameId: GAME_ID }, "   ")).toBe(true);
        });
    });

    describe("sortLobbyTables", () => {
        it("orders seated open, then empty, then full", () => {
            const tables = [
                { id: "full", currentPlayers: 4, maxPlayers: 4 },
                { id: "empty2", currentPlayers: 0, maxPlayers: 2 },
                { id: "seated9", currentPlayers: 3, maxPlayers: 9 },
                { id: "empty9", currentPlayers: 0, maxPlayers: 9 },
                { id: "seated2", currentPlayers: 1, maxPlayers: 2 }
            ];
            expect(sortLobbyTables(tables).map(t => t.id)).toEqual(["seated2", "seated9", "empty2", "empty9", "full"]);
        });

        it("does not mutate its input", () => {
            const tables = [
                { currentPlayers: 0, maxPlayers: 2 },
                { currentPlayers: 1, maxPlayers: 2 }
            ];
            sortLobbyTables(tables);
            expect(tables[0].currentPlayers).toBe(0);
        });
    });

    describe("money columns", () => {
        it("formats blinds", () => {
            expect(formatBlinds(game({}))).toBe("$0.01 / $0.02");
        });

        it("formats a cash buy-in range and a fixed SNG buy-in", () => {
            expect(formatTableBuyIn(game({}))).toBe("$0.40 – $2.00");
            expect(formatTableBuyIn(game({ gameFormat: GameFormat.SIT_AND_GO, minBuyIn: "1000000", maxBuyIn: "1000000" }))).toBe("$1.00");
        });

        it("computes the SNG prize pool with the protocol-fee split", () => {
            const sng = game({ gameFormat: GameFormat.SIT_AND_GO, minBuyIn: "1000000", maxPlayers: 4, protocolFeeBps: 1000 });
            expect(sngPrizeInfo(sng)).toEqual({ pool: "$3.60", split: "$0.90 + $0.10 fee" });
        });

        it("omits the split when no protocol fee is configured", () => {
            const sng = game({ gameFormat: GameFormat.SIT_AND_GO, minBuyIn: "100000", maxPlayers: 2 });
            expect(sngPrizeInfo(sng)).toEqual({ pool: "$0.20" });
        });
    });

    describe("remainingCount", () => {
        it("never goes negative", () => {
            expect(remainingCount(25, 10)).toBe(15);
            expect(remainingCount(5, 10)).toBe(0);
        });
    });
});
