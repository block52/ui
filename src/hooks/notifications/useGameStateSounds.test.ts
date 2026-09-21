import { renderHook, act } from "@testing-library/react";
import { useGameStateSounds, SOUND_STAGGER_MS, MAX_SOUNDS_PER_FRAME } from "./useGameStateSounds";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import { useActionSounds } from "./useActionSounds";
import { DEFAULT_DECORATION, GameEvent, GameStreamItem, SoundHint } from "../../bus/types";

jest.mock("../../context/gameState/GameEventsContext");
jest.mock("./useActionSounds");

const mockUseGameEventsContext = useGameEventsContext as jest.MockedFunction<typeof useGameEventsContext>;
const mockUseActionSounds = useActionSounds as jest.MockedFunction<typeof useActionSounds>;

function makeItem(sounds: SoundHint[], events: GameEvent[] = []): GameStreamItem {
    return {
        seq: 1,
        receivedAt: 0,
        kind: "state",
        classified: { kind: "actionAccepted" } as GameStreamItem["classified"],
        events,
        decoration: { ...DEFAULT_DECORATION, sounds },
        raw: {},
        synthetic: false
    };
}

describe("useGameStateSounds", () => {
    const playActionSound = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseActionSounds.mockReturnValue({ playActionSound });
        mockUseGameEventsContext.mockReturnValue({ latestItem: null, ackAnimation: jest.fn() });
    });

    describe("decoration.sounds hints", () => {
        it("plays a single-action frame's sound immediately, with no timer tick", () => {
            mockUseGameEventsContext.mockReturnValue({ latestItem: makeItem([{ kind: "call" }]), ackAnimation: jest.fn() });
            renderHook(() => useGameStateSounds(true));
            expect(playActionSound).toHaveBeenCalledTimes(1);
            expect(playActionSound).toHaveBeenCalledWith("call");
        });

        it("plays nothing when there are no sound hints", () => {
            mockUseGameEventsContext.mockReturnValue({ latestItem: makeItem([]), ackAnimation: jest.fn() });
            renderHook(() => useGameStateSounds(true));
            expect(playActionSound).not.toHaveBeenCalled();
        });

        it("does nothing when sounds are disabled", () => {
            mockUseGameEventsContext.mockReturnValue({ latestItem: makeItem([{ kind: "call" }]), ackAnimation: jest.fn() });
            renderHook(() => useGameStateSounds(false));
            expect(playActionSound).not.toHaveBeenCalled();
        });

        it("does nothing before the first commit", () => {
            renderHook(() => useGameStateSounds(true));
            expect(playActionSound).not.toHaveBeenCalled();
        });
    });

    // ui#624: only the newest hint of a frame used to play, so in a multi-action
    // frame the earlier actions were silent and the one sound you heard could
    // belong to a different action than the one on screen.
    describe("multi-action frames", () => {
        const frame = (sounds: SoundHint[], seq: number): GameStreamItem => ({ ...makeItem(sounds), seq });

        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        it("plays every hint, in action order, one stagger apart", () => {
            mockUseGameEventsContext.mockReturnValue({
                latestItem: makeItem([{ kind: "raise" }, { kind: "fold" }, { kind: "call" }]),
                ackAnimation: jest.fn()
            });
            renderHook(() => useGameStateSounds(true));
            expect(playActionSound.mock.calls).toEqual([["raise"]]);

            act(() => jest.advanceTimersByTime(SOUND_STAGGER_MS));
            expect(playActionSound.mock.calls).toEqual([["raise"], ["fold"]]);

            act(() => jest.advanceTimersByTime(SOUND_STAGGER_MS));
            expect(playActionSound.mock.calls).toEqual([["raise"], ["fold"], ["call"]]);
        });

        it("does not let the next frame swallow the previous frame's pending sounds", () => {
            mockUseGameEventsContext.mockReturnValue({ latestItem: frame([{ kind: "raise" }, { kind: "fold" }], 1), ackAnimation: jest.fn() });
            const { rerender } = renderHook(() => useGameStateSounds(true));

            // The next commit lands inside the stagger window.
            act(() => jest.advanceTimersByTime(SOUND_STAGGER_MS / 2));
            mockUseGameEventsContext.mockReturnValue({ latestItem: frame([{ kind: "call" }], 2), ackAnimation: jest.fn() });
            rerender();
            act(() => jest.advanceTimersByTime(SOUND_STAGGER_MS));

            expect(playActionSound.mock.calls.map(([kind]) => kind).sort()).toEqual(["call", "fold", "raise"]);
        });

        it("keeps only the newest sounds of a catch-up burst", () => {
            const burst: SoundHint[] = Array.from({ length: MAX_SOUNDS_PER_FRAME + 3 }, (_, i) => ({ kind: i % 2 ? "call" : "fold", seat: i }));
            mockUseGameEventsContext.mockReturnValue({ latestItem: makeItem([...burst.slice(0, -1), { kind: "all-in" }]), ackAnimation: jest.fn() });
            renderHook(() => useGameStateSounds(true));
            act(() => jest.advanceTimersByTime(SOUND_STAGGER_MS * (MAX_SOUNDS_PER_FRAME + 5)));

            expect(playActionSound).toHaveBeenCalledTimes(MAX_SOUNDS_PER_FRAME);
            expect(playActionSound).toHaveBeenLastCalledWith("all-in");
        });

        it("cancels pending sounds when sounds are switched off, and on unmount", () => {
            mockUseGameEventsContext.mockReturnValue({ latestItem: makeItem([{ kind: "raise" }, { kind: "fold" }]), ackAnimation: jest.fn() });
            const { rerender, unmount } = renderHook(({ enabled }) => useGameStateSounds(enabled), { initialProps: { enabled: true } });
            rerender({ enabled: false });
            act(() => jest.advanceTimersByTime(SOUND_STAGGER_MS * 2));
            expect(playActionSound.mock.calls).toEqual([["raise"]]);

            playActionSound.mockClear();
            mockUseGameEventsContext.mockReturnValue({ latestItem: frame([{ kind: "bet" }, { kind: "call" }], 2), ackAnimation: jest.fn() });
            rerender({ enabled: true });
            unmount();
            act(() => jest.advanceTimersByTime(SOUND_STAGGER_MS * 2));
            expect(playActionSound.mock.calls).toEqual([["bet"]]);
        });
    });
});
