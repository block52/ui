import { renderHook, waitFor } from "@testing-library/react";
import { PlayerActionType } from "@block52/poker-vm-sdk";
import { clearHandContributionCache, useHandContributions, usePlayingStyle } from "./useHandContributions";

const mockPublicStateAt = jest.fn();
jest.mock("../../utils/chainHistory", () => {
    const actual = jest.requireActual("../../utils/chainHistory");
    return { ...actual, publicStateAt: (...args: unknown[]) => mockPublicStateAt(...args) };
});
jest.mock("../../context/CosmosApiContext", () => ({
    useCometRpcApiFactory: () => (url: string) => ({ url })
}));
jest.mock("../../context/NetworkContext", () => ({
    useNetwork: () => ({ currentNetwork: mockNetwork }),
    NETWORK_PRESETS: [
        { name: "Block52", rpc: "https://node1.block52.xyz/rpc/", rest: "", grpc: "", ws: "" },
        { name: "Texas Hodl", rpc: "https://node.texashodl.net/rpc/", rest: "", grpc: "", ws: "" }
    ]
}));

let mockNetwork: { name: string; rpc: string; rest: string; grpc: string; ws: string } = {
    name: "Block52",
    rpc: "https://node1.block52.xyz/rpc/",
    rest: "",
    grpc: "",
    ws: ""
};

const PLAYER = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";
const GAME = "0x3c3253dd13fdda80cf632efcc8e3662baa87da56";
const HAND = { gameId: GAME, handNumber: 147, blockHeight: 1028644 };

beforeEach(() => {
    mockNetwork = { name: "Block52", rpc: "https://node1.block52.xyz/rpc/", rest: "", grpc: "", ws: "" };
    clearHandContributionCache();
    mockPublicStateAt.mockReset();
});

test("reads the contribution from the hand's end block and does not ask again", async () => {
    mockPublicStateAt.mockResolvedValue({
        handNumber: 147,
        previousActions: [
            { playerId: "b521other", action: PlayerActionType.SMALL_BLIND, amount: "750" },
            { playerId: PLAYER, action: PlayerActionType.BIG_BLIND, amount: "1500" },
            { playerId: "b521other", action: PlayerActionType.FOLD, amount: "" }
        ]
    });
    const { result, unmount } = renderHook(() => useHandContributions(PLAYER, [HAND], true));
    expect(result.current.pending).toBe(true);
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.byKey[`${GAME}#147`]).toBe(1500);
    expect(result.current.unavailable).toBe(0);
    expect(mockPublicStateAt).toHaveBeenCalledWith(expect.anything(), GAME, 1028644);
    const calls = mockPublicStateAt.mock.calls.length;
    unmount();
    const again = renderHook(() => useHandContributions(PLAYER, [HAND], true));
    expect(again.result.current.pending).toBe(false);
    expect(again.result.current.byKey[`${GAME}#147`]).toBe(1500);
    expect(mockPublicStateAt.mock.calls.length).toBe(calls);
});

test("records a hand the node no longer has instead of a zero contribution", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockPublicStateAt.mockRejectedValue(new Error("version does not exist"));
    const { result } = renderHook(() => useHandContributions(PLAYER, [HAND], true));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.unavailable).toBe(1);
    expect(result.current.byKey).toEqual({});
    error.mockRestore();
});

test("retries a pruned height on Block52 and does not retry any other error", async () => {
    mockNetwork = { name: "Texas Hodl", rpc: "https://node.texashodl.net/rpc/", rest: "", grpc: "", ws: "" };
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockPublicStateAt.mockImplementation(async (rpc: { url: string }) => {
        if (rpc.url === "https://node.texashodl.net/rpc/") throw new Error("failed to load state at height 1028644; version does not exist");
        return {
            handNumber: 147,
            previousActions: [
                { playerId: "b521other", action: PlayerActionType.SMALL_BLIND, amount: "750" },
                { playerId: PLAYER, action: PlayerActionType.BIG_BLIND, amount: "1500" },
                { playerId: "b521other", action: PlayerActionType.FOLD, amount: "" }
            ]
        };
    });
    const pruned = renderHook(() => useHandContributions(PLAYER, [HAND], true));
    await waitFor(() => expect(pruned.result.current.byKey[`${GAME}#147`]).toBe(1500));
    expect(mockPublicStateAt).toHaveBeenCalledWith(expect.objectContaining({ url: "https://node1.block52.xyz/rpc/" }), GAME, 1028644);
    pruned.unmount();
    clearHandContributionCache();

    mockPublicStateAt.mockReset();
    mockPublicStateAt.mockRejectedValue(new Error("rpc error: code = NotFound desc = game state with ID"));
    const missing = renderHook(() => useHandContributions(PLAYER, [{ gameId: GAME, handNumber: 2, blockHeight: 50 }], true));
    await waitFor(() => expect(missing.result.current.unavailable).toBe(1));
    expect(mockPublicStateAt.mock.calls.every(call => call[0].url === "https://node.texashodl.net/rpc/")).toBe(true);
    error.mockRestore();
});

test("playing style and hand profit share one snapshot read", async () => {
    mockPublicStateAt.mockResolvedValue({
        handNumber: 147,
        round: "end",
        communityCards: [],
        winners: [],
        previousActions: [
            { playerId: "b521other", action: PlayerActionType.SMALL_BLIND, amount: "750", round: "ante" },
            { playerId: PLAYER, action: PlayerActionType.BIG_BLIND, amount: "1500", round: "ante" },
            { playerId: "b521other", action: PlayerActionType.FOLD, amount: "0", round: "preflop" }
        ]
    });
    const { result } = renderHook(() => {
        const profit = useHandContributions(PLAYER, [HAND], true);
        const style = usePlayingStyle(PLAYER, [{ ...HAND, wonAmount: 2250 }], true);
        return { profit, style };
    });
    await waitFor(() => expect(result.current.style.pending).toBe(false));
    expect(result.current.profit.pending).toBe(false);
    expect(mockPublicStateAt).toHaveBeenCalledTimes(1);
    expect(result.current.profit.byKey[`${GAME}#147`]).toBe(1500);
    expect(result.current.style.unavailable).toBe(0);
    expect(result.current.style.dealt).toBe(1);
    expect(result.current.style.counts).toMatchObject({ hands: 1, vpip: 0, pfr: 0, showdown: 0, wonShowdown: 0 });
});

test("counts a dealt hand once and does not count a sit-out the log can still read", async () => {
    mockPublicStateAt.mockImplementation(async (_rpc: unknown, _gameId: string, height: number) => {
        if (height === 1028644) {
            return {
                handNumber: 147,
                previousActions: [{ playerId: PLAYER, action: PlayerActionType.FOLD, amount: "", round: "preflop" }]
            };
        }
        return {
            handNumber: 2,
            previousActions: [{ playerId: PLAYER, action: "sit-out", amount: "", round: "" }]
        };
    });
    const satOut = { gameId: "0xsng", handNumber: 2, blockHeight: 50, wonAmount: 0 };
    const { result } = renderHook(() => usePlayingStyle(PLAYER, [{ ...HAND, wonAmount: 0 }, { ...HAND, wonAmount: 9 }, satOut], true));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.dealt).toBe(1);
    expect(result.current.counts.hands).toBe(2);
    expect(result.current.unavailable).toBe(0);
});

test("does not read while the selection has no single money unit", async () => {
    const { result } = renderHook(() => useHandContributions(PLAYER, [HAND], false));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(mockPublicStateAt).not.toHaveBeenCalled();
    expect(result.current.byKey).toEqual({});
});
