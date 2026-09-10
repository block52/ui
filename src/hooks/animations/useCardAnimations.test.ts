import { renderHook, act } from "@testing-library/react";
import { useCardAnimations } from "./useCardAnimations";
import { useGameStateContext } from "../../context/GameStateContext";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import { DEFAULT_DECORATION, AnimationHint, GameEvent, GameStreamItem } from "../../bus/types";
import { TexasHoldemRound } from "@block52/poker-vm-sdk";

jest.mock("../../context/GameStateContext");
jest.mock("../../context/gameState/GameEventsContext");

const mockUseGameStateContext = useGameStateContext as jest.MockedFunction<typeof useGameStateContext>;
const mockUseGameEventsContext = useGameEventsContext as jest.MockedFunction<typeof useGameEventsContext>;

let ackAnimation: jest.Mock;

/** Set the events-context return, always wiring the current ackAnimation spy. */
function setLatestItem(latestItem: GameStreamItem | null) {
    mockUseGameEventsContext.mockReturnValue({ latestItem, ackAnimation });
}

let seq = 0;
function makeItem(events: GameEvent[], animations: AnimationHint[] = []): GameStreamItem {
    seq += 1;
    return {
        seq,
        receivedAt: 0,
        kind: "state",
        classified: { kind: "actionAccepted" } as GameStreamItem["classified"],
        events,
        decoration: { ...DEFAULT_DECORATION, animations },
        raw: {},
        synthetic: false
    };
}

function setCommunityCards(cards: string[]) {
    mockUseGameStateContext.mockReturnValue({ gameState: { communityCards: cards } } as ReturnType<typeof useGameStateContext>);
}

function dealHint(cards: string[], round: TexasHoldemRound, ackId?: string): AnimationHint {
    return { kind: "dealCards", staggerMs: 100, cards, round, ackId, ackTimeoutMs: ackId ? 1800 : undefined };
}

describe("useCardAnimations", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        seq = 0;
        ackAnimation = jest.fn();
        setCommunityCards([]);
        setLatestItem(null);
    });
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("drops the flop in one card at a time from a dealCards hint", () => {
        const { result, rerender } = renderHook(() => useCardAnimations());
        expect(result.current.revealedSlots.slice(0, 3)).toEqual([false, false, false]);

        setCommunityCards(["AH", "KD", "2C"]);
        setLatestItem(
            makeItem(
                [{ type: "roundAdvanced", from: TexasHoldemRound.PREFLOP, to: TexasHoldemRound.FLOP, newCommunityCards: ["AH", "KD", "2C"] }],
                [dealHint(["AH", "KD", "2C"], TexasHoldemRound.FLOP)]
            )
        );
        rerender();

        // All start hidden, then drop in one at a time at 100/200/300ms.
        expect(result.current.revealedSlots.slice(0, 3)).toEqual([false, false, false]);
        act(() => jest.advanceTimersByTime(100));
        expect(result.current.revealedSlots.slice(0, 3)).toEqual([true, false, false]);
        act(() => jest.advanceTimersByTime(100));
        expect(result.current.revealedSlots.slice(0, 3)).toEqual([true, true, false]);
        act(() => jest.advanceTimersByTime(100));
        expect(result.current.revealedSlots.slice(0, 3)).toEqual([true, true, true]);
        expect(result.current.showThreeCards).toBe(true);
    });

    it("acks the bus when the last card's drop completes (Phase 5)", () => {
        const { result, rerender } = renderHook(() => useCardAnimations());

        setCommunityCards(["AH", "KD", "2C"]);
        setLatestItem(
            makeItem(
                [{ type: "roundAdvanced", from: TexasHoldemRound.PREFLOP, to: TexasHoldemRound.FLOP, newCommunityCards: ["AH", "KD", "2C"] }],
                [dealHint(["AH", "KD", "2C"], TexasHoldemRound.FLOP, "7:0")]
            )
        );
        rerender();

        // Last slot reveals at stagger×3 = 300ms; drop finishes 1000ms later.
        act(() => jest.advanceTimersByTime(300));
        expect(result.current.revealedSlots[2]).toBe(true);
        expect(ackAnimation).not.toHaveBeenCalled();

        act(() => jest.advanceTimersByTime(1000));
        expect(ackAnimation).toHaveBeenCalledTimes(1);
        expect(ackAnimation).toHaveBeenCalledWith("7:0");
    });

    it("does not leak an ack timer after unmount (bus timeout is the backstop)", () => {
        const { rerender, unmount } = renderHook(() => useCardAnimations());

        setCommunityCards(["AH", "KD", "2C"]);
        setLatestItem(
            makeItem(
                [{ type: "roundAdvanced", from: TexasHoldemRound.PREFLOP, to: TexasHoldemRound.FLOP, newCommunityCards: ["AH", "KD", "2C"] }],
                [dealHint(["AH", "KD", "2C"], TexasHoldemRound.FLOP, "9:0")]
            )
        );
        rerender();

        // Unmount mid-animation: the ack timer must be cleared, so it never fires.
        unmount();
        act(() => jest.advanceTimersByTime(5000));
        expect(ackAnimation).not.toHaveBeenCalled();
    });

    it("RE-TRIGGERS on the turn, revealing the turn's ABSOLUTE slot (3)", () => {
        const { result, rerender } = renderHook(() => useCardAnimations());

        // Flop first.
        setCommunityCards(["AH", "KD", "2C"]);
        setLatestItem(makeItem([{ type: "roundAdvanced", from: TexasHoldemRound.PREFLOP, to: TexasHoldemRound.FLOP, newCommunityCards: ["AH", "KD", "2C"] }], [dealHint(["AH", "KD", "2C"], TexasHoldemRound.FLOP)]));
        rerender();
        act(() => jest.advanceTimersByTime(300));
        expect(result.current.revealedSlots.slice(0, 3)).toEqual([true, true, true]);

        // Turn: one new card at slot 3. The flop stays on the board; only the turn card
        // drops in (the old model incorrectly reset and pointed at slot 0).
        setCommunityCards(["AH", "KD", "2C", "7S"]);
        setLatestItem(makeItem([{ type: "roundAdvanced", from: TexasHoldemRound.FLOP, to: TexasHoldemRound.TURN, newCommunityCards: ["7S"] }], [dealHint(["7S"], TexasHoldemRound.TURN)]));
        rerender();
        // Flop cards remain; the turn slot starts hidden.
        expect(result.current.revealedSlots.slice(0, 4)).toEqual([true, true, true, false]);
        act(() => jest.advanceTimersByTime(100));
        expect(result.current.revealedSlots.slice(0, 4)).toEqual([true, true, true, true]);
    });

    it("RESETS the board on a new hand (fixes the no-reset-per-hand bug)", () => {
        const { result, rerender } = renderHook(() => useCardAnimations());

        setCommunityCards(["AH", "KD", "2C"]);
        setLatestItem(makeItem([{ type: "roundAdvanced", from: TexasHoldemRound.PREFLOP, to: TexasHoldemRound.FLOP, newCommunityCards: ["AH", "KD", "2C"] }], [dealHint(["AH", "KD", "2C"], TexasHoldemRound.FLOP)]));
        rerender();
        act(() => jest.advanceTimersByTime(300));
        expect(result.current.revealedSlots[0]).toBe(true);

        // New hand — board cleared, slots must reset.
        setCommunityCards([]);
        setLatestItem(makeItem([{ type: "handStarted", handNumber: 2 }]));
        rerender();
        expect(result.current.revealedSlots).toEqual([false, false, false, false, false]);
    });
});
