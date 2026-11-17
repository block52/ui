import { validateGameOptions } from "./gameOptionsValidation";
import { GameOptionsDTO } from "@block52/poker-vm-sdk";

describe("validateGameOptions", () => {
    // Mock console.error to avoid test output noise
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe("Valid game options", () => {
        it("should return valid result when all fields are present", () => {
            // Complete GameOptionsDTO for testing valid scenarios
            // Note: owner was removed from GameOptionsDTO per Commandment 3 (use root creator)
            const options: GameOptionsDTO = {
                smallBlind: "100",
                bigBlind: "200",
                timeout: 30,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2,
                rake: { rakeFreeThreshold: "0", rakePercentage: 5, rakeCap: "500" }
            };

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(true);
            expect(result.hasCriticalFields).toBe(true);
            expect(result.missingFields).toEqual([]);
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it("should return valid result when only critical fields are present", () => {
            // Partial object for testing edge case
            const options = {
                smallBlind: "100",
                bigBlind: "200"
            } as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(true);
            expect(result.hasCriticalFields).toBe(true);
            expect(result.missingFields).toEqual(["timeout", "minBuyIn", "maxBuyIn", "maxPlayers", "minPlayers"]);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "⚠️ Missing game options fields from server:",
                ["timeout", "minBuyIn", "maxBuyIn", "maxPlayers", "minPlayers"]
            );
        });

        it("should return valid result when timeout is 0", () => {
            const options: GameOptionsDTO = {
                smallBlind: "100",
                bigBlind: "200",
                timeout: 0,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            };

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(true);
            expect(result.hasCriticalFields).toBe(true);
            expect(result.missingFields).toEqual([]);
        });
    });

    describe("Invalid game options - null/undefined", () => {
        it("should return invalid result when options is null", () => {
            const result = validateGameOptions(null);

            expect(result.isValid).toBe(false);
            expect(result.hasCriticalFields).toBe(false);
            expect(result.missingFields).toEqual(["all fields (options is null/undefined)"]);
        });

        it("should return invalid result when options is undefined", () => {
            const result = validateGameOptions(undefined);

            expect(result.isValid).toBe(false);
            expect(result.hasCriticalFields).toBe(false);
            expect(result.missingFields).toEqual(["all fields (options is null/undefined)"]);
        });
    });

    describe("Invalid game options - missing critical fields", () => {
        it("should return invalid result when smallBlind is missing", () => {
            // Partial object for testing validation of missing fields
            const options = {
                bigBlind: "200",
                timeout: 30,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            } as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(false);
            expect(result.hasCriticalFields).toBe(false);
            expect(result.missingFields).toContain("smallBlind");
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "⚠️ Cannot display game options: missing critical fields (smallBlind or bigBlind)"
            );
        });

        it("should return invalid result when bigBlind is missing", () => {
            // Partial object for testing validation of missing fields
            const options = {
                smallBlind: "100",
                timeout: 30,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            } as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(false);
            expect(result.hasCriticalFields).toBe(false);
            expect(result.missingFields).toContain("bigBlind");
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "⚠️ Cannot display game options: missing critical fields (smallBlind or bigBlind)"
            );
        });

        it("should return invalid result when both critical fields are missing", () => {
            // Partial object for testing validation of missing fields
            const options = {
                timeout: 30,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            } as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(false);
            expect(result.hasCriticalFields).toBe(false);
            expect(result.missingFields).toContain("smallBlind");
            expect(result.missingFields).toContain("bigBlind");
        });

        it("should return invalid result when smallBlind is empty string", () => {
            const options: GameOptionsDTO = {
                smallBlind: "",
                bigBlind: "200",
                timeout: 30,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            };

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(false);
            expect(result.hasCriticalFields).toBe(false);
            expect(result.missingFields).toContain("smallBlind");
        });
    });

    describe("Invalid game options - missing non-critical fields", () => {
        it("should detect missing timeout field", () => {
            // Partial object for testing validation of missing fields
            const options = {
                smallBlind: "100",
                bigBlind: "200",
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            } as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(true); // Still valid because critical fields present
            expect(result.hasCriticalFields).toBe(true);
            expect(result.missingFields).toContain("timeout");
        });

        it("should detect missing minBuyIn field", () => {
            // Partial object for testing validation of missing fields
            const options = {
                smallBlind: "100",
                bigBlind: "200",
                timeout: 30,
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            } as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(true);
            expect(result.missingFields).toContain("minBuyIn");
        });

        it("should detect missing maxBuyIn field", () => {
            // Partial object for testing validation of missing fields
            const options = {
                smallBlind: "100",
                bigBlind: "200",
                timeout: 30,
                minBuyIn: "10000",
                maxPlayers: 9,
                minPlayers: 2
            } as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(true);
            expect(result.missingFields).toContain("maxBuyIn");
        });

        it("should detect missing maxPlayers field", () => {
            // Partial object for testing validation of missing fields
            const options = {
                smallBlind: "100",
                bigBlind: "200",
                timeout: 30,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                minPlayers: 2
            } as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(true);
            expect(result.missingFields).toContain("maxPlayers");
        });

        it("should detect missing minPlayers field", () => {
            // Partial object for testing validation of missing fields
            const options = {
                smallBlind: "100",
                bigBlind: "200",
                timeout: 30,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9
            } as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(true);
            expect(result.missingFields).toContain("minPlayers");
        });

        it("should detect multiple missing non-critical fields", () => {
            // Partial object for testing validation of missing fields
            const options = {
                smallBlind: "100",
                bigBlind: "200"
            } as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(true);
            expect(result.missingFields).toEqual([
                "timeout",
                "minBuyIn",
                "maxBuyIn",
                "maxPlayers",
                "minPlayers"
            ]);
        });
    });

    describe("Edge cases", () => {
        it("should treat timeout as missing when null", () => {
            const options = {
                smallBlind: "100",
                bigBlind: "200",
                timeout: null as any,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            } as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.missingFields).toContain("timeout");
        });

        it("should treat timeout as missing when undefined", () => {
            // Partial object with undefined field for testing validation
            const options = {
                smallBlind: "100",
                bigBlind: "200",
                timeout: undefined,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            } as unknown as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.missingFields).toContain("timeout");
        });

        it("should accept timeout value of 0", () => {
            const options: GameOptionsDTO = {
                smallBlind: "100",
                bigBlind: "200",
                timeout: 0,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            };

            const result = validateGameOptions(options);

            expect(result.missingFields).not.toContain("timeout");
        });

        it("should handle empty object", () => {
            // Empty object for testing validation of missing fields
            const options = {} as GameOptionsDTO;

            const result = validateGameOptions(options);

            expect(result.isValid).toBe(false);
            expect(result.hasCriticalFields).toBe(false);
            expect(result.missingFields).toEqual([
                "smallBlind",
                "bigBlind",
                "timeout",
                "minBuyIn",
                "maxBuyIn",
                "maxPlayers",
                "minPlayers"
            ]);
        });
    });

    describe("Console logging", () => {
        it("should log warning when non-critical fields are missing", () => {
            // Partial object for testing console logging
            const options = {
                smallBlind: "100",
                bigBlind: "200"
            } as GameOptionsDTO;

            validateGameOptions(options);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "⚠️ Missing game options fields from server:",
                ["timeout", "minBuyIn", "maxBuyIn", "maxPlayers", "minPlayers"]
            );
        });

        it("should log error when critical fields are missing", () => {
            // Partial object for testing console logging
            const options = {
                timeout: 30,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            } as GameOptionsDTO;

            validateGameOptions(options);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "⚠️ Cannot display game options: missing critical fields (smallBlind or bigBlind)"
            );
        });

        it("should not log when all fields are present", () => {
            const options: GameOptionsDTO = {
                smallBlind: "100",
                bigBlind: "200",
                timeout: 30,
                minBuyIn: "10000",
                maxBuyIn: "100000",
                maxPlayers: 9,
                minPlayers: 2
            };

            validateGameOptions(options);

            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });
});
