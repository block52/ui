import { renderHook, waitFor } from "@testing-library/react";
import { usePlayerTournamentEntries } from "./usePlayerTournamentEntries";

const mockApi = { getAllTransactionsMatching: jest.fn(), getTournament: jest.fn() };
jest.mock("../../context/CosmosApiContext", () => ({ useCosmosApi: () => mockApi }));

const PLAYER = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";
const TID = "0x275a79b9258009e0a1f4f4f4232cefe25262765f0a5c7c3a86040885ffec5187";

const search = {
    tx_responses: [
        {
            code: 0,
            height: "1059332",
            txhash: "REG",
            events: [
                {
                    type: "tournament_registered",
                    attributes: [
                        { key: "tournament_id", value: TID },
                        { key: "player", value: PLAYER },
                        { key: "buy_in", value: "2000000" },
                        { key: "entry_fee", value: "200000" }
                    ]
                }
            ]
        }
    ]
};

const tournament = {
    tournament: JSON.stringify({
        tournamentId: TID,
        status: "finished",
        level: 1,
        options: { buyIn: "2000000", entryFee: "200000", blindStructure: { levels: [] } },
        entrants: [],
        tables: [{ tableId: `${TID}/t1`, ordinal: 1 }],
        results: [{ place: 6, playerId: PLAYER, payout: "0" }],
        prizePool: "0",
        payouts: [],
        seq: 1
    })
};

beforeEach(() => {
    mockApi.getAllTransactionsMatching.mockReset();
    mockApi.getTournament.mockReset();
});

test("reads registrations and each tournament from the configured node", async () => {
    mockApi.getAllTransactionsMatching.mockImplementation((query: string) => {
        if (query.startsWith("tournament_unregistered")) return Promise.resolve({ tx_responses: [] });
        return Promise.resolve(search);
    });
    mockApi.getTournament.mockResolvedValue(tournament);
    const { result } = renderHook(() => usePlayerTournamentEntries(PLAYER));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockApi.getAllTransactionsMatching).toHaveBeenCalledWith(`tournament_registered.player='${PLAYER}'`);
    expect(mockApi.getAllTransactionsMatching).toHaveBeenCalledWith(`tournament_unregistered.player='${PLAYER}'`);
    expect(mockApi.getTournament).toHaveBeenCalledWith(TID);
    expect(result.current.entries).toEqual([
        {
            tournamentId: TID,
            registerHeight: 1_059_332,
            buyIn: 2_200_000,
            gameId: `${TID}-t1`,
            tableGameIds: [`${TID}-t1`],
            status: "finished",
            results: [{ place: 6, playerId: PLAYER, payout: "0" }]
        }
    ]);
    expect(result.current.registrations).toHaveLength(1);
    expect(result.current.unregistrations).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.refetch).toEqual(expect.any(Function));
});

test("attaches an unregister refund to an open entry", async () => {
    const unreg = {
        tx_responses: [
            {
                code: 0,
                height: "1091316",
                txhash: "UNREG",
                events: [
                    {
                        type: "tournament_unregistered",
                        attributes: [
                            { key: "tournament_id", value: TID },
                            { key: "player", value: PLAYER },
                            { key: "refund", value: "1600000" }
                        ]
                    }
                ]
            }
        ]
    };
    const openTournament = {
        tournament: JSON.stringify({
            tournamentId: TID,
            status: "registered",
            level: 0,
            options: { buyIn: "2000000", entryFee: "200000", blindStructure: { levels: [] } },
            entrants: [],
            tables: [{ tableId: `${TID}/t1`, ordinal: 1 }],
            results: [],
            prizePool: "0",
            payouts: [],
            seq: 1
        })
    };
    mockApi.getAllTransactionsMatching.mockImplementation((query: string) => {
        if (query.startsWith("tournament_unregistered")) return Promise.resolve(unreg);
        return Promise.resolve(search);
    });
    mockApi.getTournament.mockResolvedValue(openTournament);
    const { result } = renderHook(() => usePlayerTournamentEntries(PLAYER));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries[0]).toMatchObject({ refund: 1_600_000, unregisterHeight: 1_091_316, status: "registered" });
    expect(result.current.unregistrations).toEqual([{ tournamentId: TID, height: 1_091_316, txhash: "UNREG", refund: 1_600_000 }]);
});

test("a failed registration query leaves entries empty", async () => {
    mockApi.getAllTransactionsMatching.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => usePlayerTournamentEntries(PLAYER));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toEqual([]);
    expect(result.current.error).toBe("offline");
});

test("returns a stable empty entry list while registrations are still loading", () => {
    mockApi.getAllTransactionsMatching.mockReturnValue(new Promise(() => undefined));
    const { result, rerender } = renderHook(() => usePlayerTournamentEntries(PLAYER));
    expect(result.current.loading).toBe(true);
    const first = result.current.entries;
    expect(first).toEqual([]);
    rerender();
    expect(result.current.entries).toBe(first);
});
