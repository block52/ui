import { PlayerActionType } from "@block52/poker-vm-sdk";
import { ALL_SESSION_GAMES } from "./sessionGameDisplay";
import {
    contributionFromActions,
    handContributionNote,
    handKeyForTarget,
    profitHandsToMeasure,
    readContributionAtHeights,
    readHandContribution,
    type ContributionAction
} from "./handContribution";

const ME = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";
const OTHER = "b521mhf0gq0wmsyt5hdn7arqedktrvjrdrugs285xn";
const THIRD = "b521vtyfq4q8jr8l0qrjul89rszccguf3ya9xk0uaa";

const act = (playerId: string, action: string, amount = ""): ContributionAction => ({ playerId, action, amount });

describe("contributionFromActions", () => {
    it("sums blinds and leaves a folded-to big blind in the total", () => {
        // Hand 147: SB folds to the big blind. The extra 750 is paid back inside won_amount.
        const actions = [
            act(OTHER, PlayerActionType.SMALL_BLIND, "750"),
            act(ME, PlayerActionType.BIG_BLIND, "1500"),
            act(OTHER, "deal"),
            act(OTHER, PlayerActionType.FOLD)
        ];
        expect(contributionFromActions(actions, ME)).toBe(1500);
        expect(contributionFromActions(actions, OTHER)).toBe(750);
    });

    it("sums a raise everyone folds to, including the unmatched part", () => {
        // Hand 116: raise 2000, both blinds fold. The unmatched 1000 comes back inside the pot award.
        const actions = [
            act(OTHER, PlayerActionType.SMALL_BLIND, "500"),
            act(THIRD, PlayerActionType.BIG_BLIND, "1000"),
            act(ME, "deal"),
            act(ME, PlayerActionType.RAISE, "2000"),
            act(OTHER, PlayerActionType.FOLD),
            act(THIRD, PlayerActionType.FOLD)
        ];
        expect(contributionFromActions(actions, ME)).toBe(2000);
    });

    it("sums an all-in that is fully matched, across the blind and the call", () => {
        // Hand 159: BB 1500 + call 13924 matches SB 750 + all-in 14674.
        const actions = [
            act(OTHER, PlayerActionType.SMALL_BLIND, "750"),
            act(ME, PlayerActionType.BIG_BLIND, "1500"),
            act(OTHER, "deal"),
            act(OTHER, PlayerActionType.ALL_IN, "14674"),
            act(ME, PlayerActionType.CALL, "13924")
        ];
        expect(contributionFromActions(actions, ME)).toBe(15424);
        expect(contributionFromActions(actions, OTHER)).toBe(15424);
    });

    it("returns the uncalled part of an all-in that a shorter all-in cannot cover", () => {
        // Hand 66: BB 1300 against a small blind who is all-in for 1160. 140 never enters the awarded pot.
        const actions = [
            act(OTHER, PlayerActionType.SMALL_BLIND, "650"),
            act(ME, PlayerActionType.BIG_BLIND, "1300"),
            act(OTHER, "deal"),
            act(OTHER, PlayerActionType.ALL_IN, "510")
        ];
        expect(contributionFromActions(actions, ME)).toBe(1160);
        expect(contributionFromActions(actions, OTHER)).toBe(1160);
    });

    it("returns an oversized all-in down to the shorter all-in, and ignores the buy-in", () => {
        // Hand 25: 40 + 80 + all-in 4870 against an opponent all-in for 1010. Join chips are not the hand.
        const actions = [
            act(OTHER, PlayerActionType.SMALL_BLIND, "20"),
            act(ME, PlayerActionType.BIG_BLIND, "40"),
            act(OTHER, "deal"),
            act(OTHER, PlayerActionType.RAISE, "60"),
            act(ME, PlayerActionType.RAISE, "80"),
            act(OTHER, PlayerActionType.RAISE, "80"),
            act(ME, PlayerActionType.ALL_IN, "4870"),
            act(OTHER, PlayerActionType.ALL_IN, "850"),
            act(ME, "join", "10000")
        ];
        expect(contributionFromActions(actions, ME)).toBe(1010);
    });

    it("keeps both players' matched chips in a split pot", () => {
        // Hand 10: each player puts in 800 and the pot is chopped. Nobody is uncalled.
        const actions = [
            act(OTHER, PlayerActionType.BIG_BLIND, "100"),
            act(ME, PlayerActionType.CALL, "100"),
            act(OTHER, PlayerActionType.BET, "500"),
            act(ME, PlayerActionType.CALL, "500"),
            act(OTHER, PlayerActionType.BET, "200"),
            act(ME, PlayerActionType.CALL, "200"),
            act(ME, PlayerActionType.CHECK),
            act(OTHER, PlayerActionType.CHECK)
        ];
        expect(contributionFromActions(actions, ME)).toBe(800);
        expect(contributionFromActions(actions, OTHER)).toBe(800);
    });

    it("returns the uncalled bet in a split where a shorter all-in cannot call the later street", () => {
        // Hand 38: 1500 preflop plus a 1500 turn bet the all-in player cannot call. Won amount is only the side pot.
        const short = "b5217xktwg6kshortallin";
        const actions = [
            act(OTHER, PlayerActionType.SMALL_BLIND, "750"),
            act(THIRD, PlayerActionType.BIG_BLIND, "1500"),
            act(ME, "deal"),
            act(ME, PlayerActionType.CALL, "1500"),
            act(OTHER, PlayerActionType.CALL, "750"),
            act(short, PlayerActionType.ALL_IN, "1389"),
            act(OTHER, PlayerActionType.FOLD),
            act(THIRD, PlayerActionType.FOLD),
            act(ME, PlayerActionType.BET, "1500"),
            act(OTHER, PlayerActionType.FOLD)
        ];
        // Highest other commitment is the big blind's 1500. The all-in is shorter, so the turn bet is returned.
        expect(contributionFromActions(actions, ME)).toBe(1500);
    });

    it("includes an ante and a dead small blind", () => {
        const actions = [
            act(ME, "ante", "160"),
            act(ME, "dead-small-blind", "40"),
            act(ME, PlayerActionType.SMALL_BLIND, "80"),
            act(OTHER, PlayerActionType.BIG_BLIND, "160"),
            act(OTHER, PlayerActionType.FOLD)
        ];
        expect(contributionFromActions(actions, ME)).toBe(280);
    });

    it("does not count a fold with no chips, and ignores a missing player", () => {
        const actions = [act(OTHER, PlayerActionType.SMALL_BLIND, "10"), act(OTHER, PlayerActionType.BIG_BLIND, "20"), act(ME, PlayerActionType.FOLD)];
        expect(contributionFromActions(actions, ME)).toBe(0);
        expect(contributionFromActions(actions, undefined)).toBeUndefined();
        expect(contributionFromActions([], ME)).toBeUndefined();
        expect(contributionFromActions(undefined, ME)).toBeUndefined();
    });

    it("leaves the hand unknown when a chip amount cannot be read", () => {
        const actions = [act(ME, PlayerActionType.BET, "12.5"), act(OTHER, PlayerActionType.FOLD)];
        expect(contributionFromActions(actions, ME)).toBeUndefined();
        const overflow = [act(ME, PlayerActionType.BET, String(Number.MAX_SAFE_INTEGER)), act(ME, PlayerActionType.BET, "1")];
        expect(contributionFromActions(overflow, ME)).toBeUndefined();
    });

    it("matches addresses without regard to case", () => {
        const actions = [act(ME.toUpperCase(), PlayerActionType.SMALL_BLIND, "50"), act(OTHER, PlayerActionType.BIG_BLIND, "100"), act(OTHER, PlayerActionType.FOLD)];
        expect(contributionFromActions(actions, ME)).toBe(50);
    });
});

