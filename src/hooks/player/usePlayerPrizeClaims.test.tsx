import { renderHook, waitFor } from "@testing-library/react";
import { usePlayerPrizeClaims } from "./usePlayerPrizeClaims";

const mockApi = { getAllTransactionsMatching: jest.fn() };
jest.mock("../../context/CosmosApiContext", () => ({ useCosmosApi: () => mockApi }));

const PLAYER = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";

const response = (code: number, amount: string, txhash: string, player = PLAYER) => ({
    tx_responses: [
        {
            code,
            height: "1011858",
            txhash,
            events: [
                {
                    type: "sng_prize_claimed",
                    attributes: [
                        { key: "game_id", value: "0xabc" },
                        { key: "player", value: player },
                        { key: "amount", value: amount }
                    ]
                }
            ]
        }
    ]
});

beforeEach(() => mockApi.getAllTransactionsMatching.mockReset());

test("reads successful prize claims for the player", async () => {
    mockApi.getAllTransactionsMatching.mockResolvedValue(response(0, "6240000", "E2AF"));
    const { result } = renderHook(() => usePlayerPrizeClaims(PLAYER));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockApi.getAllTransactionsMatching).toHaveBeenCalledWith(`sng_prize_claimed.player='${PLAYER}'`);
    expect(result.current.claims).toEqual([{ gameId: "0xabc", amount: 6_240_000, height: 1011858, txhash: "E2AF" }]);
    expect(result.current.error).toBeNull();
});

test("a failed chain query leaves claims empty so the page can use the indexer", async () => {
    mockApi.getAllTransactionsMatching.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => usePlayerPrizeClaims(PLAYER));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.claims).toEqual([]);
    expect(result.current.error).toBe("offline");
});

test("a late response for the previous address is ignored", async () => {
    let resolveFirst!: (value: ReturnType<typeof response>) => void;
    mockApi.getAllTransactionsMatching
        .mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveFirst = resolve;
                })
        )
        .mockResolvedValue(response(0, "100", "SECOND", "b521other"));
    const { result, rerender } = renderHook(({ address }) => usePlayerPrizeClaims(address), { initialProps: { address: PLAYER } });
    rerender({ address: "b521other" });
    await waitFor(() => expect(result.current.claims).toEqual([{ gameId: "0xabc", amount: 100, height: 1011858, txhash: "SECOND" }]));
    resolveFirst(response(0, "6240000", "FIRST"));
    await waitFor(() => expect(result.current.claims[0]?.txhash).toBe("SECOND"));
});
