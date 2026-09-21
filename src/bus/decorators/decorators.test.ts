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
import { holeCardDeal, dealingOrder, DEAL_HOLE_CARDS_KIND } from "./holeCardDeal";
import { buildDefaultDecorators } from "./index";
import { HOLE_CARD_STAGGER_MS } from "../timing";
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

describe("holeCardDeal (ui#21)", () => {
    it("orders dealt seats clockwise from the seat after the button, wrapping", () => {
        expect(dealingOrder([1, 3, 5, 7], 5)).toEqual([7, 1, 3, 5]);
        expect(dealingOrder([1, 2, 3, 4, 5, 6, 7, 8, 9], 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(dealingOrder([2, 6], 2)).toEqual([6, 2]);
        expect(dealingOrder([2, 6], 6)).toEqual([2, 6]);
    });

    it("falls back to ascending seat order without a button", () => {
        expect(dealingOrder([7, 1, 3], null)).toEqual([1, 3, 7]);
    });

    it("attaches a dealHoleCards hint carrying the seats in dealing order", () => {
        const patch = holeCardDeal(makeItem([{ type: "cardsDealt", seats: [1, 3, 5, 7], dealerSeat: 5 }]), undefined);
        expect(patch.animations).toHaveLength(1);
        const hint = patch.animations![0];
        expect(hint.kind).toBe(DEAL_HOLE_CARDS_KIND);
        expect(hint.seats).toEqual([7, 1, 3, 5]);
        expect(hint.staggerMs).toBe(HOLE_CARD_STAGGER_MS);
        // The drain-gating ack opt-in ships with the consumer (phase 2): an
        // ack-gated hint nobody consumes would hold the drain for its budget.
        expect(hint.ackTimeoutMs).toBeUndefined();
        expect(hint.ackId).toBeUndefined(); // stamped by the bus, never by a decorator
        expect(patch.minDisplayMs).toBeUndefined();
        expect(patch.holdPreviousMs).toBeUndefined();
    });

    it("does nothing without a cardsDealt event", () => {
        expect(holeCardDeal(makeItem([{ type: "handStarted", handNumber: 2 }]), undefined)).toEqual({});
        expect(holeCardDeal(makeItem([{ type: "cardsDealt", seats: [], dealerSeat: 1 }]), undefined)).toEqual({});
    });

    it("is registered in the default decorator set", () => {
        expect(buildDefaultDecorators(() => null)).toContain(holeCardDeal);
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

    it("never sounds a blind post — it used to come out as a phantom check (ui#624)", () => {
        const decorate = makeRemoteActionSound(() => LOCAL);
        const patch = decorate(
            makeItem([
                { type: "playerActed", action: action({ playerId: "b521sb", action: PlayerActionType.SMALL_BLIND, seat: 1 }) },
                { type: "playerActed", action: action({ playerId: "b521bb", action: PlayerActionType.BIG_BLIND, seat: 2 }) }
            ]),
            undefined
        );
        expect(patch).toEqual({});
    });

    it("keeps a multi-action frame's sounds in action order, blind posts dropped", () => {
        const decorate = makeRemoteActionSound(() => LOCAL);
        const patch = decorate(
            makeItem([
                { type: "playerActed", action: action({ playerId: "b521bb", action: PlayerActionType.BIG_BLIND, seat: 2 }) },
                { type: "playerActed", action: action({ playerId: "b521a", action: PlayerActionType.RAISE, seat: 3 }) },
                { type: "playerActed", action: action({ playerId: "b521b", action: PlayerActionType.FOLD, seat: 4 }) }
            ]),
            undefined
        );
        expect(patch.sounds).toEqual([
            { kind: "raise", seat: 3 },
            { kind: "fold", seat: 4 }
        ]);
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
