import { GameFormat, GameVariant, GameListItem } from "@block52/poker-vm-sdk";
import { convertGameListItemToGameWithFormat, convertGameList } from "./convertUtils";

describe("convertUtils", () => {
    const makeGameListItem = (overrides?: Partial<GameListItem>): GameListItem => ({
        gameId: "game_001",
        creator: "cosmos1abc",
        format: GameFormat.CASH,
        variant: GameVariant.TEXAS_HOLDEM,
        currentPlayers: 0,
        gameOptions: {
            minBuyIn: "5000000",
            maxBuyIn: "50000000",
            minPlayers: 2,
            maxPlayers: 9,
            smallBlind: "50000",
            bigBlind: "100000",
            timeout: 30
        },
        createdAt: "2026-02-04T10:00:00Z",
        updatedAt: "2026-02-04T10:05:00Z",
        ...overrides
    });

    describe("convertGameListItemToGameWithFormat", () => {
        it("should convert a complete GameListItem", () => {
            const game = makeGameListItem();
            const result = convertGameListItemToGameWithFormat(game);

            expect(result.gameId).toBe("game_001");
            expect(result.minBuyIn).toBe("5000000");
            expect(result.maxBuyIn).toBe("50000000");
            expect(result.minPlayers).toBe(2);
            expect(result.maxPlayers).toBe(9);
            expect(result.currentPlayers).toBe(0);
            expect(result.gameFormat).toBe(GameFormat.CASH);
            expect(result.gameVariant).toBe(GameVariant.TEXAS_HOLDEM);
            expect(result.smallBlind).toBe("50000");
            expect(result.bigBlind).toBe("100000");
            expect(result.status).toBe("waiting");
            expect(result.creator).toBe("cosmos1abc");
            expect(result.timeout).toBe(30);
            expect(result.createdAt).toBe("2026-02-04T10:00:00Z");
            expect(result.updatedAt).toBe("2026-02-04T10:05:00Z");
        });

        it("should map format at root level (not from gameOptions)", () => {
            const game = makeGameListItem({ format: GameFormat.SIT_AND_GO });
            const result = convertGameListItemToGameWithFormat(game);
            expect(result.gameFormat).toBe(GameFormat.SIT_AND_GO);
        });

        it("should map variant at root level (not from gameOptions)", () => {
            const game = makeGameListItem({ variant: GameVariant.OMAHA });
            const result = convertGameListItemToGameWithFormat(game);
            expect(result.gameVariant).toBe(GameVariant.OMAHA);
        });

        it("should return 'unknown' for undefined format", () => {
            const game = makeGameListItem({ format: undefined as unknown as GameFormat });
            const result = convertGameListItemToGameWithFormat(game);
            expect(result.gameFormat).toBe("unknown");
        });

        it("should return 'unknown' for undefined variant", () => {
            const game = makeGameListItem({ variant: undefined as unknown as GameVariant });
            const result = convertGameListItemToGameWithFormat(game);
            expect(result.gameVariant).toBe("unknown");
        });

        it("should handle optional creator/createdAt/updatedAt", () => {
            const game = makeGameListItem({
                creator: undefined,
                createdAt: undefined,
                updatedAt: undefined
            });
            const result = convertGameListItemToGameWithFormat(game);
            expect(result.creator).toBeUndefined();
            expect(result.createdAt).toBeUndefined();
            expect(result.updatedAt).toBeUndefined();
        });

        it("should throw when gameOptions is missing", () => {
            const game = makeGameListItem({ gameOptions: undefined as any });
            expect(() => convertGameListItemToGameWithFormat(game)).toThrow("missing gameOptions");
        });
    });

    describe("convertGameList", () => {
        it("should convert all valid games", () => {
            const games = [makeGameListItem({ gameId: "game_001" }), makeGameListItem({ gameId: "game_002", format: GameFormat.SIT_AND_GO })];
            const result = convertGameList(games);
            expect(result).toHaveLength(2);
            expect(result[0].gameId).toBe("game_001");
            expect(result[1].gameId).toBe("game_002");
            expect(result[1].gameFormat).toBe(GameFormat.SIT_AND_GO);
        });

        it("should filter out games missing gameOptions", () => {
            const warnSpy = jest.spyOn(console, "warn").mockImplementation();
            const games = [
                makeGameListItem({ gameId: "game_good" }),
                makeGameListItem({ gameId: "game_bad", gameOptions: undefined as any }),
                makeGameListItem({ gameId: "game_good2" })
            ];
            const result = convertGameList(games);
            expect(result).toHaveLength(2);
            expect(result[0].gameId).toBe("game_good");
            expect(result[1].gameId).toBe("game_good2");
            expect(warnSpy).toHaveBeenCalledWith("[convertGameList] Game missing gameOptions, skipping:", "game_bad");
            warnSpy.mockRestore();
        });

        it("should return empty array for empty input", () => {
            const result = convertGameList([]);
            expect(result).toEqual([]);
        });

        it("should return empty array when all games lack gameOptions", () => {
            const warnSpy = jest.spyOn(console, "warn").mockImplementation();
            const games = [makeGameListItem({ gameId: "bad1", gameOptions: undefined as any }), makeGameListItem({ gameId: "bad2", gameOptions: null as any })];
            const result = convertGameList(games);
            expect(result).toEqual([]);
            expect(warnSpy).toHaveBeenCalledTimes(2);
            warnSpy.mockRestore();
        });
    });
});
