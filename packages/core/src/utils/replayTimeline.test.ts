import { PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import {
    REPLAY_SPEEDS,
    REPLAY_STEP_MS,
    actionsQuery,
    buildTimeline,
    clampStep,
    describeReplayStep,
    latestCompletedHand,
    parseActionHeights,
    stepDelayMs
} from "./replayTimeline";

describe("replayTimeline (ui#816)", () => {
    describe("actionsQuery", () => {
        it("asks for every action_performed of the hand", () => {
            expect(actionsQuery("0xabc", 7)).toBe("action_performed.game_id='0xabc' AND action_performed.hand_number='7'");
        });

        it("refuses an id or hand number that could break the query", () => {
            expect(() => actionsQuery("0xabc' OR 1", 1)).toThrow("Invalid table id");
            expect(() => actionsQuery("0xabc", 0)).toThrow("Invalid hand number");
            expect(() => actionsQuery("0xabc", 1.5)).toThrow("Invalid hand number");
        });
    });

    describe("parseActionHeights", () => {
        it("returns distinct heights ascending, dropping malformed entries", () => {
            const response = { result: { txs: [{ height: "120" }, { height: "100" }, { height: "120" }, { height: "x" }, {}, { height: "0" }] } };
            expect(parseActionHeights(response)).toEqual([100, 120]);
        });

        it("is empty for no result", () => {
            expect(parseActionHeights(undefined)).toEqual([]);
            expect(parseActionHeights({ result: {} })).toEqual([]);
        });
    });

    describe("buildTimeline", () => {
        it("is start, actions, end — ascending, no repeats", () => {
            expect(buildTimeline(100, [105, 103, 110], 110)).toEqual([100, 103, 105, 110]);
        });

        it("copes with a missing start or end", () => {
            expect(buildTimeline(null, [5, 6], null)).toEqual([5, 6]);
            expect(buildTimeline(4, [], null)).toEqual([4]);
            expect(buildTimeline(null, [], null)).toEqual([]);
        });
    });

    describe("latestCompletedHand", () => {
        it("is the current hand once it has ended, else the one before", () => {
            expect(latestCompletedHand({ handNumber: 5, round: TexasHoldemRound.END })).toBe(5);
            expect(latestCompletedHand({ handNumber: 5, round: TexasHoldemRound.FLOP })).toBe(4);
        });

        it("is null before the first hand completes", () => {
            expect(latestCompletedHand({ handNumber: 1, round: TexasHoldemRound.PREFLOP })).toBeNull();
            expect(latestCompletedHand({ handNumber: 0, round: TexasHoldemRound.ANTE })).toBeNull();
            expect(latestCompletedHand(null)).toBeNull();
            expect(latestCompletedHand(undefined)).toBeNull();
        });
    });

    describe("stepDelayMs / clampStep", () => {
        it("halves the pause at 2× and doubles it at 0.5×; unknown speeds play at 1×", () => {
            expect(stepDelayMs(1)).toBe(REPLAY_STEP_MS);
            expect(stepDelayMs(2)).toBe(REPLAY_STEP_MS / 2);
            expect(stepDelayMs(0.5)).toBe(REPLAY_STEP_MS * 2);
            expect(stepDelayMs(3)).toBe(REPLAY_STEP_MS);
            expect(REPLAY_SPEEDS).toEqual([0.5, 1, 2, 4]);
        });

        it("clamps into the timeline", () => {
            expect(clampStep(-1, 5)).toBe(0);
            expect(clampStep(9, 5)).toBe(4);
            expect(clampStep(2.7, 5)).toBe(2);
            expect(clampStep(3, 0)).toBe(0);
        });
    });

    describe("describeReplayStep", () => {
        it("names the last recorded action and its seat", () => {
            const state = { previousActions: [{ playerId: "a", seat: 3, action: PlayerActionType.SMALL_BLIND, amount: "1", round: TexasHoldemRound.PREFLOP, index: 1, timestamp: 0 }] };
            expect(describeReplayStep(state)).toBe("Post small blind · seat 3");
        });

        it("is the deal before any action", () => {
            expect(describeReplayStep({ previousActions: [] })).toBe("Cards dealt");
            expect(describeReplayStep(null)).toBe("Cards dealt");
        });
    });
});
