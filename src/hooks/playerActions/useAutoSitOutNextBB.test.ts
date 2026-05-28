import { renderHook } from "@testing-library/react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { useAutoSitOutNextBB } from "./useAutoSitOutNextBB";
import { sitOut, SIT_OUT_METHOD_NEXT_HAND } from "./sitOut";

jest.mock("./sitOut", () => {
    const actual = jest.requireActual("./sitOut");
    return {
        ...actual,
        sitOut: jest.fn().mockResolvedValue({ hash: "0xtx", gameId: "table-1", action: "sit-out" })
    };
});

const mockedSitOut = sitOut as jest.MockedFunction<typeof sitOut>;
const fakeNetwork = { name: "testnet", rpc: "http://x", rest: "http://y" } as unknown as NetworkEndpoints;

describe("useAutoSitOutNextBB", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("does not fire when disabled even if BB matches seat", () => {
        renderHook(() =>
            useAutoSitOutNextBB("table-1", fakeNetwork, 3, 3, false)
        );
        expect(mockedSitOut).not.toHaveBeenCalled();
    });

    it("does not fire when BB is not on the user's seat", () => {
        renderHook(() =>
            useAutoSitOutNextBB("table-1", fakeNetwork, 3, 5, true)
        );
        expect(mockedSitOut).not.toHaveBeenCalled();
    });

    it("fires SIT_OUT(next-hand) once when enabled and BB lands on user's seat", async () => {
        const onComplete = jest.fn();
        renderHook(() =>
            useAutoSitOutNextBB("table-1", fakeNetwork, 3, 3, true, onComplete)
        );

        // give the promise a microtask to resolve
        await Promise.resolve();
        await Promise.resolve();

        expect(mockedSitOut).toHaveBeenCalledTimes(1);
        expect(mockedSitOut).toHaveBeenCalledWith("table-1", fakeNetwork, SIT_OUT_METHOD_NEXT_HAND);
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("does not re-fire while BB stays on the seat across re-renders", async () => {
        const { rerender } = renderHook(
            ({ bb }: { bb: number }) =>
                useAutoSitOutNextBB("table-1", fakeNetwork, 3, bb, true),
            { initialProps: { bb: 3 } }
        );
        await Promise.resolve();
        expect(mockedSitOut).toHaveBeenCalledTimes(1);

        rerender({ bb: 3 });
        rerender({ bb: 3 });
        await Promise.resolve();
        expect(mockedSitOut).toHaveBeenCalledTimes(1);
    });

    it("re-arms and fires again when BB moves off then back onto the seat", async () => {
        const { rerender } = renderHook(
            ({ bb }: { bb: number }) =>
                useAutoSitOutNextBB("table-1", fakeNetwork, 3, bb, true),
            { initialProps: { bb: 3 } }
        );
        await Promise.resolve();
        expect(mockedSitOut).toHaveBeenCalledTimes(1);

        // BB moves away (new hand) → arm reset
        rerender({ bb: 4 });
        await Promise.resolve();
        // BB orbits all the way back
        rerender({ bb: 3 });
        await Promise.resolve();
        await Promise.resolve();

        expect(mockedSitOut).toHaveBeenCalledTimes(2);
    });

    it("does nothing when tableId is undefined", async () => {
        renderHook(() =>
            useAutoSitOutNextBB(undefined, fakeNetwork, 3, 3, true)
        );
        await Promise.resolve();
        expect(mockedSitOut).not.toHaveBeenCalled();
    });

    it("does nothing when userSeat is undefined", async () => {
        renderHook(() =>
            useAutoSitOutNextBB("table-1", fakeNetwork, undefined, 3, true)
        );
        await Promise.resolve();
        expect(mockedSitOut).not.toHaveBeenCalled();
    });

    it("invokes onError and still allows retry after BB moves off and back", async () => {
        const onError = jest.fn();
        mockedSitOut.mockRejectedValueOnce(new Error("chain busy"));

        const { rerender } = renderHook(
            ({ bb }: { bb: number }) =>
                useAutoSitOutNextBB("table-1", fakeNetwork, 3, bb, true, undefined, onError),
            { initialProps: { bb: 3 } }
        );
        await Promise.resolve();
        await Promise.resolve();
        expect(onError).toHaveBeenCalledTimes(1);
        expect(mockedSitOut).toHaveBeenCalledTimes(1);

        rerender({ bb: 4 });
        rerender({ bb: 3 });
        await Promise.resolve();
        await Promise.resolve();
        expect(mockedSitOut).toHaveBeenCalledTimes(2);
    });
});
