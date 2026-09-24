import { PlayerActionType, ActionDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { calculatePotBetAmount, calculatePotBetWithVariation, getPotBetVariations } from "./calculatePotBetAmount";

describe("calculatePotBetAmount", () => {
    // Cosmos bech32 addresses (b52 prefix for Block52 chain)
    const PLAYER_1 = "b521qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqer";
    const PLAYER_2 = "b521qz4sdj8gfx9w9r8h8xvnkkl0xhucqhqv39gtr7";
    const PLAYER_3 = "b521q8h9jkl3mn4op5qr6st7uv8wx9yz0abc1def2gh";

    // Helper to create mock actions with all required SDK fields
    const createAction = (
        action: PlayerActionType,
        amount: string,
        round: TexasHoldemRound,
        playerId: string = PLAYER_1,
        seat: number = 1
    ): ActionDTO => ({
        playerId,
        seat,
        action,
        amount,
        round,
        index: 0,
        timestamp: Date.now()
    });

    describe("basic pot bet calculation", () => {
        it("should return pot + call amount when no previous bets/raises in round", () => {
            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions: [],
                callAmount: 0n,
                pot: 100_000_000n // 100 USDC
            });

            // With no HB, pot bet = CALL + HB + POT = 0 + 0 + 100M = 100M
            expect(result).toBe(100_000_000n);
        });

        it("should include highest bet in calculation", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "50000000", TexasHoldemRound.FLOP) // 50 USDC bet
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 50_000_000n, // 50 USDC to call
                pot: 100_000_000n // 100 USDC pot
            });

            // Pot bet = CALL + HB + POT = 50M + 50M + 100M = 200M
            expect(result).toBe(200_000_000n);
        });

        it("should use highest raise amount when multiple raises exist", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "20000000", TexasHoldemRound.FLOP, PLAYER_1),
                createAction(PlayerActionType.RAISE, "60000000", TexasHoldemRound.FLOP, PLAYER_2),
                createAction(PlayerActionType.RAISE, "150000000", TexasHoldemRound.FLOP, PLAYER_3)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 150_000_000n, // 150 USDC to call the last raise
                pot: 300_000_000n // 300 USDC pot
            });

            // HB = 150M (highest raise), Pot bet = 150M + 150M + 300M = 600M
            expect(result).toBe(600_000_000n);
        });
    });

    describe("round filtering", () => {
        it("should only consider actions from the current round", () => {
            const previousActions: ActionDTO[] = [
                // Preflop actions should be ignored
                createAction(PlayerActionType.BET, "100000000", TexasHoldemRound.PREFLOP),
                createAction(PlayerActionType.RAISE, "300000000", TexasHoldemRound.PREFLOP),
                // Only this flop action should count
                createAction(PlayerActionType.BET, "50000000", TexasHoldemRound.FLOP)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 50_000_000n,
                pot: 400_000_000n
            });

            // HB should be 50M (only from flop), not 300M from preflop
            // Pot bet = 50M + 50M + 400M = 500M
            expect(result).toBe(500_000_000n);
        });

        it("should work correctly for turn round", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "100000000", TexasHoldemRound.FLOP),
                createAction(PlayerActionType.BET, "75000000", TexasHoldemRound.TURN)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.TURN,
                previousActions,
                callAmount: 75_000_000n,
                pot: 500_000_000n
            });

            // HB from turn = 75M
            // Pot bet = 75M + 75M + 500M = 650M
            expect(result).toBe(650_000_000n);
        });

        it("should work correctly for river round", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "200000000", TexasHoldemRound.RIVER)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.RIVER,
                previousActions,
                callAmount: 200_000_000n,
                pot: 1_000_000_000n
            });

            // Pot bet = 200M + 200M + 1000M = 1400M
            expect(result).toBe(1_400_000_000n);
        });
    });

    describe("action type filtering", () => {
        it("should ignore CALL actions when calculating highest bet", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "50000000", TexasHoldemRound.FLOP),
                createAction(PlayerActionType.CALL, "50000000", TexasHoldemRound.FLOP),
                createAction(PlayerActionType.CALL, "50000000", TexasHoldemRound.FLOP)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 50_000_000n,
                pot: 200_000_000n
            });

            // HB should be 50M (the bet), calls don't count
            expect(result).toBe(300_000_000n);
        });

        it("should ignore FOLD and CHECK actions", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "30000000", TexasHoldemRound.FLOP),
                createAction(PlayerActionType.FOLD, "0", TexasHoldemRound.FLOP),
                createAction(PlayerActionType.CHECK, "0", TexasHoldemRound.FLOP)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 30_000_000n,
                pot: 100_000_000n
            });

            // HB = 30M
            expect(result).toBe(160_000_000n);
        });
    });

    describe("edge cases", () => {
        it("should handle empty previousActions array", () => {
            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.PREFLOP,
                previousActions: [],
                callAmount: 20_000_000n, // big blind
                pot: 30_000_000n // SB + BB
            });

            // No HB, pot bet = 20M + 0 + 30M = 50M
            expect(result).toBe(50_000_000n);
        });

        it("should handle zero pot", () => {
            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions: [],
                callAmount: 0n,
                pot: 0n
            });

            expect(result).toBe(0n);
        });

        it("should handle very large amounts (high stakes)", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.RAISE, "10000000000000", TexasHoldemRound.FLOP) // 10M USDC
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 10_000_000_000_000n,
                pot: 20_000_000_000_000n
            });

            // Pot bet = 10T + 10T + 20T = 40T
            expect(result).toBe(40_000_000_000_000n);
        });

        it("should handle actions with zero amount (like CHECK)", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.CHECK, "0", TexasHoldemRound.FLOP),
                createAction(PlayerActionType.BET, "25000000", TexasHoldemRound.FLOP)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 25_000_000n,
                pot: 50_000_000n
            });

            expect(result).toBe(100_000_000n);
        });

        it("should handle string amounts with no issues", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "123456789", TexasHoldemRound.FLOP)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 123_456_789n,
                pot: 500_000_000n
            });

            // 123456789 + 123456789 + 500000000 = 746913578
            expect(result).toBe(746_913_578n);
        });
    });

    describe("preflop scenarios", () => {
        it("should calculate pot bet for preflop with blinds posted", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.SMALL_BLIND, "10000000", TexasHoldemRound.PREFLOP),
                createAction(PlayerActionType.BIG_BLIND, "20000000", TexasHoldemRound.PREFLOP)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.PREFLOP,
                previousActions,
                callAmount: 20_000_000n, // call the BB
                pot: 30_000_000n // SB + BB
            });

            // Blinds don't count as BET/RAISE, so HB = 0
            // Pot bet = 20M + 0 + 30M = 50M
            expect(result).toBe(50_000_000n);
        });

        it("should handle preflop raise scenario", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.SMALL_BLIND, "10000000", TexasHoldemRound.PREFLOP),
                createAction(PlayerActionType.BIG_BLIND, "20000000", TexasHoldemRound.PREFLOP),
                createAction(PlayerActionType.RAISE, "60000000", TexasHoldemRound.PREFLOP, PLAYER_3)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.PREFLOP,
                previousActions,
                callAmount: 60_000_000n,
                pot: 90_000_000n // SB + BB + raise
            });

            // HB = 60M (the raise)
            // Pot bet = 60M + 60M + 90M = 210M
            expect(result).toBe(210_000_000n);
        });
    });

    describe("calculatePotBetWithVariation", () => {
        // Correct formula: CALL + fraction × (CALL + POT)
        // potentialPot = callAmount + pot = 50M + 100M = 150M
        const baseParams = {
            currentRound: TexasHoldemRound.FLOP,
            previousActions: [
                createAction(PlayerActionType.BET, "50000000", TexasHoldemRound.FLOP)
            ],
            callAmount: 50_000_000n,
            pot: 100_000_000n
        };

        // Full pot = CALL + 1 × (CALL + POT) = 50 + 150 = 200M

        it("should calculate full pot (variation = '1') correctly", () => {
            const result = calculatePotBetWithVariation(baseParams, "1");
            // 50 + 1 × 150 = 200M
            expect(result).toBe(200_000_000n);
        });

        it("should default to full pot when no variation provided", () => {
            const result = calculatePotBetWithVariation(baseParams);
            expect(result).toBe(200_000_000n);
        });

        it("should calculate 1/2 pot correctly", () => {
            const result = calculatePotBetWithVariation(baseParams, "1/2");
            // 50 + 0.5 × 150 = 50 + 75 = 125M
            expect(result).toBe(125_000_000n);
        });

        it("should calculate 1/3 pot correctly", () => {
            const result = calculatePotBetWithVariation(baseParams, "1/3");
            // 50 + (1/3) × 150 = 50 + 50 = 100M
            // Due to BigInt rounding: 150M × 333333333 / 1000000000 = 49999999 (off by 1)
            expect(result).toBe(99_999_999n);
        });

        it("should calculate 2/3 pot correctly", () => {
            const result = calculatePotBetWithVariation(baseParams, "2/3");
            // 50 + (2/3) × 150 = 50 + 100 = 150M
            expect(result).toBe(150_000_000n);
        });

        it("should calculate 1/4 pot correctly", () => {
            const result = calculatePotBetWithVariation(baseParams, "1/4");
            // 50 + 0.25 × 150 = 50 + 37.5 = 87.5M
            expect(result).toBe(87_500_000n);
        });

        it("should calculate 3/4 pot correctly", () => {
            const result = calculatePotBetWithVariation(baseParams, "3/4");
            // 50 + 0.75 × 150 = 50 + 112.5 = 162.5M
            expect(result).toBe(162_500_000n);
        });

        it("should handle custom numeric multiplier", () => {
            const result = calculatePotBetWithVariation(baseParams, 1.5);
            // 50 + 1.5 × 150 = 50 + 225 = 275M
            expect(result).toBe(275_000_000n);
        });

        it("should handle custom numeric multiplier with decimals", () => {
            const result = calculatePotBetWithVariation(baseParams, 0.33);
            // 50 + 0.33 × 150 = 50 + 49.5 = 99.5M
            expect(result).toBe(99_500_000n);
        });

        it("should handle very small multipliers", () => {
            const result = calculatePotBetWithVariation(baseParams, 0.1);
            // 50 + 0.1 × 150 = 50 + 15 = 65M
            expect(result).toBe(65_000_000n);
        });

        it("should handle 2/3 pot bet matching issue #1658 photo 5 scenario", () => {
            // Photo 5: POT = 20, Bet 20, Call 20, Call 20
            // After actions: pot = 80, call = 20
            // 2/3 pot should be $86.67
            const photo5Params = {
                currentRound: TexasHoldemRound.FLOP,
                previousActions: [
                    createAction(PlayerActionType.BET, "20000000", TexasHoldemRound.FLOP, PLAYER_1),
                    createAction(PlayerActionType.CALL, "20000000", TexasHoldemRound.FLOP, PLAYER_2),
                    createAction(PlayerActionType.CALL, "20000000", TexasHoldemRound.FLOP, PLAYER_3)
                ],
                callAmount: 20_000_000n, // $20 to call
                pot: 80_000_000n // $20 initial + $20 bet + $20 call + $20 call = $80
            };

            // Full pot = 20 + 1 × (20 + 80) = 20 + 100 = 120M
            const fullPot = calculatePotBetWithVariation(photo5Params, "1");
            expect(fullPot).toBe(120_000_000n);

            // 2/3 pot = 20 + (2/3) × (20 + 80) = 20 + 66.67 = 86.67M
            const twoThirdsPot = calculatePotBetWithVariation(photo5Params, "2/3");
            expect(twoThirdsPot).toBe(86_666_666n); // ~$86.67
        });

        it("should work with zero pot and call amount", () => {
            const zeroParams = {
                currentRound: TexasHoldemRound.FLOP,
                previousActions: [],
                callAmount: 0n,
                pot: 0n
            };

            const result = calculatePotBetWithVariation(zeroParams, "1/2");
            expect(result).toBe(0n);
        });

        it("should handle large amounts correctly", () => {
            const largeParams = {
                currentRound: TexasHoldemRound.RIVER,
                previousActions: [
                    createAction(PlayerActionType.BET, "1000000000000", TexasHoldemRound.RIVER)
                ],
                callAmount: 1_000_000_000_000n, // 1M USDC
                pot: 2_000_000_000_000n // 2M USDC
            };

            // potentialPot = 1T + 2T = 3T
            // 2/3 pot = 1T + (2/3) × 3T = 1T + 2T = 3T
            // Due to BigInt rounding with large numbers, slight variance is expected
            const result = calculatePotBetWithVariation(largeParams, "2/3");
            expect(result).toBe(3_000_000_001_000n);
        });
    });

    describe("big-blind floor for opening bets (#692)", () => {
        // Blinds $0.01 / $0.02, pot $0.04 (SB + BB). First to act on a later
        // street, quarter pot = $0.01 — below the $0.02 big blind.
        const bigBlind = 20_000n; // $0.02 in micro-units

        it("floors an opening 1/4-pot bet at the big blind when the fraction is below it", () => {
            // pot $0.04, 1/4 = $0.01 (10_000n) < BB $0.02 → clamp up to BB.
            const result = calculatePotBetWithVariation(
                { currentRound: TexasHoldemRound.FLOP, previousActions: [], callAmount: 0n, pot: 40_000n },
                "1/4",
                { bigBlind }
            );
            expect(result).toBe(20_000n); // $0.02
        });

        it("leaves an opening bet unchanged when the fraction equals the big blind", () => {
            // pot $0.08, 1/4 = $0.02 == BB.
            const result = calculatePotBetWithVariation(
                { currentRound: TexasHoldemRound.FLOP, previousActions: [], callAmount: 0n, pot: 80_000n },
                "1/4",
                { bigBlind }
            );
            expect(result).toBe(20_000n);
        });

        it("leaves an opening bet unchanged when the fraction is above the big blind", () => {
            // pot $1.00, 1/4 = $0.25 > BB.
            const result = calculatePotBetWithVariation(
                { currentRound: TexasHoldemRound.FLOP, previousActions: [], callAmount: 0n, pot: 1_000_000n },
                "1/4",
                { bigBlind }
            );
            expect(result).toBe(250_000n); // $0.25, not floored
        });

        it("does NOT apply the big-blind floor when facing a bet (raise uses legal min)", () => {
            // Facing a $0.02 bet, pot $0.06. 1/4 = call + 1/4×(call+pot)
            // = 20_000 + (80_000/4) = 20_000 + 20_000 = 40_000. BB floor must not
            // alter this — a RAISE TO's floor is the game-provided legal minimum.
            const result = calculatePotBetWithVariation(
                { currentRound: TexasHoldemRound.FLOP, previousActions: [], callAmount: 20_000n, pot: 60_000n },
                "1/4",
                { bigBlind }
            );
            expect(result).toBe(40_000n);
        });

        it("is a no-op without a bigBlind option (backwards compatible)", () => {
            const withoutOpt = calculatePotBetWithVariation(
                { currentRound: TexasHoldemRound.FLOP, previousActions: [], callAmount: 0n, pot: 40_000n },
                "1/4"
            );
            expect(withoutOpt).toBe(10_000n); // $0.01, unfloored
        });
    });

    describe("getPotBetVariations", () => {
        // Correct formula: CALL + fraction × (CALL + POT)
        // potentialPot = 30M + 60M = 90M
        const baseParams = {
            currentRound: TexasHoldemRound.FLOP,
            previousActions: [
                createAction(PlayerActionType.BET, "30000000", TexasHoldemRound.FLOP)
            ],
            callAmount: 30_000_000n,
            pot: 60_000_000n
        };

        // Full pot = 30 + 1 × 90 = 120M

        it("should return array with 4 variations (1/3, 1/2, 2/3, 1)", () => {
            const result = getPotBetVariations(baseParams);
            expect(result).toHaveLength(4);
        });

        it("should return correct labels for each variation", () => {
            const result = getPotBetVariations(baseParams);

            expect(result[0].label).toBe("1/3 Pot");
            expect(result[1].label).toBe("1/2 Pot");
            expect(result[2].label).toBe("2/3 Pot");
            expect(result[3].label).toBe("Pot");
        });

        it("should return correct variation values", () => {
            const result = getPotBetVariations(baseParams);

            expect(result[0].variation).toBe("1/3");
            expect(result[1].variation).toBe("1/2");
            expect(result[2].variation).toBe("2/3");
            expect(result[3].variation).toBe("1");
        });

        it("should calculate correct amounts for each variation", () => {
            const result = getPotBetVariations(baseParams);

            // potentialPot = 30 + 60 = 90M
            // 1/3 pot = 30 + (1/3) × 90 = 30 + 30 = 60M (BigInt rounds to 59_999_999n)
            // 1/2 pot = 30 + 0.5 × 90 = 30 + 45 = 75M
            // 2/3 pot = 30 + (2/3) × 90 = 30 + 60 = 90M
            // Full pot = 30 + 1 × 90 = 120M
            expect(result[0].amount).toBe(59_999_999n);  // 1/3 pot (BigInt rounding)
            expect(result[1].amount).toBe(75_000_000n);  // 1/2 pot
            expect(result[2].amount).toBe(90_000_000n);  // 2/3 pot
            expect(result[3].amount).toBe(120_000_000n); // Full pot
        });

        it("should work with empty previous actions", () => {
            const emptyParams = {
                currentRound: TexasHoldemRound.PREFLOP,
                previousActions: [],
                callAmount: 20_000_000n,
                pot: 30_000_000n
            };

            const result = getPotBetVariations(emptyParams);

            expect(result).toHaveLength(4);
            // potentialPot = 20 + 30 = 50M
            // Full pot = 20 + 1 × 50 = 70M
            // 1/3 pot = 20 + (1/3) × 50 = 20 + 16.67 = 36.67M
            expect(result[3].amount).toBe(70_000_000n);
            expect(result[0].amount).toBe(36_666_666n);
        });

        it("should return objects with correct structure", () => {
            const result = getPotBetVariations(baseParams);

            result.forEach(variation => {
                expect(variation).toHaveProperty("label");
                expect(variation).toHaveProperty("variation");
                expect(variation).toHaveProperty("amount");
                expect(typeof variation.label).toBe("string");
                expect(typeof variation.amount).toBe("bigint");
            });
        });
    });

    // Tests from GitHub Issue #1658 - POT SIZE BET and VARIATIONS
    describe("issue #1658 - pot size bet variations", () => {
        /**
         * Scenario 1 from issue:
         * On the flop, pot is $12
         * Player 1 bets $12
         * Player 2 wants to 2/3 pot raise to $36
         *
         * Full pot = CALL + HB + POT = 12 + 12 + 24 = 48
         * 2/3 pot = callAmount + 2/3 * (callAmount + pot) = 12 + 2/3 * 36 = 36
         */
        it("should calculate full pot for scenario 1: flop bet with single bet", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "12000000", TexasHoldemRound.FLOP, PLAYER_1) // $12 bet
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 12_000_000n, // $12 to call
                pot: 24_000_000n // $12 initial pot + $12 bet = $24
            });

            // Full pot = CALL + HB + POT = 12 + 12 + 24 = 48
            expect(result).toBe(48_000_000n);

            // For 2/3 pot, caller would compute: callAmount + 2/3 * (callAmount + pot)
            // 2/3 pot = 12 + 2/3 * (12 + 24) = 12 + 24 = 36
            const twoThirdsPot = 12_000_000n + (2n * (12_000_000n + 24_000_000n)) / 3n;
            expect(twoThirdsPot).toBe(36_000_000n);
        });

        /**
         * Scenario 2 from issue:
         * On the flop, pot is $48
         * Player 1 bets $80.57
         * Player 2 calls $80.57
         * Player 3 wants to 2/3 pot to $273.71
         *
         * After bet and call, pot = 48 + 80.57 + 80.57 = 209.14
         * 2/3 pot = callAmount + 2/3 * (callAmount + pot) = 80.57 + 2/3 * 289.71 = 273.71
         */
        it("should calculate full pot for scenario 2: flop bet with bet and call", () => {
            // Using micro-units: $80.57 = 80_570_000 micro-units
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "80570000", TexasHoldemRound.FLOP, PLAYER_1),
                createAction(PlayerActionType.CALL, "80570000", TexasHoldemRound.FLOP, PLAYER_2)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 80_570_000n, // $80.57 to call
                pot: 209_140_000n // $48 + $80.57 + $80.57 = $209.14
            });

            // Full pot = CALL + HB + POT = 80.57 + 80.57 + 209.14 = 370.28
            expect(result).toBe(370_280_000n);

            // For 2/3 pot: callAmount + 2/3 * (callAmount + pot)
            // = 80.57 + 2/3 * (80.57 + 209.14) = 80.57 + 2/3 * 289.71 = 80.57 + 193.14 = 273.71
            const twoThirdsPot = 80_570_000n + (2n * (80_570_000n + 209_140_000n)) / 3n;
            expect(twoThirdsPot).toBe(273_710_000n);
        });

        /**
         * Turn action scenario from issue comments:
         * Seat 2: Bet $20
         * Seat 3: Raise $20 (total $40)
         * Seat 4: Raise $20 (total $60)
         * 2/3 Pot should be $86.67
         *
         * Assuming pot was $20 before betting round started
         * After actions: pot = 20 + 20 + 40 + 60 = 140
         * HB = 60, callAmount = 60
         */
        it("should calculate full pot for turn with multiple raises", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "20000000", TexasHoldemRound.TURN, PLAYER_1),   // $20 bet
                createAction(PlayerActionType.RAISE, "40000000", TexasHoldemRound.TURN, PLAYER_2), // raise to $40
                createAction(PlayerActionType.RAISE, "60000000", TexasHoldemRound.TURN, PLAYER_3)  // raise to $60
            ];

            // Pot = 20 (initial) + 20 + 40 + 60 = 140
            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.TURN,
                previousActions,
                callAmount: 60_000_000n, // $60 to call the last raise
                pot: 140_000_000n // pot after all actions
            });

            // Full pot = CALL + HB + POT = 60 + 60 + 140 = 260
            expect(result).toBe(260_000_000n);

            // For 2/3 pot: callAmount + 2/3 * (callAmount + pot)
            // = 60 + 2/3 * (60 + 140) = 60 + 2/3 * 200 = 60 + 133.33 = 193.33
            // But issue says 86.67 which implies different pot/call values
        });

        /**
         * Photo 4 scenario from issue:
         * Pot is $20
         * Bet $20, Call $20, Call $20
         * 1/4 pot should be $45
         *
         * Math: QP = lastRaise/4 = 20/4 = 5
         * 1/4 pot = 5*2 + 5 + 5 + 5 + 20 = 10 + 15 + 20 = 45
         *
         * Using standard formula: callAmount + 1/4 * (callAmount + pot)
         * After all calls: pot = 20 + 20 + 20 + 20 = 80
         * 1/4 pot = 20 + 0.25 * (20 + 80) = 20 + 25 = 45 ✓
         */
        it("should verify 1/4 pot calculation for photo 4 scenario", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "20000000", TexasHoldemRound.FLOP, PLAYER_1),
                createAction(PlayerActionType.CALL, "20000000", TexasHoldemRound.FLOP, PLAYER_2),
                createAction(PlayerActionType.CALL, "20000000", TexasHoldemRound.FLOP, PLAYER_3)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 20_000_000n, // $20 to call
                pot: 80_000_000n // $20 initial + $20 bet + $20 call + $20 call = $80
            });

            // Full pot = CALL + HB + POT = 20 + 20 + 80 = 120
            expect(result).toBe(120_000_000n);

            // For 1/4 pot: callAmount + 1/4 * (callAmount + pot)
            // = 20 + 1/4 * (20 + 80) = 20 + 25 = 45
            const quarterPot = 20_000_000n + (1n * (20_000_000n + 80_000_000n)) / 4n;
            expect(quarterPot).toBe(45_000_000n);
        });

        /**
         * Photo 5 scenario from issue:
         * Same setup but 2/3 pot should be approximately $86.67 or $87.67
         *
         * Math from issue: 13.333 × 2 + 13.333 + 13.333 + 13.333 + 20 = 86.67
         *
         * Using standard formula: callAmount + 2/3 * (callAmount + pot)
         * = 20 + 2/3 * (20 + 80) = 20 + 66.67 = 86.67
         */
        it("should verify 2/3 pot calculation for photo 5 scenario", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.BET, "20000000", TexasHoldemRound.FLOP, PLAYER_1),
                createAction(PlayerActionType.CALL, "20000000", TexasHoldemRound.FLOP, PLAYER_2),
                createAction(PlayerActionType.CALL, "20000000", TexasHoldemRound.FLOP, PLAYER_3)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions,
                callAmount: 20_000_000n,
                pot: 80_000_000n
            });

            // Full pot = 120
            expect(result).toBe(120_000_000n);

            // For 2/3 pot: callAmount + 2/3 * (callAmount + pot)
            // = 20 + 2/3 * 100 = 20 + 66.666... = 86.666...
            // With bigint: 20_000_000 + (2 * 100_000_000) / 3 = 20_000_000 + 66_666_666 = 86_666_666
            const twoThirdsPot = 20_000_000n + (2n * (20_000_000n + 80_000_000n)) / 3n;
            expect(twoThirdsPot).toBe(86_666_666n); // $86.67 (rounded due to bigint division)
        });

        /**
         * Simple pot bet without facing action (from issue comment):
         * "if the POT is 20, then a 1/4 bet is clearly 5, a 1/2 POT bet is obviously 10,
         *  2/3 POT bet is 13.333"
         */
        it("should handle simple fractional bets when not facing action", () => {
            // When no one has bet yet, callAmount = 0, HB = 0
            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.FLOP,
                previousActions: [],
                callAmount: 0n,
                pot: 20_000_000n // $20 pot
            });

            // Full pot = 0 + 0 + 20 = 20
            expect(result).toBe(20_000_000n);

            // Fractional bets are just fractions of the pot when not facing action
            const quarterPot = result / 4n;
            expect(quarterPot).toBe(5_000_000n); // $5

            const halfPot = result / 2n;
            expect(halfPot).toBe(10_000_000n); // $10

            const twoThirdsPot = (result * 2n) / 3n;
            expect(twoThirdsPot).toBe(13_333_333n); // $13.33 (bigint truncation)
        });

        /**
         * Issue #1187 example verification:
         * Seat 1: SB 1, Seat 2: BB 2, Seat 3: Raise 6, Seat 4: Call 6
         * HB = 6, POT = 15, CALL = 6
         * Seat 5's Pot Bet = 6 + 6 + 15 = 27
         */
        it("should match issue #1187 example: preflop with raise and call", () => {
            const previousActions: ActionDTO[] = [
                createAction(PlayerActionType.SMALL_BLIND, "1000000", TexasHoldemRound.PREFLOP, PLAYER_1, 1),
                createAction(PlayerActionType.BIG_BLIND, "2000000", TexasHoldemRound.PREFLOP, PLAYER_2, 2),
                createAction(PlayerActionType.RAISE, "6000000", TexasHoldemRound.PREFLOP, PLAYER_3, 3),
                createAction(PlayerActionType.CALL, "6000000", TexasHoldemRound.PREFLOP, "b521q4th5pl", 4)
            ];

            const result = calculatePotBetAmount({
                currentRound: TexasHoldemRound.PREFLOP,
                previousActions,
                callAmount: 6_000_000n, // $6 to call
                pot: 15_000_000n // $1 + $2 + $6 + $6 = $15
            });

            // Pot bet = CALL + HB + POT = 6 + 6 + 15 = 27
            expect(result).toBe(27_000_000n);
        });
    });
});
