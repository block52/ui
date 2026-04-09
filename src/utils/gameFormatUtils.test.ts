import { GameFormat, GameVariant, GameOptionsDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import {
    validateGameState,
    extractGameDataFromMessage,
    isTournamentFormat,
    isCashFormat,
    isSitAndGoFormat,
    convertAmountForBlockchain,
    convertBlindsForBlockchain,
    getBlindsForDisplay,
    getGameTypeMnemonic
} from "./gameFormatUtils";

describe("gameFormatUtils", () => {
    describe("extractGameDataFromMessage", () => {
        // Partial mock - only includes fields needed for testing extraction
        const mockGameState = {
            type: "texasHoldem",
            gameOptions: {
                smallBlind: "50",
                bigBlind: "100",
                minBuyIn: "1000",
                maxBuyIn: "5000",
                minPlayers: 2,
                maxPlayers: 9
            }
        } as unknown as TexasHoldemStateDTO;

        describe("canonical Cosmos format (message.data.*)", () => {
            it("should extract gameState from message.data.gameState", () => {
                const message = { data: { gameState: mockGameState } };
                const result = extractGameDataFromMessage(message);
                expect(result.gameState).toBe(mockGameState);
            });

            it("should extract format from message.data.format", () => {
                const message = { data: { format: "sit-and-go" } };
                const result = extractGameDataFromMessage(message);
                expect(result.format).toBe("sit-and-go");
            });

            it("should extract variant from message.data.variant", () => {
                const message = { data: { variant: "texas-holdem" } };
                const result = extractGameDataFromMessage(message);
                expect(result.variant).toBe("texas-holdem");
            });

            it("should extract all fields from a complete Cosmos message", () => {
                const message = {
                    gameId: "0x123",
                    event: "state",
                    data: {
                        gameState: mockGameState,
                        format: "cash",
                        variant: "texas-holdem"
                    }
                };
                const result = extractGameDataFromMessage(message);
                expect(result.gameState).toBe(mockGameState);
                expect(result.format).toBe("cash");
                expect(result.variant).toBe("texas-holdem");
            });
        });

        describe("missing fields", () => {
            it("should return undefined when no data property exists", () => {
                const message = {};
                const result = extractGameDataFromMessage(message);
                expect(result.gameState).toBeUndefined();
                expect(result.format).toBeUndefined();
                expect(result.variant).toBeUndefined();
            });

            it("should return undefined for missing fields in data", () => {
                const message = { data: {} };
                const result = extractGameDataFromMessage(message);
                expect(result.gameState).toBeUndefined();
                expect(result.format).toBeUndefined();
                expect(result.variant).toBeUndefined();
            });

            it("should return partial data when only some fields are present", () => {
                const message = { data: { format: "cash" } };
                const result = extractGameDataFromMessage(message);
                expect(result.gameState).toBeUndefined();
                expect(result.format).toBe("cash");
                expect(result.variant).toBeUndefined();
            });
        });
    });

    describe("validateGameState", () => {
        // Complete GameOptionsDTO for testing valid scenarios
        const validGameOptions: GameOptionsDTO = {
            smallBlind: "50",
            bigBlind: "100",
            minBuyIn: "1000",
            maxBuyIn: "5000",
            minPlayers: 2,
            maxPlayers: 9,
            timeout: 60
        };

        describe("when all required fields are present", () => {
            it("should return valid: true with no missing fields", () => {
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, validGameOptions);
                expect(result.valid).toBe(true);
                expect(result.missingFields).toEqual([]);
                expect(result.message).toBe("");
            });

            it("should accept string values for format and variant", () => {
                const result = validateGameState("cash", "texas-holdem", validGameOptions);
                expect(result.valid).toBe(true);
                expect(result.missingFields).toEqual([]);
            });
        });

        describe("when format is missing", () => {
            it("should return invalid when format is undefined", () => {
                const result = validateGameState(undefined, GameVariant.TEXAS_HOLDEM, validGameOptions);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("format");
            });

            it("should return invalid when format is empty string", () => {
                const result = validateGameState("", GameVariant.TEXAS_HOLDEM, validGameOptions);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("format");
            });
        });

        describe("when variant is missing", () => {
            it("should return invalid when variant is undefined", () => {
                const result = validateGameState(GameFormat.CASH, undefined, validGameOptions);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("variant");
            });

            it("should return invalid when variant is empty string", () => {
                const result = validateGameState(GameFormat.CASH, "", validGameOptions);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("variant");
            });
        });

        describe("when gameOptions is missing", () => {
            it("should return invalid when gameOptions is null", () => {
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, null);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("gameOptions");
            });

            it("should return invalid when gameOptions is undefined", () => {
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, undefined);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("gameOptions");
            });
        });

        describe("when gameOptions fields are missing", () => {
            it("should return invalid when smallBlind is missing", () => {
                const options = { ...validGameOptions, smallBlind: undefined } as unknown as GameOptionsDTO;
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, options);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("gameOptions.smallBlind");
            });

            it("should return invalid when bigBlind is missing", () => {
                const options = { ...validGameOptions, bigBlind: undefined } as unknown as GameOptionsDTO;
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, options);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("gameOptions.bigBlind");
            });

            it("should return invalid when minBuyIn is missing", () => {
                const options = { ...validGameOptions, minBuyIn: undefined } as unknown as GameOptionsDTO;
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, options);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("gameOptions.minBuyIn");
            });

            it("should return invalid when maxBuyIn is missing", () => {
                const options = { ...validGameOptions, maxBuyIn: undefined } as unknown as GameOptionsDTO;
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, options);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("gameOptions.maxBuyIn");
            });

            it("should return invalid when minPlayers is missing", () => {
                const options = { ...validGameOptions, minPlayers: undefined } as unknown as GameOptionsDTO;
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, options);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("gameOptions.minPlayers");
            });

            it("should return invalid when maxPlayers is missing", () => {
                const options = { ...validGameOptions, maxPlayers: undefined } as unknown as GameOptionsDTO;
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, options);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("gameOptions.maxPlayers");
            });

            it("should return invalid when minPlayers is null", () => {
                const options = { ...validGameOptions, minPlayers: null } as unknown as GameOptionsDTO;
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, options);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("gameOptions.minPlayers");
            });

            it("should accept minPlayers and maxPlayers as 0", () => {
                const options = { ...validGameOptions, minPlayers: 0, maxPlayers: 0 };
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, options);
                expect(result.valid).toBe(true);
                expect(result.missingFields).not.toContain("gameOptions.minPlayers");
                expect(result.missingFields).not.toContain("gameOptions.maxPlayers");
            });
        });

        describe("when multiple fields are missing", () => {
            it("should return all missing fields", () => {
                const result = validateGameState(undefined, undefined, null);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("format");
                expect(result.missingFields).toContain("variant");
                expect(result.missingFields).toContain("gameOptions");
                expect(result.missingFields).toHaveLength(3);
            });

            it("should return all missing gameOptions fields", () => {
                const emptyOptions = {} as GameOptionsDTO;
                const result = validateGameState(GameFormat.CASH, GameVariant.TEXAS_HOLDEM, emptyOptions);
                expect(result.valid).toBe(false);
                expect(result.missingFields).toContain("gameOptions.smallBlind");
                expect(result.missingFields).toContain("gameOptions.bigBlind");
                expect(result.missingFields).toContain("gameOptions.minBuyIn");
                expect(result.missingFields).toContain("gameOptions.maxBuyIn");
                expect(result.missingFields).toContain("gameOptions.minPlayers");
                expect(result.missingFields).toContain("gameOptions.maxPlayers");
                expect(result.missingFields).toHaveLength(6);
            });

            it("should include descriptive error message", () => {
                const result = validateGameState(undefined, undefined, null);
                expect(result.message).toContain("Game data is incomplete");
                expect(result.message).toContain("format");
                expect(result.message).toContain("variant");
                expect(result.message).toContain("gameOptions");
            });
        });
    });

    describe("isTournamentFormat", () => {
        it("should return true for tournament format", () => {
            expect(isTournamentFormat(GameFormat.TOURNAMENT)).toBe(true);
            expect(isTournamentFormat("tournament")).toBe(true);
        });

        it("should return true for sit-and-go format", () => {
            expect(isTournamentFormat(GameFormat.SIT_AND_GO)).toBe(true);
            expect(isTournamentFormat("sit-and-go")).toBe(true);
        });

        it("should return false for cash format", () => {
            expect(isTournamentFormat(GameFormat.CASH)).toBe(false);
            expect(isTournamentFormat("cash")).toBe(false);
        });

        it("should return false for undefined/null", () => {
            expect(isTournamentFormat(undefined)).toBe(false);
            expect(isTournamentFormat(null as any)).toBe(false);
        });
    });

    describe("isCashFormat", () => {
        it("should return true for cash format", () => {
            expect(isCashFormat(GameFormat.CASH)).toBe(true);
            expect(isCashFormat("cash")).toBe(true);
        });

        it("should return false for tournament format", () => {
            expect(isCashFormat(GameFormat.TOURNAMENT)).toBe(false);
            expect(isCashFormat("tournament")).toBe(false);
        });

        it("should return false for sit-and-go format", () => {
            expect(isCashFormat(GameFormat.SIT_AND_GO)).toBe(false);
            expect(isCashFormat("sit-and-go")).toBe(false);
        });
    });

    describe("isSitAndGoFormat", () => {
        it("should return true for sit-and-go format", () => {
            expect(isSitAndGoFormat(GameFormat.SIT_AND_GO)).toBe(true);
            expect(isSitAndGoFormat("sit-and-go")).toBe(true);
        });

        it("should return false for cash format", () => {
            expect(isSitAndGoFormat(GameFormat.CASH)).toBe(false);
            expect(isSitAndGoFormat("cash")).toBe(false);
        });

        it("should return false for tournament format", () => {
            expect(isSitAndGoFormat(GameFormat.TOURNAMENT)).toBe(false);
            expect(isSitAndGoFormat("tournament")).toBe(false);
        });
    });

    describe("convertBlindsForBlockchain", () => {
        describe("cash games", () => {
            it("should convert dollar blinds to USDC micro-units", () => {
                // $0.50/$1.00 blinds -> 500000/1000000 micro-units
                const result = convertBlindsForBlockchain(GameFormat.CASH, 0.5, 1.0);
                expect(result.smallBlind).toBe(500000n);
                expect(result.bigBlind).toBe(1000000n);
            });

            it("should handle $1/$2 blinds", () => {
                const result = convertBlindsForBlockchain("cash", 1, 2);
                expect(result.smallBlind).toBe(1000000n);
                expect(result.bigBlind).toBe(2000000n);
            });

            it("should handle $0.25/$0.50 blinds", () => {
                const result = convertBlindsForBlockchain(GameFormat.CASH, 0.25, 0.50);
                expect(result.smallBlind).toBe(250000n);
                expect(result.bigBlind).toBe(500000n);
            });

            it("should handle higher stakes $5/$10 blinds", () => {
                const result = convertBlindsForBlockchain("cash", 5, 10);
                expect(result.smallBlind).toBe(5000000n);
                expect(result.bigBlind).toBe(10000000n);
            });
        });

        describe("sit-and-go games", () => {
            it("should use chip values directly without conversion", () => {
                // 25/50 chip blinds -> 25/50 (no conversion)
                const result = convertBlindsForBlockchain(GameFormat.SIT_AND_GO, 25, 50);
                expect(result.smallBlind).toBe(25n);
                expect(result.bigBlind).toBe(50n);
            });

            it("should handle larger chip blinds", () => {
                const result = convertBlindsForBlockchain("sit-and-go", 100, 200);
                expect(result.smallBlind).toBe(100n);
                expect(result.bigBlind).toBe(200n);
            });

            it("should handle very large chip blinds", () => {
                const result = convertBlindsForBlockchain(GameFormat.SIT_AND_GO, 5000, 10000);
                expect(result.smallBlind).toBe(5000n);
                expect(result.bigBlind).toBe(10000n);
            });
        });

        describe("tournament games", () => {
            it("should use chip values directly without conversion", () => {
                const result = convertBlindsForBlockchain(GameFormat.TOURNAMENT, 50, 100);
                expect(result.smallBlind).toBe(50n);
                expect(result.bigBlind).toBe(100n);
            });

            it("should handle string format", () => {
                const result = convertBlindsForBlockchain("tournament", 75, 150);
                expect(result.smallBlind).toBe(75n);
                expect(result.bigBlind).toBe(150n);
            });
        });

        describe("edge cases", () => {
            it("should floor decimal chip values for tournaments", () => {
                const result = convertBlindsForBlockchain(GameFormat.SIT_AND_GO, 25.7, 50.9);
                expect(result.smallBlind).toBe(25n);
                expect(result.bigBlind).toBe(50n);
            });

            it("should handle zero blinds", () => {
                const result = convertBlindsForBlockchain(GameFormat.CASH, 0, 0);
                expect(result.smallBlind).toBe(0n);
                expect(result.bigBlind).toBe(0n);
            });
        });
    });

    describe("convertAmountForBlockchain", () => {
        it("should convert cash amount to USDC microunits (×10^6)", () => {
            expect(convertAmountForBlockchain(GameFormat.CASH, 10)).toBe(10000000n);
            expect(convertAmountForBlockchain("cash", 0.5)).toBe(500000n);
        });

        it("should use raw chip value for SNG (no conversion)", () => {
            expect(convertAmountForBlockchain(GameFormat.SIT_AND_GO, 1000)).toBe(1000n);
            expect(convertAmountForBlockchain("sit-and-go", 1500)).toBe(1500n);
        });

        it("should use raw chip value for tournament (no conversion)", () => {
            expect(convertAmountForBlockchain(GameFormat.TOURNAMENT, 2000)).toBe(2000n);
        });
    });

    describe("getBlindsForDisplay", () => {
        describe("cash games", () => {
            it("should convert USDC micro-units to dollars for $0.50/$1.00 blinds", () => {
                const result = getBlindsForDisplay(GameFormat.CASH, "500000", "1000000");
                expect(result.smallBlind).toBe(0.5);
                expect(result.bigBlind).toBe(1);
                expect(result.stakeLabel).toBe("$0.50 / $1.00");
            });

            it("should handle $0.25/$0.50 blinds", () => {
                const result = getBlindsForDisplay("cash", "250000", "500000");
                expect(result.smallBlind).toBe(0.25);
                expect(result.bigBlind).toBe(0.5);
                expect(result.stakeLabel).toBe("$0.25 / $0.50");
            });

            it("should handle $1/$2 blinds", () => {
                const result = getBlindsForDisplay(GameFormat.CASH, "1000000", "2000000");
                expect(result.smallBlind).toBe(1);
                expect(result.bigBlind).toBe(2);
                expect(result.stakeLabel).toBe("$1.00 / $2.00");
            });

            it("should handle $5/$10 blinds", () => {
                const result = getBlindsForDisplay("cash", "5000000", "10000000");
                expect(result.smallBlind).toBe(5);
                expect(result.bigBlind).toBe(10);
                expect(result.stakeLabel).toBe("$5.00 / $10.00");
            });
        });

        describe("sit-and-go games", () => {
            it("should use chip values directly for 25/50 blinds", () => {
                const result = getBlindsForDisplay(GameFormat.SIT_AND_GO, "25", "50");
                expect(result.smallBlind).toBe(25);
                expect(result.bigBlind).toBe(50);
                expect(result.stakeLabel).toBe("25 / 50 chips");
            });

            it("should handle 100/200 blinds", () => {
                const result = getBlindsForDisplay("sit-and-go", "100", "200");
                expect(result.smallBlind).toBe(100);
                expect(result.bigBlind).toBe(200);
                expect(result.stakeLabel).toBe("100 / 200 chips");
            });

            it("should format large chip values with commas", () => {
                const result = getBlindsForDisplay(GameFormat.SIT_AND_GO, "1000", "2000");
                expect(result.smallBlind).toBe(1000);
                expect(result.bigBlind).toBe(2000);
                expect(result.stakeLabel).toBe("1,000 / 2,000 chips");
            });

            it("should handle very large chip blinds", () => {
                const result = getBlindsForDisplay("sit-and-go", "50000", "100000");
                expect(result.smallBlind).toBe(50000);
                expect(result.bigBlind).toBe(100000);
                expect(result.stakeLabel).toBe("50,000 / 100,000 chips");
            });
        });

        describe("tournament games", () => {
            it("should use chip values directly", () => {
                const result = getBlindsForDisplay(GameFormat.TOURNAMENT, "50", "100");
                expect(result.smallBlind).toBe(50);
                expect(result.bigBlind).toBe(100);
                expect(result.stakeLabel).toBe("50 / 100 chips");
            });

            it("should handle string format", () => {
                const result = getBlindsForDisplay("tournament", "75", "150");
                expect(result.smallBlind).toBe(75);
                expect(result.bigBlind).toBe(150);
                expect(result.stakeLabel).toBe("75 / 150 chips");
            });
        });

        describe("edge cases", () => {
            it("should handle zero blinds for cash", () => {
                const result = getBlindsForDisplay(GameFormat.CASH, "0", "0");
                expect(result.smallBlind).toBe(0);
                expect(result.bigBlind).toBe(0);
                expect(result.stakeLabel).toBe("$0.00 / $0.00");
            });

            it("should handle zero blinds for tournaments", () => {
                const result = getBlindsForDisplay(GameFormat.SIT_AND_GO, "0", "0");
                expect(result.smallBlind).toBe(0);
                expect(result.bigBlind).toBe(0);
                expect(result.stakeLabel).toBe("0 / 0 chips");
            });
        });

        describe("undefined inputs (React lifecycle)", () => {
            it("should return zeroed DisplayBlinds when smallBlind is undefined", () => {
                const result = getBlindsForDisplay(GameFormat.CASH, undefined, "1000000");
                expect(result.smallBlind).toBe(0);
                expect(result.bigBlind).toBe(0);
                expect(result.stakeLabel).toBe("");
            });

            it("should return zeroed DisplayBlinds when bigBlind is undefined", () => {
                const result = getBlindsForDisplay(GameFormat.SIT_AND_GO, "25", undefined);
                expect(result.smallBlind).toBe(0);
                expect(result.bigBlind).toBe(0);
                expect(result.stakeLabel).toBe("");
            });

            it("should return zeroed DisplayBlinds when both are undefined", () => {
                const result = getBlindsForDisplay(GameFormat.CASH, undefined, undefined);
                expect(result.smallBlind).toBe(0);
                expect(result.bigBlind).toBe(0);
                expect(result.stakeLabel).toBe("");
            });

            it("should return zeroed DisplayBlinds for tournament format with undefined", () => {
                const result = getBlindsForDisplay(GameFormat.TOURNAMENT, undefined, undefined);
                expect(result.smallBlind).toBe(0);
                expect(result.bigBlind).toBe(0);
                expect(result.stakeLabel).toBe("");
            });
        });
    });

    describe("getGameTypeMnemonic", () => {
        it("should return 'Heads Up' for 2 players", () => {
            expect(getGameTypeMnemonic(2)).toBe("Heads Up");
        });

        it("should return '6-Max' for 6 players", () => {
            expect(getGameTypeMnemonic(6)).toBe("6-Max");
        });

        it("should return 'Full Ring' for 9 players", () => {
            expect(getGameTypeMnemonic(9)).toBe("Full Ring");
        });

        it("should return '{n} Players' for other counts", () => {
            expect(getGameTypeMnemonic(3)).toBe("3 Players");
            expect(getGameTypeMnemonic(4)).toBe("4 Players");
            expect(getGameTypeMnemonic(8)).toBe("8 Players");
        });

        it("should return empty string for undefined", () => {
            expect(getGameTypeMnemonic(undefined)).toBe("");
        });
    });
});
