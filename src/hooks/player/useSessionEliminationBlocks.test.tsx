import { renderHook, waitFor } from "@testing-library/react";
import { useSessionEliminationBlocks } from "./useSessionEliminationBlocks";

const mockApi = { getSentTransactions: jest.fn() };
const mockPublicStateAt = jest.fn();
jest.mock("../../context/CosmosApiContext", () => ({
    useCosmosApi: () => mockApi,
    useCometRpcApiFactory: () => (url: string) => ({ url })
}));
jest.mock("../../context/NetworkContext", () => ({
    useNetwork: () => ({ currentNetwork: mockNetwork }),
    NETWORK_PRESETS: [
        { name: "Block52", rpc: "https://node1.block52.xyz/rpc/", rest: "", grpc: "", ws: "" },
        { name: "Texas Hodl", rpc: "https://node.texashodl.net/rpc/", rest: "", grpc: "", ws: "" }
    ]
}));
jest.mock("../../utils/chainHistory", () => {
    const actual = jest.requireActual("../../utils/chainHistory");
    return { ...actual, publicStateAt: (...args: unknown[]) => mockPublicStateAt(...args) };
});

let mockNetwork: { name: string; rpc: string } = { name: "Block52", rpc: "https://node1.block52.xyz/rpc/" };

const PLAYER = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";
const GAME = "0x7db1aa4491963b889ad43dd7213d11e383b1052aacb9ceafe3099b42ae0797e7";

beforeEach(() => {
    mockNetwork = { name: "Block52", rpc: "https://node1.block52.xyz/rpc/" };
    mockApi.getSentTransactions.mockReset();
    mockPublicStateAt.mockReset();
});

test("stores the hand_ended block where the public state first shows the bust", async () => {
    mockApi.getSentTransactions.mockImplementation(async (query: string) => {
        const hand = /hand_number='(\d+)'/.exec(query)?.[1];
        const height = hand === "1" ? "100" : "110";
        return {
            tx_responses: [{ code: 0, height, events: [{ type: "hand_ended", attributes: [{ key: "block_height", value: height }] }] }]
        };
    });
    mockPublicStateAt.mockImplementation(async (_rpc: unknown, _gameId: string, height: number) => ({
        results: height >= 110 ? [{ place: 5, playerId: PLAYER, payout: "0" }] : [],
        players: [{ address: PLAYER, status: height >= 110 ? "busted" : "active", stack: height >= 110 ? "0" : "1500" }]
    }));
    const { result } = renderHook(() => useSessionEliminationBlocks(PLAYER, [{ gameId: GAME, handCount: 2 }]));
    await waitFor(() => expect(result.current[GAME]).toBe(110));
    expect(mockApi.getSentTransactions).toHaveBeenCalledWith(`hand_ended.game_id='${GAME}' AND hand_ended.hand_number='1'`, { limit: 5, page: 1 });
});

test("a failed lookup is recorded as not found", async () => {
    mockApi.getSentTransactions.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useSessionEliminationBlocks(PLAYER, [{ gameId: GAME, handCount: 1 }]));
    await waitFor(() => expect(result.current[GAME]).toBeNull());
});

test("retries a pruned height on Block52 and keeps any other error on the selected node", async () => {
    mockNetwork = { name: "Texas Hodl", rpc: "https://node.texashodl.net/rpc/" };
    mockApi.getSentTransactions.mockResolvedValue({
        tx_responses: [{ code: 0, height: "700000", events: [{ type: "hand_ended", attributes: [{ key: "block_height", value: "700000" }] }] }]
    });
    mockPublicStateAt.mockImplementation(async (rpc: { url: string }) => {
        if (rpc.url === "https://node.texashodl.net/rpc/") {
            throw new Error("failed to load state at height 700000; version does not exist");
        }
        return { results: [{ place: 4, playerId: PLAYER, payout: "0" }], players: [] };
    });
    const pruned = renderHook(() => useSessionEliminationBlocks(PLAYER, [{ gameId: GAME, handCount: 1 }]));
    await waitFor(() => expect(pruned.result.current[GAME]).toBe(700000));
    expect(mockPublicStateAt).toHaveBeenCalledWith(expect.objectContaining({ url: "https://node1.block52.xyz/rpc/" }), GAME, 700000);
    pruned.unmount();

    mockPublicStateAt.mockReset();
    mockPublicStateAt.mockRejectedValue(new Error("rpc error: code = NotFound desc = game state with ID"));
    const missing = renderHook(() => useSessionEliminationBlocks("b521otherplayer", [{ gameId: GAME, handCount: 1 }]));
    await waitFor(() => expect(missing.result.current[GAME]).toBeNull());
    expect(mockPublicStateAt).toHaveBeenCalledTimes(1);
});

test("does not keep another player's blocks", async () => {
    mockApi.getSentTransactions.mockResolvedValue({
        tx_responses: [{ code: 0, height: "10", events: [{ type: "hand_ended", attributes: [{ key: "block_height", value: "10" }] }] }]
    });
    mockPublicStateAt.mockResolvedValue({
        results: [{ place: 2, playerId: PLAYER, payout: "0" }],
        players: []
    });
    const { result, rerender } = renderHook(({ player }) => useSessionEliminationBlocks(player, [{ gameId: GAME, handCount: 1 }]), {
        initialProps: { player: PLAYER }
    });
    await waitFor(() => expect(result.current[GAME]).toBe(10));
    rerender({ player: "b521other" });
    expect(result.current[GAME]).toBeUndefined();
});
