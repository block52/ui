import { attributeEvidence, recordedActionsFor } from "./identity";
import { ActionDTO, GameOptionsDTO, NonPlayerActionType, PlayerActionType, TexasHoldemRound, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

const ME = "b521me";
const OTHER = "b521other";

const options: GameOptionsDTO = {
    minBuyIn: "1000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "500000",
    bigBlind: "1000000",
    timeout: 30000
};

function action(index: number, over: Partial<ActionDTO> = {}): ActionDTO {
    return { playerId: ME, seat: 1, action: PlayerActionType.CALL, amount: "0", round: TexasHoldemRound.PREFLOP, index, timestamp: index, ...over };
}

function snap(previousActions: ActionDTO[] = [], handNumber = 1): TexasHoldemStateDTO {
    return {
        gameOptions: options,
        players: [],
        communityCards: [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: 0,
        previousActions,
        actionCount: 5,
        handNumber,
        round: TexasHoldemRound.PREFLOP,
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: ""
    };
}

const baseline = { actionCount: 5, handNumber: 1, actionIndex: 6 };
const job = (id: number, actionName: string, base = baseline) => ({ id, actionName, baseline: base });

describe("recordedActionsFor", () => {
    it("maps the button labels to the names the chain records", () => {
        expect(recordedActionsFor("small-blind")).toEqual([PlayerActionType.SMALL_BLIND]);
        expect(recordedActionsFor("big-blind")).toEqual([PlayerActionType.BIG_BLIND]);
        expect(recordedActionsFor("deal")).toEqual([NonPlayerActionType.DEAL]);
        expect(recordedActionsFor("sit-out")).toEqual([NonPlayerActionType.SIT_OUT]);
    });

    it("accepts the all-in record for a full-stack bet, call or raise", () => {
        for (const label of ["bet", "call", "raise"]) {
            expect(recordedActionsFor(label)).toContain(PlayerActionType.ALL_IN);
        }
        expect(recordedActionsFor("fold")).not.toContain(PlayerActionType.ALL_IN);
    });

    it("assumes an unmapped label is recorded under its own name", () => {
        expect(recordedActionsFor("sit-in-and-wait")).toEqual(["sit-in-and-wait"]);
    });
});

describe("attributeEvidence", () => {
    it("matches OUR action, with the recorded name, at or after the baseline index", () => {
        const evidence = attributeEvidence([job(1, "call")], ME, snap([action(6)]));
        expect(evidence.get(1)).toEqual({ kind: "matched", action: action(6) });
    });

    it("does not match another player's identical action", () => {
        const evidence = attributeEvidence([job(1, "call")], ME, snap([action(6, { playerId: OTHER })]));
        expect(evidence.get(1)).toEqual({ kind: "none" });
    });

    it("ignores our actions from before the baseline", () => {
        const evidence = attributeEvidence([job(1, "call")], ME, snap([action(5)]));
        expect(evidence.get(1)).toEqual({ kind: "none" });
    });

    it("does not match a different action name of ours — that is a supersession", () => {
        const evidence = attributeEvidence([job(1, "call")], ME, snap([action(6, { action: PlayerActionType.FOLD })]));
        expect(evidence.get(1)).toEqual({ kind: "superseded", action: action(6, { action: PlayerActionType.FOLD }) });
    });

    it("matches the all-in record for a raise", () => {
        const evidence = attributeEvidence([job(1, "raise")], ME, snap([action(6, { action: PlayerActionType.ALL_IN })]));
        expect(evidence.get(1)?.kind).toBe("matched");
    });

    it("confirms new-hand structurally when the hand number moves past the baseline", () => {
        expect(attributeEvidence([job(1, "new-hand")], ME, snap([], 2)).get(1)).toEqual({ kind: "handAdvanced" });
        expect(attributeEvidence([job(1, "new-hand")], ME, snap([], 1)).get(1)).toEqual({ kind: "none" });
    });

    it("lets two open jobs claim distinct recorded actions, oldest job first", () => {
        const frame = snap([action(6, { action: PlayerActionType.CALL }), action(8, { action: PlayerActionType.CHECK })]);
        const evidence = attributeEvidence([job(2, "check"), job(1, "call")], ME, frame);
        expect(evidence.get(1)).toEqual({ kind: "matched", action: action(6, { action: PlayerActionType.CALL }) });
        expect(evidence.get(2)).toEqual({ kind: "matched", action: action(8, { action: PlayerActionType.CHECK }) });
    });

    it("does not read an unsettled sibling's action as superseding the job behind it", () => {
        // Job 1 (call) released as unknown; job 2 (check) executed from a state
        // that did not include job 1, so both share a baseline. The frame shows
        // both landed: job 1's call must not supersede job 2.
        const frame = snap([action(6, { action: PlayerActionType.CALL }), action(9, { action: PlayerActionType.CHECK })]);
        const evidence = attributeEvidence([job(1, "call"), job(2, "check")], ME, frame);
        expect(evidence.get(1)?.kind).toBe("matched");
        expect(evidence.get(2)?.kind).toBe("matched");
    });

    it("gives two same-name jobs two different recorded actions", () => {
        const frame = snap([action(6, { action: PlayerActionType.CHECK }), action(12, { action: PlayerActionType.CHECK })]);
        const evidence = attributeEvidence([job(1, "check"), job(2, "check")], ME, frame);
        expect((evidence.get(1) as { action: ActionDTO }).action.index).toBe(6);
        expect((evidence.get(2) as { action: ActionDTO }).action.index).toBe(12);
    });

    it("yields none without a snapshot or an address", () => {
        expect(attributeEvidence([job(1, "call")], ME, undefined).get(1)).toEqual({ kind: "none" });
        expect(attributeEvidence([job(1, "call")], null, snap([action(6)])).get(1)).toEqual({ kind: "none" });
    });
});
