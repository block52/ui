import { LegalActionDTO, NonPlayerActionType, PlayerActionType, PlayerDTO, PlayerStatus } from "@block52/poker-vm-sdk";
import { getActionFlags, getFormattedMaxBetAmount, getInitialRaiseAmount, getTotalPotMicro, getUserPlayer, userInTable, validRaiseAmount } from "./pockerActionUtils";

describe("pockerActionUtils", () => {
    const players: PlayerDTO[] = [
        {
            address: "b521hg93rsm2f5v3zlepf20ru88uweajt3nf492s2p",
            avatar: undefined,
            seat: 2,
            stack: "1000000",
            isSmallBlind: false,
            isBigBlind: true,
            isDealer: false,
            holeCards: undefined,
            status: PlayerStatus.FOLDED,
            lastAction: undefined,
            legalActions: [],
            sumOfBets: "1000",
            timeout: 30,
            signature: ""
        },
        {
            address: "b521kwcmmsp5zhx8e0j9t9zsusvuep2euht3z0vgu9",
            avatar: undefined,
            seat: 2,
            stack: "1000000",
            isSmallBlind: true,
            isBigBlind: false,
            isDealer: true,
            holeCards: undefined,
            status: PlayerStatus.ACTIVE,
            lastAction: undefined,
            legalActions: [
                { action: PlayerActionType.FOLD, min: undefined, max: undefined, index: 0 },
                { action: PlayerActionType.CALL, min: "1000", max: "1000", index: 1 },
                { action: PlayerActionType.RAISE, min: "2000", max: "5000000", index: 2 }
            ] as LegalActionDTO[],
            sumOfBets: "500",
            timeout: 30,
            signature: ""
        }
    ];
    // Add your test cases here
    beforeEach(() => {
        // Reset any necessary state before each test
    });

    afterEach(() => {
        // Clean up any necessary state after each test
    });

    it("should return true if player is in the table", () => {
        const userAddress = "b521kwcmmsp5zhx8e0j9t9zsusvuep2euht3z0vgu9";
        const result = userInTable(players, userAddress);
        expect(result).toBe(true);
    });

    it("should return false if player is not in the table", () => {
        const userAddress = "b521nonexistentaddress";
        const result = userInTable(players, userAddress);
        expect(result).toBe(false);
    });

    it("should return players info if player is in the table", () => {
        const userAddress = "b521kwcmmsp5zhx8e0j9t9zsusvuep2euht3z0vgu9";
        const result = getUserPlayer(players, userAddress);
        expect(result).toEqual(players[1]);
    });

    it("should return null if player is not in the table", () => {
        const userAddress = "b521nonexistentaddress";
        const result = getUserPlayer(players, userAddress);
        expect(result).toBeNull();
    });

    describe("validRaiseAmount", () => {
        it("should return false when neither raise nor bet action is available", () => {
            expect(validRaiseAmount(500, false, false, 0, 0, 0, 0)).toBe(false);
        });

        it("should return false when raise amount is within raise bounds", () => {
            expect(validRaiseAmount(300, true, false, 200, 500, 0, 0)).toBe(false);
        });

        it("should return true when raise amount is below min raise", () => {
            expect(validRaiseAmount(100, true, false, 200, 500, 0, 0)).toBe(true);
        });

        it("should return true when raise amount is above max raise", () => {
            expect(validRaiseAmount(600, true, false, 200, 500, 0, 0)).toBe(true);
        });

        it("should return false when bet amount is within bet bounds", () => {
            expect(validRaiseAmount(300, false, true, 0, 0, 200, 500)).toBe(false);
        });

        it("should return true when bet amount is below min bet", () => {
            expect(validRaiseAmount(100, false, true, 0, 0, 200, 500)).toBe(true);
        });

        it("should return true when bet amount is above max bet", () => {
            expect(validRaiseAmount(600, false, true, 0, 0, 200, 500)).toBe(true);
        });

        it("should use raise bounds when both raise and bet actions are available", () => {
            expect(validRaiseAmount(250, true, true, 200, 400, 100, 500)).toBe(false);
            expect(validRaiseAmount(450, true, true, 200, 400, 100, 500)).toBe(true);
        });
    });

    describe("getInitialRaiseAmount", () => {
        it("should return minBet when hasBetAction is true and minBet > 0", () => {
            expect(getInitialRaiseAmount(true, 200, 400)).toBe(200);
        });

        it("should return 0 when hasBetAction is true but minBet is 0", () => {
            expect(getInitialRaiseAmount(true, 0, 400)).toBe(0);
        });

        it("should return minRaise when hasBetAction is false and minRaise > 0", () => {
            expect(getInitialRaiseAmount(false, 200, 400)).toBe(400);
        });

        it("should return 0 when hasBetAction is false and minRaise is 0", () => {
            expect(getInitialRaiseAmount(false, 200, 0)).toBe(0);
        });
    });

    describe("getFormattedMaxBetAmount", () => {
        it("should return formatted maxBet when hasBetAction is true (cash)", () => {
            expect(getFormattedMaxBetAmount(true, 10, 20, false)).toBe("$10.00");
        });

        it("should return formatted maxRaise when hasBetAction is false (cash)", () => {
            expect(getFormattedMaxBetAmount(false, 10, 20, false)).toBe("$20.00");
        });

        it("should return formatted maxBet when hasBetAction is true (tournament)", () => {
            expect(getFormattedMaxBetAmount(true, 1500, 3000, true)).toBe("1,500");
        });

        it("should return formatted maxRaise when hasBetAction is false (tournament)", () => {
            expect(getFormattedMaxBetAmount(false, 1500, 3000, true)).toBe("3,000");
        });
    });

    describe("getTotalPotMicro", () => {
        it("should parse raw micro string to bigint", () => {
            expect(getTotalPotMicro("10000000")).toBe(10_000_000n);
        });

        it("should strip decimals from micro string", () => {
            expect(getTotalPotMicro("1500.9")).toBe(1500n);
        });

        it("should return 0n for empty string", () => {
            expect(getTotalPotMicro("")).toBe(0n);
        });

        it("should return 0n for zero string", () => {
            expect(getTotalPotMicro("0")).toBe(0n);
        });
    });

    describe("getActionFlags", () => {
        const allActions: LegalActionDTO[] = [
            { action: PlayerActionType.SMALL_BLIND, min: "500", max: "500", index: 0 },
            { action: PlayerActionType.BIG_BLIND, min: "1000", max: "1000", index: 1 },
            { action: PlayerActionType.FOLD, min: undefined, max: undefined, index: 2 },
            { action: PlayerActionType.CHECK, min: undefined, max: undefined, index: 3 },
            { action: PlayerActionType.CALL, min: "1000", max: "1000", index: 4 },
            { action: PlayerActionType.BET, min: "1000", max: "5000000", index: 5 },
            { action: PlayerActionType.RAISE, min: "2000", max: "5000000", index: 6 },
            { action: PlayerActionType.MUCK, min: undefined, max: undefined, index: 7 },
            { action: PlayerActionType.SHOW, min: undefined, max: undefined, index: 8 },
            { action: NonPlayerActionType.DEAL, min: undefined, max: undefined, index: 9 },
            { action: NonPlayerActionType.NEW_HAND, min: undefined, max: undefined, index: 10 }
        ];

        it("should return true for all flags when all actions are present", () => {
            const flags = getActionFlags(allActions);
            expect(flags.hasSmallBlindAction).toBe(true);
            expect(flags.hasBigBlindAction).toBe(true);
            expect(flags.hasFoldAction).toBe(true);
            expect(flags.hasCheckAction).toBe(true);
            expect(flags.hasCallAction).toBe(true);
            expect(flags.hasBetAction).toBe(true);
            expect(flags.hasRaiseAction).toBe(true);
            expect(flags.hasMuckAction).toBe(true);
            expect(flags.hasShowAction).toBe(true);
            expect(flags.hasDealAction).toBe(true);
            expect(flags.hasNewHandAction).toBe(true);
        });

        it("should return false for all flags when no actions are present", () => {
            const flags = getActionFlags([]);
            Object.values(flags).forEach(flag => expect(flag).toBe(false));
        });

        it("should return only the flags for actions present", () => {
            const foldCallActions: LegalActionDTO[] = [
                { action: PlayerActionType.FOLD, min: undefined, max: undefined, index: 0 },
                { action: PlayerActionType.CALL, min: "1000", max: "1000", index: 1 }
            ];
            const flags = getActionFlags(foldCallActions);
            expect(flags.hasFoldAction).toBe(true);
            expect(flags.hasCallAction).toBe(true);
            expect(flags.hasBetAction).toBe(false);
            expect(flags.hasRaiseAction).toBe(false);
            expect(flags.hasCheckAction).toBe(false);
        });
    });
});
