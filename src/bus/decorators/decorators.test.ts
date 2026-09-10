/**
 * Decorator unit tests (WS Action Bus, Phase 3).
 *
 * Each decorator is a pure function of (item, prev); we exercise them in
 * isolation with hand-built stream items so a regression pins to a single
 * decorator, not the whole pipeline.
 */
import { showdownHold, SHOWDOWN_HOLD_MS } from "./showdownHold";
import { communityCardStagger, CARD_STAGGER_MS, DEAL_CARDS_ACK_TIMEOUT_MS } from "./communityCardStagger";
import { actionBadge } from "./actionBadge";
import { makeRemoteActionSound } from "./remoteActionSound";
import { coalesceCatchUp } from "./coalesceCatchUp";
import { DEFAULT_DECORATION, GameEvent, GameStreamItem } from "../types";
import { ActionDTO, PlayerActionType, TexasHoldemRound, WinnerDTO } from "@block52/poker-vm-sdk";

function makeItem(events: GameEvent[], kind: GameStreamItem["kind"] = "state"): GameStreamItem {
    return {
        seq: 1,
        receivedAt: 0,
        kind,
        // The decorators under test only read `events`/`kind`; classified is not
        // touched, so a minimal placeholder is safe.
        classified: { kind: "actionAccepted" } as GameStreamItem["classified"],
        events,
        decoration: { ...DEFAULT_DECORATION },
        synthetic: false,
        raw: {}
    };
}

function action(overrides: Partial<ActionDTO>): ActionDTO {
    return {
        playerId: "b521player",
        seat: 3,
        action: PlayerActionType.CHECK,
        amount: "0",
        round: TexasHoldemRound.FLOP,
        index: 5,
        timestamp: 0,
        ...overrides
    };
}

const winner: WinnerDTO = { address: "b521winner", seat: 1, amount: "100", cards: [], name: "W", description: "High Card" };

describe("showdownHold", () => {
    it("sets minDisplayMs on a handEnded commit", () => {
        const patch = showdownHold(makeItem([{ type: "handEnded", winners: [winner] }]), undefined);
        expect(patch.minDisplayMs).toBe(SHOWDOWN_HOLD_MS);
    });

    it("does nothing without a handEnded event", () => {
        const patch = showdownHold(makeItem([{ type: "playerActed", action: action({}) }]), undefined);
        expect(patch).toEqual({});
    });
});

describe("communityCardStagger", () => {
    it("emits a dealCards hint carrying the new cards on roundAdvanced", () => {
        const patch = communityCardStagger(
            makeItem([
                {
                    type: "roundAdvanced",
                    from: TexasHoldemRound.PREFLOP,
                    to: TexasHoldemRound.FLOP,
                    newCommunityCards: ["AH", "KD", "2C"]
                }
            ]),
            undefined
        );
        expect(patch.animations).toEqual([
            {
                kind: "dealCards",
                staggerMs: CARD_STAGGER_MS,
                cards: ["AH", "KD", "2C"],
                round: TexasHoldemRound.FLOP,
                // Opts into a drain-gating ack; the bus stamps ackId later.
                ackTimeoutMs: DEAL_CARDS_ACK_TIMEOUT_MS
            }
        ]);
    });

    it("fires for turn/river too (one new card), fixing the flop-only bug", () => {
        const patch = communityCardStagger(
            makeItem([
                { type: "roundAdvanced", from: TexasHoldemRound.FLOP, to: TexasHoldemRound.TURN, newCommunityCards: ["7S"] }
            ]),
            undefined
        );
        expect(patch.animations).toHaveLength(1);
        expect(patch.animations?.[0].cards).toEqual(["7S"]);
    });

    it("does nothing when the round advanced with no new cards", () => {
        const patch = communityCardStagger(
            makeItem([
                { type: "roundAdvanced", from: TexasHoldemRound.RIVER, to: TexasHoldemRound.SHOWDOWN, newCommunityCards: [] }
            ]),
            undefined
        );
        expect(patch).toEqual({});
    });
});

describe("actionBadge", () => {
    it("emits an actionBadge hint per playerActed, tagged with the seat", () => {
        const patch = actionBadge(
            makeItem([
                { type: "playerActed", action: action({ seat: 2 }) },
                { type: "playerActed", action: action({ seat: 5 }) }
            ]),
            undefined
        );
        expect(patch.animations).toEqual([
            { kind: "actionBadge", seat: 2 },
            { kind: "actionBadge", seat: 5 }
        ]);
    });

    it("does nothing without a playerActed event", () => {
        expect(actionBadge(makeItem([{ type: "handStarted", handNumber: 4 }]), undefined)).toEqual({});
    });
});

describe("remoteActionSound", () => {
    const LOCAL = "b521local";

    it("emits a resolved sound key for a non-local player's action", () => {
        const decorate = makeRemoteActionSound(() => LOCAL);
        const patch = decorate(
            makeItem([{ type: "playerActed", action: action({ playerId: "b521other", action: PlayerActionType.RAISE, seat: 4 }) }]),
            undefined
        );
        expect(patch.sounds).toEqual([{ kind: "raise", seat: 4 }]);
    });

    it("skips the local player's own action (already sounded on click)", () => {
        const decorate = makeRemoteActionSound(() => LOCAL);
        const patch = decorate(
            makeItem([{ type: "playerActed", action: action({ playerId: LOCAL, action: PlayerActionType.CALL }) }]),
            undefined
        );
        expect(patch).toEqual({});
    });

    it("skips actions that map to no sound (e.g. deal/join)", () => {
        const decorate = makeRemoteActionSound(() => LOCAL);
        const patch = decorate(
            makeItem([{ type: "playerActed", action: action({ playerId: "b521other", action: "deal" as ActionDTO["action"] }) }]),
            undefined
        );
        expect(patch).toEqual({});
    });
});

describe("coalesceCatchUp", () => {
    it("marks an intermediate state coalescible", () => {
        const patch = coalesceCatchUp(makeItem([{ type: "playerActed", action: action({}) }]), undefined);
        expect(patch.coalescible).toBe(true);
    });

    it("never marks a handEnded commit coalescible", () => {
        const patch = coalesceCatchUp(makeItem([{ type: "handEnded", winners: [winner] }]), undefined);
        expect(patch.coalescible).toBe(false);
    });

    it("never marks a handStarted commit coalescible", () => {
        const patch = coalesceCatchUp(makeItem([{ type: "handStarted", handNumber: 2 }]), undefined);
        expect(patch.coalescible).toBe(false);
    });

    it("does not classify non-state items", () => {
        expect(coalesceCatchUp(makeItem([], "pending"), undefined)).toEqual({});
    });
});
