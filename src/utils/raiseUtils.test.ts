import { ActionDTO, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { usdcToMicro } from "../constants/currency";
import { getRaiseToAmount, calculateRaiseToDisplay, getStreetCommitTotalForAction } from "./raiseUtils";

describe("calculateRaiseToDisplay", () => {
    describe("basic calculation", () => {
        it("should add player's current bet to raise amount", () => {
            // Player has bet 0.02, wants to raise by 0.02
            const playerSumOfBets = "20000"; // 0.02 in micro-USDC (6 decimals)
            const raiseAmount = 0.02;

            const result = calculateRaiseToDisplay(playerSumOfBets, raiseAmount);
            expect(result).toBeCloseTo(0.04, 10);
        });

        it("should handle zero current bet", () => {
            const playerSumOfBets = "0";
            const raiseAmount = 0.05;

            const result = calculateRaiseToDisplay(playerSumOfBets, raiseAmount);
            expect(result).toBeCloseTo(0.05, 10);
        });

        it("should handle zero raise amount", () => {
            const playerSumOfBets = "50000"; // 0.05 in micro-USDC
            const raiseAmount = 0;

            const result = calculateRaiseToDisplay(playerSumOfBets, raiseAmount);
            expect(result).toBeCloseTo(0.05, 10);
        });

        it("should handle empty string as zero", () => {
            const playerSumOfBets = "";
            const raiseAmount = 1.5;

            const result = calculateRaiseToDisplay(playerSumOfBets, raiseAmount);
            expect(result).toBeCloseTo(1.5, 10);
        });
    });

    describe("decimal amounts", () => {
        it("should handle small decimal amounts correctly", () => {
            const playerSumOfBets = "10000"; // 0.01 in micro-USDC
            const raiseAmount = 0.01;

            const result = calculateRaiseToDisplay(playerSumOfBets, raiseAmount);
            expect(result).toBeCloseTo(0.02, 10);
        });

        it("should handle larger amounts", () => {
            const playerSumOfBets = "5000000"; // 5.0 in micro-USDC
            const raiseAmount = 10.5;

            const result = calculateRaiseToDisplay(playerSumOfBets, raiseAmount);
            expect(result).toBeCloseTo(15.5, 10);
        });

        it("should handle very precise amounts", () => {
            const playerSumOfBets = "123456"; // 0.123456 in micro-USDC
            const raiseAmount = 0.876544;

            const result = calculateRaiseToDisplay(playerSumOfBets, raiseAmount);
            expect(result).toBeCloseTo(1.0, 1); // Less precision due to floating point
        });
    });

    describe("edge cases", () => {
        it("should handle undefined sumOfBets as zero", () => {
            const playerSumOfBets = undefined as unknown as string;
            const raiseAmount = 2.0;

            const result = calculateRaiseToDisplay(playerSumOfBets, raiseAmount);
            expect(result).toBeCloseTo(2.0, 10);
        });

        it("should handle very large bet amounts", () => {
            const playerSumOfBets = "1000000000"; // 1000.0 in micro-USDC
            const raiseAmount = 500.0;

            const result = calculateRaiseToDisplay(playerSumOfBets, raiseAmount);
            expect(result).toBeCloseTo(1500.0, 10);
        });
    });

    describe("real-world scenarios from issue #1569", () => {
        it("should match the example from the issue - small blind scenario", () => {
            // From issue: Player has bet $0.02, raise by $0.02, should show $0.04
            const playerSumOfBets = "20000"; // 0.02 in micro-USDC
            const raiseAmount = 0.02;

            const result = calculateRaiseToDisplay(playerSumOfBets, raiseAmount);
            expect(result).toBeCloseTo(0.04, 10);
        });

        it("should calculate correctly for big blind raise", () => {
            // Big blind posted 0.04, raising by 0.04, should show 0.08
            const playerSumOfBets = "40000"; // 0.04 in micro-USDC
            const raiseAmount = 0.04;

            const result = calculateRaiseToDisplay(playerSumOfBets, raiseAmount);
            expect(result).toBeCloseTo(0.08, 10);
        });
    });
});

describe("getRaiseToAmount", () => {
    // Cosmos bech32 addresses (b52 prefix for Block52 chain)
    const USER_ADDRESS = "b521qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqer";
    const OTHER_ADDRESS = "b521qz4sdj8gfx9w9r8h8xvnkkl0xhucqhqv39gtr7";

    // Helper to create mock actions with all required SDK fields
    const createAction = (
        action: PlayerActionType,
        amountInUnits: number,
        round: TexasHoldemRound,
        playerId: string = USER_ADDRESS,
        seat: number = 1
    ): ActionDTO => ({
        playerId,
        seat,
        action,
        amount: usdcToMicro(amountInUnits).toString(), // Convert USDC to micro-USDC (6 decimals)
        round,
        index: 0,
        timestamp: Date.now()
    });

    describe("basic raise calculation", () => {
        it("should return raiseAmount when no actions exist", () => {
            const result = getRaiseToAmount(100, [], TexasHoldemRound.FLOP, USER_ADDRESS, false);
            expect(result).toBe(100);
        });

        it("should return raiseAmount when actions array is undefined/null", () => {
            const result = getRaiseToAmount(100, undefined as unknown as ActionDTO[], TexasHoldemRound.FLOP, USER_ADDRESS, false);
            expect(result).toBe(100);
        });

        it("should return raiseAmount when user has no previous actions", () => {
            const actions: ActionDTO[] = [createAction(PlayerActionType.BET, 50, TexasHoldemRound.FLOP, OTHER_ADDRESS)];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            expect(result).toBe(100);
        });

        it("should add user previous bet to raise amount", () => {
            const actions: ActionDTO[] = [createAction(PlayerActionType.BET, 50, TexasHoldemRound.FLOP, USER_ADDRESS)];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            // raiseAmount + previous bet = 100 + 50 = 150
            expect(result).toBe(150);
        });

        it("should add user previous raise to raise amount", () => {
            const actions: ActionDTO[] = [createAction(PlayerActionType.RAISE, 75, TexasHoldemRound.FLOP, USER_ADDRESS)];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            expect(result).toBe(175);
        });

        it("should add user previous call to raise amount", () => {
            const actions: ActionDTO[] = [createAction(PlayerActionType.CALL, 30, TexasHoldemRound.FLOP, USER_ADDRESS)];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            expect(result).toBe(130);
        });
    });

    describe("multiple actions", () => {
        it("should sum all user bets and raises in current round", () => {
            const actions: ActionDTO[] = [
                createAction(PlayerActionType.BET, 20, TexasHoldemRound.FLOP, USER_ADDRESS),
                createAction(PlayerActionType.RAISE, 60, TexasHoldemRound.FLOP, USER_ADDRESS)
            ];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            // 100 + 20 + 60 = 180
            expect(result).toBe(180);
        });

        it("should only consider user actions, not other players", () => {
            const actions: ActionDTO[] = [
                createAction(PlayerActionType.BET, 50, TexasHoldemRound.FLOP, USER_ADDRESS),
                createAction(PlayerActionType.RAISE, 200, TexasHoldemRound.FLOP, OTHER_ADDRESS)
            ];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            // Only user's 50 is added, not other's 200
            expect(result).toBe(150);
        });
    });

    describe("round filtering", () => {
        it("should only count actions from current round", () => {
            const actions: ActionDTO[] = [
                createAction(PlayerActionType.BET, 100, TexasHoldemRound.PREFLOP, USER_ADDRESS),
                createAction(PlayerActionType.BET, 50, TexasHoldemRound.FLOP, USER_ADDRESS)
            ];

            const result = getRaiseToAmount(75, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            // Only flop bet (50) should be added
            expect(result).toBe(125);
        });

        it("should work correctly for turn round", () => {
            const actions: ActionDTO[] = [
                createAction(PlayerActionType.BET, 100, TexasHoldemRound.FLOP, USER_ADDRESS),
                createAction(PlayerActionType.BET, 40, TexasHoldemRound.TURN, USER_ADDRESS)
            ];

            const result = getRaiseToAmount(80, actions, TexasHoldemRound.TURN, USER_ADDRESS, false);
            // Only turn bet (40) should be added
            expect(result).toBe(120);
        });
    });

    describe("preflop with blinds", () => {
        it("should include small blind in preflop calculation", () => {
            const actions: ActionDTO[] = [createAction(PlayerActionType.SMALL_BLIND, 10, TexasHoldemRound.ANTE, USER_ADDRESS)];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.PREFLOP, USER_ADDRESS, false);
            // Small blind should be included
            expect(result).toBe(110);
        });

        it("should include big blind in preflop calculation", () => {
            const actions: ActionDTO[] = [createAction(PlayerActionType.BIG_BLIND, 20, TexasHoldemRound.ANTE, USER_ADDRESS)];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.PREFLOP, USER_ADDRESS, false);
            // Big blind should be included
            expect(result).toBe(120);
        });

        it("should include blind plus any preflop raises", () => {
            const actions: ActionDTO[] = [
                createAction(PlayerActionType.BIG_BLIND, 20, TexasHoldemRound.ANTE, USER_ADDRESS),
                createAction(PlayerActionType.RAISE, 60, TexasHoldemRound.PREFLOP, USER_ADDRESS)
            ];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.PREFLOP, USER_ADDRESS, false);
            // BB (20) + raise (60) = 80 added to raise amount
            expect(result).toBe(180);
        });
    });

    describe("case insensitivity", () => {
        it("should match user address case-insensitively", () => {
            const actions: ActionDTO[] = [
                {
                    playerId: USER_ADDRESS.toUpperCase(),
                    seat: 1,
                    action: PlayerActionType.BET,
                    amount: usdcToMicro(50).toString(), // 50 USDC in micro-USDC
                    round: TexasHoldemRound.FLOP,
                    index: 0,
                    timestamp: Date.now()
                }
            ];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS.toLowerCase(), false);
            expect(result).toBe(150);
        });
    });

    describe("action types excluded", () => {
        it("should not include FOLD in calculation", () => {
            const actions: ActionDTO[] = [
                createAction(PlayerActionType.BET, 50, TexasHoldemRound.FLOP, USER_ADDRESS),
                createAction(PlayerActionType.FOLD, 0, TexasHoldemRound.FLOP, USER_ADDRESS)
            ];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            // Only bet should be counted
            expect(result).toBe(150);
        });

        it("should not include CHECK in calculation", () => {
            const actions: ActionDTO[] = [
                createAction(PlayerActionType.CHECK, 0, TexasHoldemRound.FLOP, USER_ADDRESS),
                createAction(PlayerActionType.BET, 30, TexasHoldemRound.FLOP, USER_ADDRESS)
            ];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            // Only bet should be counted
            expect(result).toBe(130);
        });
    });

    describe("edge cases", () => {
        it("should handle zero raise amount", () => {
            const actions: ActionDTO[] = [createAction(PlayerActionType.BET, 50, TexasHoldemRound.FLOP, USER_ADDRESS)];

            const result = getRaiseToAmount(0, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            expect(result).toBe(50);
        });

        it("should handle actions with zero amount (like CHECK)", () => {
            const actions: ActionDTO[] = [
                createAction(PlayerActionType.CHECK, 0, TexasHoldemRound.FLOP, USER_ADDRESS)
            ];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            // CHECK with zero amount shouldn't affect result
            expect(result).toBe(100);
        });

        it("should handle decimal amounts correctly", () => {
            const actions: ActionDTO[] = [createAction(PlayerActionType.BET, 0.5, TexasHoldemRound.FLOP, USER_ADDRESS)];

            const result = getRaiseToAmount(1.5, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            expect(result).toBeCloseTo(2.0, 10);
        });

        it("should handle large amounts", () => {
            const actions: ActionDTO[] = [createAction(PlayerActionType.BET, 1000000, TexasHoldemRound.FLOP, USER_ADDRESS)];

            const result = getRaiseToAmount(500000, actions, TexasHoldemRound.FLOP, USER_ADDRESS, false);
            expect(result).toBe(1500000);
        });
    });

    describe("tournament mode (raw whole chips, issue #488)", () => {
        // In tournaments ActionDTO.amount is expressed in raw whole chips (NOT
        // micro-USDC), so the offset must sum the amounts as-is, never ÷10^6.
        const createChipAction = (
            action: PlayerActionType,
            chips: number,
            round: TexasHoldemRound,
            playerId: string = USER_ADDRESS
        ): ActionDTO => ({
            playerId,
            seat: 1,
            action,
            amount: chips.toString(), // raw chips, not micro-USDC
            round,
            index: 0,
            timestamp: Date.now()
        });

        it("should add previous chip bet as raw chips (no ÷10^6)", () => {
            const actions: ActionDTO[] = [createChipAction(PlayerActionType.BET, 50, TexasHoldemRound.FLOP)];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS, true);
            // 100 + 50 chips = 150 (a cash reading would give 100 + 0.00005)
            expect(result).toBe(150);
        });

        it("should sum multiple chip bets and raises as whole chips", () => {
            const actions: ActionDTO[] = [
                createChipAction(PlayerActionType.BET, 20, TexasHoldemRound.FLOP),
                createChipAction(PlayerActionType.RAISE, 60, TexasHoldemRound.FLOP)
            ];

            const result = getRaiseToAmount(100, actions, TexasHoldemRound.FLOP, USER_ADDRESS, true);
            expect(result).toBe(180);
        });

        it("should include the big blind as raw chips preflop", () => {
            const actions: ActionDTO[] = [createChipAction(PlayerActionType.BIG_BLIND, 20, TexasHoldemRound.ANTE)];

            const result = getRaiseToAmount(1500, actions, TexasHoldemRound.PREFLOP, USER_ADDRESS, true);
            expect(result).toBe(1520);
        });

        it("should stay an integer — never produce a fractional chip offset", () => {
            const actions: ActionDTO[] = [createChipAction(PlayerActionType.BET, 75, TexasHoldemRound.FLOP)];

            const result = getRaiseToAmount(1500, actions, TexasHoldemRound.FLOP, USER_ADDRESS, true);
            expect(result).toBe(1575);
            expect(Number.isInteger(result)).toBe(true);
        });
    });
});