describe("readContributionAtHeights", () => {
    const hand = { gameId: "0xabc", handNumber: 4, blockHeight: 100 };
    const actions = [act(ME, PlayerActionType.BIG_BLIND, "20"), act(OTHER, PlayerActionType.SMALL_BLIND, "10"), act(OTHER, PlayerActionType.FOLD)];

    it("uses the end block when it is still this hand", async () => {
        const stateAt = jest.fn(async () => ({ handNumber: 4, previousActions: actions }));
        await expect(readContributionAtHeights(ME, hand, stateAt)).resolves.toBe(20);
        expect(stateAt).toHaveBeenCalledTimes(1);
        expect(stateAt).toHaveBeenCalledWith("0xabc", 100);
    });

    it("steps back a block when the end block already shows the next hand", async () => {
        const stateAt = jest.fn(async (_gameId: string, height: number) =>
            height === 100 ? { handNumber: 5, previousActions: [] } : { handNumber: 4, previousActions: actions }
        );
        await expect(readContributionAtHeights(ME, hand, stateAt)).resolves.toBe(20);
        expect(stateAt.mock.calls.map(call => call[1])).toEqual([100, 99]);
    });

    it("is unknown when neither block still has the hand", async () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const stateAt = jest.fn(async () => {
            throw new Error("version does not exist");
        });
        await expect(readContributionAtHeights(ME, hand, stateAt)).resolves.toBeUndefined();
        expect(stateAt).toHaveBeenCalledTimes(2);
        error.mockRestore();
    });
});

