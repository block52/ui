import { ActionDTO, PlayerActionType, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { shouldShowChips, getRelevantChipAmounts, calculateCurrentRoundBetting, CHIP_ACTIONS } from "./chipUtils";
import { MAX_ACTION_GROUPS } from "../constants/chips";

// Helper to build an ActionDTO for tests
const makeAction = (fields: { playerId: string; round: string; action: string; amount: string; index: number }): ActionDTO => ({
    ...fields,
} as ActionDTO);

describe("shouldShowChips", () => {
    it("returns true for ACTIVE players", () => {
        expect(shouldShowChips(PlayerStatus.ACTIVE)).toBe(true);
    });

    it("returns true for ALL_IN players", () => {
        expect(shouldShowChips(PlayerStatus.ALL_IN)).toBe(true);
    });

    it("returns true for FOLDED players", () => {
        expect(shouldShowChips(PlayerStatus.FOLDED)).toBe(true);
    });

    it("returns false for SITTING_OUT players", () => {
        expect(shouldShowChips(PlayerStatus.SITTING_OUT)).toBe(false);
    });

    it("returns false for SEATED players", () => {
        expect(shouldShowChips(PlayerStatus.SEATED)).toBe(false);
    });

    it("returns false for BUSTED players", () => {
        expect(shouldShowChips(PlayerStatus.BUSTED)).toBe(false);
    });
});

describe("CHIP_ACTIONS", () => {
    it("includes all betting action types", () => {
        expect(CHIP_ACTIONS).toContain(PlayerActionType.SMALL_BLIND);
        expect(CHIP_ACTIONS).toContain(PlayerActionType.BIG_BLIND);
        expect(CHIP_ACTIONS).toContain(PlayerActionType.BET);
        expect(CHIP_ACTIONS).toContain(PlayerActionType.CALL);
        expect(CHIP_ACTIONS).toContain(PlayerActionType.RAISE);
        expect(CHIP_ACTIONS).toContain(PlayerActionType.ALL_IN);
    });

    it("does not include non-betting actions", () => {
        expect(CHIP_ACTIONS).not.toContain(PlayerActionType.FOLD);
        expect(CHIP_ACTIONS).not.toContain(PlayerActionType.CHECK);
    });
});

describe("getRelevantChipAmounts", () => {
    const player = "0xPlayer1";

    it("returns empty array when no actions match", () => {
        const result = getRelevantChipAmounts(player, TexasHoldemRound.FLOP, []);
        expect(result).toEqual([]);
    });

    it("filters actions by player address", () => {
        const actions = [
            makeAction({ playerId: "0xOther", round: TexasHoldemRound.FLOP, action: PlayerActionType.BET, amount: "100", index: 0 }),
            makeAction({ playerId: player, round: TexasHoldemRound.FLOP, action: PlayerActionType.BET, amount: "200", index: 1 }),
        ];
        const result = getRelevantChipAmounts(player, TexasHoldemRound.FLOP, actions);
        expect(result).toEqual(["200"]);
    });

    it("includes ANTE and PREFLOP actions during preflop", () => {
        const actions = [
            makeAction({ playerId: player, round: TexasHoldemRound.ANTE, action: PlayerActionType.SMALL_BLIND, amount: "50", index: 0 }),
            makeAction({ playerId: player, round: TexasHoldemRound.PREFLOP, action: PlayerActionType.CALL, amount: "100", index: 1 }),
        ];
        const result = getRelevantChipAmounts(player, TexasHoldemRound.PREFLOP, actions);
        expect(result).toEqual(["50", "100"]);
    });

    it("includes ANTE and PREFLOP actions during ante round", () => {
        const actions = [
            makeAction({ playerId: player, round: TexasHoldemRound.ANTE, action: PlayerActionType.BIG_BLIND, amount: "200", index: 0 }),
        ];
        const result = getRelevantChipAmounts(player, TexasHoldemRound.ANTE, actions);
        expect(result).toEqual(["200"]);
    });

    it("only includes current round actions post-flop", () => {
        const actions = [
            makeAction({ playerId: player, round: TexasHoldemRound.PREFLOP, action: PlayerActionType.CALL, amount: "100", index: 0 }),
            makeAction({ playerId: player, round: TexasHoldemRound.FLOP, action: PlayerActionType.BET, amount: "300", index: 1 }),
            makeAction({ playerId: player, round: TexasHoldemRound.TURN, action: PlayerActionType.BET, amount: "500", index: 2 }),
        ];
        const result = getRelevantChipAmounts(player, TexasHoldemRound.FLOP, actions);
        expect(result).toEqual(["300"]);
    });

    it("excludes non-chip actions (fold, check)", () => {
        const actions = [
            makeAction({ playerId: player, round: TexasHoldemRound.FLOP, action: PlayerActionType.CHECK, amount: "0", index: 0 }),
            makeAction({ playerId: player, round: TexasHoldemRound.FLOP, action: PlayerActionType.BET, amount: "500", index: 1 }),
        ];
        const result = getRelevantChipAmounts(player, TexasHoldemRound.FLOP, actions);
        expect(result).toEqual(["500"]);
    });

    it("excludes actions with zero amount", () => {
        const actions = [
            makeAction({ playerId: player, round: TexasHoldemRound.FLOP, action: PlayerActionType.BET, amount: "0", index: 0 }),
            makeAction({ playerId: player, round: TexasHoldemRound.FLOP, action: PlayerActionType.BET, amount: "400", index: 1 }),
        ];
        const result = getRelevantChipAmounts(player, TexasHoldemRound.FLOP, actions);
        expect(result).toEqual(["400"]);
    });

    it("sorts actions by index", () => {
        const actions = [
            makeAction({ playerId: player, round: TexasHoldemRound.FLOP, action: PlayerActionType.RAISE, amount: "600", index: 3 }),
            makeAction({ playerId: player, round: TexasHoldemRound.FLOP, action: PlayerActionType.BET, amount: "200", index: 1 }),
        ];
        const result = getRelevantChipAmounts(player, TexasHoldemRound.FLOP, actions);
        expect(result).toEqual(["200", "600"]);
    });

    it("merges oldest actions when exceeding MAX_ACTION_GROUPS", () => {
        // Create MAX_ACTION_GROUPS + 2 actions to trigger merging
        const count = MAX_ACTION_GROUPS + 2;
        const actions = Array.from({ length: count }, (_, i) =>
            makeAction({ playerId: player, round: TexasHoldemRound.FLOP, action: PlayerActionType.BET, amount: "100", index: i })
        );
        const result = getRelevantChipAmounts(player, TexasHoldemRound.FLOP, actions);

        // Should have exactly MAX_ACTION_GROUPS entries
        expect(result).toHaveLength(MAX_ACTION_GROUPS);

        // First entry is the merged total of the oldest (count - MAX_ACTION_GROUPS + 1) actions
        const mergeCount = count - MAX_ACTION_GROUPS + 1;
        expect(result[0]).toBe((BigInt(100) * BigInt(mergeCount)).toString());

        // Remaining entries are unchanged
        for (let i = 1; i < MAX_ACTION_GROUPS; i++) {
            expect(result[i]).toBe("100");
        }
    });
});

describe("calculateCurrentRoundBetting", () => {
    const player = "0xPlayer1";

    it("returns '0' when no actions match", () => {
        expect(calculateCurrentRoundBetting(player, TexasHoldemRound.FLOP, [])).toBe("0");
    });

    it("sums amounts for the current round only", () => {
        const actions = [
            { playerId: player, round: TexasHoldemRound.PREFLOP, amount: "100" },
            { playerId: player, round: TexasHoldemRound.FLOP, amount: "200" },
            { playerId: player, round: TexasHoldemRound.FLOP, amount: "300" },
        ];
        expect(calculateCurrentRoundBetting(player, TexasHoldemRound.FLOP, actions)).toBe("500");
    });

    it("filters by player address", () => {
        const actions = [
            { playerId: "0xOther", round: TexasHoldemRound.FLOP, amount: "1000" },
            { playerId: player, round: TexasHoldemRound.FLOP, amount: "200" },
        ];
        expect(calculateCurrentRoundBetting(player, TexasHoldemRound.FLOP, actions)).toBe("200");
    });

    it("excludes zero and empty amounts", () => {
        const actions = [
            { playerId: player, round: TexasHoldemRound.FLOP, amount: "0" },
            { playerId: player, round: TexasHoldemRound.FLOP, amount: "" },
            { playerId: player, round: TexasHoldemRound.FLOP, amount: "500" },
        ];
        expect(calculateCurrentRoundBetting(player, TexasHoldemRound.FLOP, actions)).toBe("500");
    });

    it("handles large BigInt amounts correctly", () => {
        const actions = [
            { playerId: player, round: TexasHoldemRound.FLOP, amount: "999999999999999999" },
            { playerId: player, round: TexasHoldemRound.FLOP, amount: "1" },
        ];
        expect(calculateCurrentRoundBetting(player, TexasHoldemRound.FLOP, actions)).toBe("1000000000000000000");
    });
});