// ui#638 — the chain records action.amount as the STACK DELTA (chips that left
// the stack), so a raise-to-600 from the SB (100 posted) arrives as 500. The
// badge must recover the street total the buttons and chips already use.
describe("getStreetCommitTotalForAction", () => {
    const SB_ADDRESS = "b521qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqer";
    const BB_ADDRESS = "b521qz4sdj8gfx9w9r8h8xvnkkl0xhucqhqv39gtr7";

    const act = (
        index: number,
        playerId: string,
        seat: number,
        action: PlayerActionType,
        amount: string,
        round: TexasHoldemRound
    ): ActionDTO => ({ playerId, seat, action, amount, round, index, timestamp: Date.now() });

    it("recovers RAISE TO 600 from the 500 delta recorded for an SB raise at 100/200 (issue #638, hand #6)", () => {
        const actions = [
            act(1, SB_ADDRESS, 1, PlayerActionType.SMALL_BLIND, "100", TexasHoldemRound.ANTE),
            act(2, BB_ADDRESS, 2, PlayerActionType.BIG_BLIND, "200", TexasHoldemRound.ANTE),
            act(3, SB_ADDRESS, 1, PlayerActionType.RAISE, "500", TexasHoldemRound.PREFLOP)
        ];
        expect(getStreetCommitTotalForAction(actions, actions[2], true)).toBe(600);
    });

    it("recovers the matched total for a call after a posted blind, not the delta", () => {
        // SB limps: posts 100, calls 100 more — the badge total is 200.
        const actions = [
            act(1, SB_ADDRESS, 1, PlayerActionType.SMALL_BLIND, "100", TexasHoldemRound.ANTE),
            act(2, BB_ADDRESS, 2, PlayerActionType.BIG_BLIND, "200", TexasHoldemRound.ANTE),
            act(3, SB_ADDRESS, 1, PlayerActionType.CALL, "100", TexasHoldemRound.PREFLOP)
        ];
        expect(getStreetCommitTotalForAction(actions, actions[2], true)).toBe(200);
    });

    it("sums cash amounts in dollars from micro-units", () => {
        const actions = [
            act(1, SB_ADDRESS, 1, PlayerActionType.SMALL_BLIND, "100000", TexasHoldemRound.ANTE),
            act(2, BB_ADDRESS, 2, PlayerActionType.BIG_BLIND, "200000", TexasHoldemRound.ANTE),
            act(3, SB_ADDRESS, 1, PlayerActionType.RAISE, "500000", TexasHoldemRound.PREFLOP)
        ];
        expect(getStreetCommitTotalForAction(actions, actions[2], false)).toBeCloseTo(0.6, 10);
    });

    it("does not fold a blind into a postflop bet", () => {
        const actions = [
            act(1, SB_ADDRESS, 1, PlayerActionType.SMALL_BLIND, "100", TexasHoldemRound.ANTE),
            act(2, BB_ADDRESS, 2, PlayerActionType.BIG_BLIND, "200", TexasHoldemRound.ANTE),
            act(5, SB_ADDRESS, 1, PlayerActionType.BET, "300", TexasHoldemRound.FLOP)
        ];
        expect(getStreetCommitTotalForAction(actions, actions[2], true)).toBe(300);
    });

    it("excludes the same player's LATER street actions via the index cut (coalesced frames)", () => {
        const actions = [
            act(1, SB_ADDRESS, 1, PlayerActionType.SMALL_BLIND, "100", TexasHoldemRound.ANTE),
            act(3, SB_ADDRESS, 1, PlayerActionType.RAISE, "500", TexasHoldemRound.PREFLOP),
            act(5, SB_ADDRESS, 1, PlayerActionType.RAISE, "600", TexasHoldemRound.PREFLOP)
        ];
        // Total for the FIRST raise must not include the later re-raise.
        expect(getStreetCommitTotalForAction(actions, actions[1], true)).toBe(600);
        // The re-raise's own total includes everything committed before it.
        expect(getStreetCommitTotalForAction(actions, actions[2], true)).toBe(1200);
    });
});
