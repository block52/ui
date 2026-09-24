import { renderHook, act } from "@testing-library/react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { useSitOutControls } from "./useSitOutControls";

// Route sit-out through a mocked ActionSubmitController, as production does.
const mockSubmit = jest.fn();
jest.mock("../../context/ActionSubmitContext", () => ({
    useActionSubmit: () => ({ submit: mockSubmit, loadingAction: null, isBusy: false, lastError: null }),
}));

// Static game state; the BB never lands on the user's seat here (seat 3, BB 5),
// so the auto-sit-out effect only fires in the test that arranges a match.
const mockGameState = { bigBlindPosition: 5 as number | undefined };
jest.mock("../../context/GameStateContext", () => ({
    useGameStateContext: () => ({ gameState: mockGameState, gameFormat: undefined }),
}));

// The seat the hook reads for the auto-sit-out-on-BB check.
jest.mock("../../utils/playerSeatUtils", () => ({
    ...jest.requireActual("../../utils/playerSeatUtils"),
    findUserSeat: () => 3,
}));
jest.mock("../../utils/cosmosAccountUtils", () => ({ getCosmosAddressSync: () => "0xtest" }));

const network: NetworkEndpoints = {
    name: "test",
    rpc: "http://localhost:26657",
    rest: "http://localhost:1317",
    grpc: "localhost:9090",
    ws: "ws://localhost:26657/websocket",
};

beforeEach(() => {
    mockSubmit.mockClear();
    mockGameState.bigBlindPosition = 5;
});

describe("useSitOutControls", () => {
    it("reflects the server's pending sit-out as the next-hand checked state", () => {
        const { result } = renderHook(() => useSitOutControls("t1", network, "next-hand"));
        expect(result.current.nextHandChecked).toBe(true);
    });

    it("toggling next-hand submits a sit-out action and flips optimistically", () => {
        const { result } = renderHook(() => useSitOutControls("t1", network, null));
        expect(result.current.nextHandChecked).toBe(false);

        act(() => result.current.toggleNextHand());

        expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ actionName: "sit-out" }));
        expect(result.current.nextHandChecked).toBe(true);
    });

    it("toggling next-big-blind queues locally without submitting", () => {
        const { result } = renderHook(() => useSitOutControls("t1", network, null));

        act(() => result.current.toggleNextBb());

        expect(result.current.nextBbQueued).toBe(true);
        expect(mockSubmit).not.toHaveBeenCalled();
    });

    it("fires the auto sit-out when the BB lands on the seat and next-bb is queued", () => {
        const { result, rerender } = renderHook(() => useSitOutControls("t1", network, null));

        act(() => result.current.toggleNextBb());
        // BB rotates onto our seat (3).
        mockGameState.bigBlindPosition = 3;
        act(() => rerender());

        expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ actionName: "sit-out" }));
    });

    it("a DISABLED instance never fires the auto sit-out (single-owner invariant, ui#670)", () => {
        // The off-compact PlayerActionButtons mounts a disabled instance while the
        // compact drawer owns the live one — the disabled one must not double-submit.
        const { result, rerender } = renderHook(() => useSitOutControls("t1", network, null, false));

        act(() => result.current.toggleNextBb());
        mockGameState.bigBlindPosition = 3; // BB on our seat
        act(() => rerender());

        expect(mockSubmit).not.toHaveBeenCalled();
    });
});