describe("readHandContribution", () => {
    const hand = { gameId: "0xabc", handNumber: 1, blockHeight: 50 };
    const actions = [act(ME, PlayerActionType.CALL, "0")];

    it("keeps a zero contribution from the first node and does not ask the next", async () => {
        const stateAt = jest.fn(async (endpoint: string) => {
            if (endpoint === "pruned") throw new Error("should not be asked");
            return { handNumber: 1, previousActions: actions };
        });
        await expect(readHandContribution(ME, hand, ["live", "pruned"], stateAt)).resolves.toBe(0);
        expect(stateAt.mock.calls.map(call => call[0])).toEqual(["live"]);
    });

    it("tries the next node when the first no longer has the hand", async () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const stateAt = jest.fn(async (endpoint: string) => {
            if (endpoint === "pruned") throw new Error("version does not exist");
            return { handNumber: 1, previousActions: [act(ME, PlayerActionType.BET, "40"), act(OTHER, PlayerActionType.CALL, "40")] };
        });
        await expect(readHandContribution(ME, hand, ["pruned", "archive"], stateAt)).resolves.toBe(40);
        error.mockRestore();
    });
});

describe("profitHandsToMeasure", () => {
    const labels = {
        cashA: { title: "Cash Game · Texas Hold'em", filterKey: "Cash Game · Texas Hold'em" },
        tourn: { title: "Tournament · Texas Hold'em", filterKey: "Tournament · Texas Hold'em" }
    };
    const units = { cashA: "usd" as const, tourn: "chips" as const };
    const hands = [
        { game_id: "cashA", hand_number: 2, block_height: 10 },
        { game_id: "tourn", hand_number: 3, block_height: 20 }
    ];

    it("does not fetch when All mixes cash dollars with tournament chips", () => {
        expect(profitHandsToMeasure(hands, labels, units, ALL_SESSION_GAMES)).toBeUndefined();
    });

    it("returns only the selected variant once its tables share a unit", () => {
        expect(profitHandsToMeasure(hands, labels, units, "Tournament · Texas Hold'em")).toEqual([
            { gameId: "tourn", handNumber: 3, blockHeight: 20 }
        ]);
    });

    it("does not fetch a variant whose table format is unknown", () => {
        expect(profitHandsToMeasure(hands, labels, { cashA: "usd" }, "Cash Game · Texas Hold'em")).toEqual([
            { gameId: "cashA", handNumber: 2, blockHeight: 10 }
        ]);
        expect(profitHandsToMeasure([{ game_id: "mystery", hand_number: 1, block_height: 1 }], {}, {}, ALL_SESSION_GAMES)).toBeUndefined();
    });
});

describe("handContributionNote", () => {
    it("names the hands that were left out, and stays quiet when every hand was read", () => {
        expect(handContributionNote(0, 4)).toBeUndefined();
        expect(handContributionNote(1, 4)).toBe("Skips 1 of 4 hands no longer on the node.");
        expect(handContributionNote(12, 40)).toBe(`Skips ${(12).toLocaleString()} of ${(40).toLocaleString()} hands no longer on the node.`);
    });
});

describe("handKeyForTarget", () => {
    it("uses the My Hands identity", () => {
        expect(handKeyForTarget({ gameId: "0xabc", handNumber: 7 })).toBe("0xabc#7");
    });
});
