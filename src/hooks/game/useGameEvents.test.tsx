import React from "react";
import { renderHook } from "@testing-library/react";
import { useGameEvents } from "./useGameEvents";
import { GameEventsProvider } from "../../context/gameState/GameEventsContext";
import type { GameStreamItem, GameEvent } from "../../bus/types";
import { DEFAULT_DECORATION } from "../../bus/types";
import { ActionDTO, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";

function makeAction(index: number, action: PlayerActionType = PlayerActionType.CHECK): ActionDTO {
    return {
        playerId: "b521alice",
        seat: 1,
        action,
        amount: "0",
        round: TexasHoldemRound.PREFLOP,
        index,
        timestamp: index
    };
}

function makeItem(events: GameEvent[]): GameStreamItem {
    return {
        seq: 1,
        receivedAt: 0,
        kind: "state",
        // classified is not read by the hook; a minimal error shape keeps the type valid.
        classified: { kind: "actionAccepted" },
        events,
        decoration: { ...DEFAULT_DECORATION },
        raw: {},
        synthetic: false
    };
}

function wrapperFor(latestItem: GameStreamItem | null) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return <GameEventsProvider latestItem={latestItem} ackAnimation={() => {}}>{children}</GameEventsProvider>;
    };
}

describe("useGameEvents", () => {
    it("returns an empty array before any commit (latestItem null)", () => {
        const { result } = renderHook(() => useGameEvents(), { wrapper: wrapperFor(null) });
        expect(result.current).toEqual([]);
    });

    it("returns all events of the latest committed item", () => {
        const events: GameEvent[] = [
            { type: "handStarted", handNumber: 4 },
            { type: "playerActed", action: makeAction(34, PlayerActionType.CALL) }
        ];
        const { result } = renderHook(() => useGameEvents(), { wrapper: wrapperFor(makeItem(events)) });
        expect(result.current).toEqual(events);
    });

    it("narrows to a single event type when filtered", () => {
        const events: GameEvent[] = [
            { type: "handStarted", handNumber: 4 },
            { type: "playerActed", action: makeAction(34) },
            { type: "playerActed", action: makeAction(35, PlayerActionType.BET) },
            { type: "roundAdvanced", from: TexasHoldemRound.PREFLOP, to: TexasHoldemRound.FLOP, newCommunityCards: ["7C", "7H", "QC"] }
        ];
        const { result } = renderHook(() => useGameEvents("playerActed"), { wrapper: wrapperFor(makeItem(events)) });
        expect(result.current).toHaveLength(2);
        expect(result.current.map(e => e.action.index)).toEqual([34, 35]);
    });

    it("returns a stable reference across re-renders with the same item", () => {
        const item = makeItem([{ type: "handStarted", handNumber: 1 }]);
        const { result, rerender } = renderHook(() => useGameEvents("handStarted"), { wrapper: wrapperFor(item) });
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });

    it("updates when a new item commits", () => {
        let currentItem: GameStreamItem | null = makeItem([{ type: "handStarted", handNumber: 1 }]);
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <GameEventsProvider latestItem={currentItem} ackAnimation={() => {}}>{children}</GameEventsProvider>
        );
        const { result, rerender } = renderHook(() => useGameEvents(), { wrapper });
        expect(result.current).toEqual([{ type: "handStarted", handNumber: 1 }]);

        currentItem = makeItem([{ type: "handStarted", handNumber: 2 }]);
        rerender();
        expect(result.current).toEqual([{ type: "handStarted", handNumber: 2 }]);
    });
});
