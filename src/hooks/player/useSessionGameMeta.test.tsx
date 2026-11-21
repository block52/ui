import { renderHook, waitFor } from "@testing-library/react";
import { clearGameFormatCache } from "../../utils/transactionUtils";
import { useSessionGameMeta } from "./useSessionGameMeta";

const mockApi = { getGame: jest.fn() };
jest.mock("../../context/CosmosApiContext", () => ({ useCosmosApi: () => mockApi }));

const game = (format: string) => ({
    game: JSON.stringify({
        format,
        variant: "texas-holdem",
        gameState: { gameOptions: { bettingLimit: "no-limit", smallBlind: "10", bigBlind: "20", minBuyIn: "10000", maxBuyIn: "10000" } }
    })
});

beforeEach(() => {
    clearGameFormatCache();
    mockApi.getGame.mockReset();
});

test("loads each game once and reuses the cache for the same ids", async () => {
    mockApi.getGame.mockImplementation(async (id: string) => game(id === "0xcash" ? "cash" : "sit-and-go"));
    const { result, rerender } = renderHook(({ ids }: { ids: string[] }) => useSessionGameMeta(ids), {
        initialProps: { ids: ["0xcash", "0xcash", "0xsng"] }
    });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockApi.getGame.mock.calls.map(call => call[0]).sort()).toEqual(["0xcash", "0xsng"]);
    expect(result.current.byId["0xcash"]?.format).toBe("cash");
    expect(result.current.byId["0xsng"]?.variant).toBe("texas-holdem");

    rerender({ ids: ["0xsng", "0xcash"] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockApi.getGame).toHaveBeenCalledTimes(2);
});

test("an unknown game is an empty record so the row is not given a type", async () => {
    mockApi.getGame.mockRejectedValue(new Error("not found"));
    const { result } = renderHook(() => useSessionGameMeta(["0xmissing"]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.byId["0xmissing"]).toEqual({});
});

test("does not keep the previous player's games while the next set loads", async () => {
    let resolveNext: (value: unknown) => void = () => undefined;
    mockApi.getGame.mockImplementation((id: string) =>
        id === "0xnext"
            ? new Promise(resolve => {
                  resolveNext = resolve;
              })
            : Promise.resolve(game("cash"))
    );
    const { result, rerender } = renderHook(({ ids }: { ids: string[] }) => useSessionGameMeta(ids), { initialProps: { ids: ["0xfirst"] } });
    await waitFor(() => expect(result.current.byId["0xfirst"]?.format).toBe("cash"));
    rerender({ ids: ["0xnext"] });
    expect(result.current.loading).toBe(true);
    expect(result.current.byId).toEqual({});
    resolveNext(game("tournament"));
    await waitFor(() => expect(result.current.byId["0xnext"]?.format).toBe("tournament"));
});
