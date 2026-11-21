import { renderHook, waitFor } from "@testing-library/react";
import { useCosmosApi } from "../../context/CosmosApiContext";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerListItem } from "../../types/players";
import { ALL_PRIZE_CLAIMS_QUERY, PRIZE_DIRECTORY_QUERY_TIMEOUT_MS } from "../../utils/playerPrizeClaims";
import { ALL_TOURNAMENT_REGISTERED_QUERY, ALL_TOURNAMENT_UNREGISTERED_QUERY } from "../../utils/playerTournamentEntries";
import { resetPlayersDirectoryCache, usePlayersDirectory } from "./usePlayersDirectory";

jest.mock("../../context/IndexerApiContext", () => ({ useIndexerApi: jest.fn() }));
jest.mock("../../context/CosmosApiContext", () => ({ useCosmosApi: jest.fn() }));

const getPlayers = jest.fn();
const getPlayerSessions = jest.fn();
const getAllTransactionsMatching = jest.fn();
const getTournament = jest.fn();
(useIndexerApi as jest.Mock).mockReturnValue({ getPlayers, getPlayerSessions });
(useCosmosApi as jest.Mock).mockReturnValue({ getAllTransactionsMatching, getTournament });

const ALPHA = "b521alpha";
const BETA = "b521beta";
const GAMMA = "b521gamma";

const row = (player_address: string, net_profit: number): PlayerListItem => ({
    player_address,
    vip_tier: "bronze",
    rakeback_pct: 0,
    total_hands: 1,
    total_actions: 1,
    net_profit,
    total_rake_contributed: 0
});

const directory = (rows: PlayerListItem[]) => ({ data: rows, pagination: { limit: 1000, offset: 0, total: rows.length } });

const prizeTx = (player: string, amount: string, txhash: string) => ({
    code: 0,
    height: "100",
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
});

const sessionPage = (player: string, cashOut: number) => ({
    data: [
        {
            player_address: player,
            game_id: "0xabc",
            join_block: 10,
            buy_in_amount: 1,
            cash_out_amount: cashOut,
            created_at: "2026-01-01T00:00:00Z"
        }
    ],
    pagination: { limit: 1000, offset: 0, total: 1 }
});

const params = { search: "", sort: "net_profit" as const, order: "desc" as const, limit: 20, offset: 0 };

beforeEach(() => {
    resetPlayersDirectoryCache();
    getPlayers.mockReset();
    getPlayerSessions.mockReset();
    getAllTransactionsMatching.mockReset();
    getTournament.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
    (useIndexerApi as jest.Mock).mockReturnValue({ getPlayers, getPlayerSessions });
    (useCosmosApi as jest.Mock).mockReturnValue({ getAllTransactionsMatching, getTournament });
});

afterEach(() => {
    jest.restoreAllMocks();
});

test("sorts the directory by net after prizes, without counting a recorded cash-out twice", async () => {
    // Indexer order would be gamma (10), then alpha and beta at -1000.
    // Beta's unrecorded prize puts beta first. Alpha's prize is already in the cash-out.
    getPlayers.mockResolvedValue(directory([row(ALPHA, -1000), row(BETA, -1000), row(GAMMA, 10)]));
    getAllTransactionsMatching.mockResolvedValue({
        tx_responses: [prizeTx(ALPHA, "2000", "ALPHA"), prizeTx(BETA, "2000", "BETA")]
    });
    getPlayerSessions.mockImplementation((address: string) => Promise.resolve(sessionPage(address, address === ALPHA ? 2000 : 0)));

    const initialProps: { order: "asc" | "desc"; offset: number } = { order: "desc", offset: 0 };
    const { result, rerender } = renderHook(
        (props: { order: "asc" | "desc"; offset: number }) => usePlayersDirectory({ ...params, order: props.order, limit: 2, offset: props.offset }),
        { initialProps }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getAllTransactionsMatching).toHaveBeenCalledWith(ALL_PRIZE_CLAIMS_QUERY, PRIZE_DIRECTORY_QUERY_TIMEOUT_MS);
    expect(result.current.total).toBe(3);
    expect(result.current.players.map(player => [player.player_address, player.net_profit])).toEqual([
        [BETA, 1000],
        [GAMMA, 10]
    ]);
    expect(result.current.error).toBeNull();
    const sessionAddresses = getPlayerSessions.mock.calls.map(call => call[0]);
    expect(sessionAddresses).toEqual(expect.arrayContaining([ALPHA, BETA]));
    expect(sessionAddresses).not.toContain(GAMMA);

    const playerCalls = getPlayers.mock.calls.length;
    rerender({ order: "asc", offset: 0 });
    await waitFor(() => expect(result.current.players[0]?.player_address).toBe(ALPHA));
    expect(result.current.players.map(player => player.net_profit)).toEqual([-1000, 10]);
    expect(getPlayers).toHaveBeenCalledTimes(playerCalls);
});

test("a failed chain query keeps the indexer nets", async () => {
    getPlayers.mockResolvedValue(directory([row(ALPHA, -1000), row(BETA, 10)]));
    getAllTransactionsMatching.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => usePlayersDirectory({ ...params, limit: 10 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.players.map(player => [player.player_address, player.net_profit])).toEqual([
        [BETA, 10],
        [ALPHA, -1000]
    ]);
    expect(result.current.error).toBeNull();
    expect(getPlayerSessions).not.toHaveBeenCalled();
    expect(getTournament).not.toHaveBeenCalled();
    expect(getAllTransactionsMatching).toHaveBeenCalledTimes(3);
});

test("an unsupported global query reads prizes for the visible page only", async () => {
    getPlayers.mockResolvedValue(directory([row(ALPHA, 30), row(BETA, 20), row(GAMMA, 10)]));
    getAllTransactionsMatching.mockImplementation((query: string) => {
        if (query === ALL_PRIZE_CLAIMS_QUERY) return Promise.reject({ code: 13, message: "failed to search for txs" });
        if (query.includes(BETA)) return Promise.resolve({ tx_responses: [prizeTx(BETA, "100", "BETA")] });
        return Promise.resolve({ tx_responses: [] });
    });
    getPlayerSessions.mockResolvedValue(sessionPage(BETA, 0));

    const { result } = renderHook(() => usePlayersDirectory({ ...params, limit: 2 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Indexer page is alpha (30), beta (20). Beta's prize moves beta ahead of alpha. Gamma stays off-page.
    expect(result.current.total).toBe(3);
    expect(result.current.players.map(player => [player.player_address, player.net_profit])).toEqual([
        [BETA, 120],
        [ALPHA, 30]
    ]);
    const queries = getAllTransactionsMatching.mock.calls.map(call => call[0] as string);
    expect(queries).toContain(ALL_PRIZE_CLAIMS_QUERY);
    expect(queries.some(query => query.includes(BETA))).toBe(true);
    expect(queries.some(query => query.includes(GAMMA))).toBe(false);
});

const MTT = "0x522af6f3faa14816649c2e24a6ab3b951d56b5e85f7cb8803fe72f1a0127a80b";

const registrationTx = (player: string, tournamentId = MTT) => ({
    code: 0,
    height: "1123929",
    txhash: "REG",
    events: [
        {
            type: "tournament_registered",
            attributes: [
                { key: "tournament_id", value: tournamentId },
                { key: "player", value: player },
                { key: "buy_in", value: "2000000" },
                { key: "entry_fee", value: "200000" }
            ]
        }
    ]
});

const tournamentRecord = {
    tournament: JSON.stringify({
        tournamentId: MTT,
        status: "finished",
        level: 1,
        options: {
            buyIn: "2000000",
            entryFee: "200000",
            startingStack: "5000",
            seatsPerTable: 9,
            minEntrants: 2,
            maxEntrants: 27,
            startTime: 1,
            blindStructure: { levels: [] },
            actionTimeoutSeconds: 30
        },
        entrants: [],
        tables: [{ tableId: `${MTT}/t1`, ordinal: 1 }],
        prizePool: "5280000",
        results: [{ place: 2, playerId: ALPHA, payout: "5280000" }]
    })
};

test("adds MTT buy-ins and payouts to net and sorts by the profile figure", async () => {
    getPlayers.mockResolvedValue(directory([row(ALPHA, -1000), row(BETA, 10)]));
    getAllTransactionsMatching.mockImplementation((query: string) => {
        if (query === ALL_PRIZE_CLAIMS_QUERY) return Promise.resolve({ tx_responses: [prizeTx(ALPHA, "2000", "ALPHA")] });
        if (query === ALL_TOURNAMENT_REGISTERED_QUERY) return Promise.resolve({ tx_responses: [registrationTx(ALPHA)] });
        if (query === ALL_TOURNAMENT_UNREGISTERED_QUERY) return Promise.resolve({ tx_responses: [] });
        return Promise.resolve({ tx_responses: [] });
    });
    getPlayerSessions.mockResolvedValue(sessionPage(ALPHA, 0));
    getTournament.mockResolvedValue(tournamentRecord);

    const { result } = renderHook(() => usePlayersDirectory({ ...params, limit: 10 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getAllTransactionsMatching).toHaveBeenCalledWith(ALL_TOURNAMENT_REGISTERED_QUERY, PRIZE_DIRECTORY_QUERY_TIMEOUT_MS);
    expect(getTournament).toHaveBeenCalledWith(MTT);
    // Indexer -1000 + Sit & Go prize 2000 + MTT payout 5.28 - MTT buy-in 2.20.
    expect(result.current.players.map(player => [player.player_address, player.net_profit])).toEqual([
        [ALPHA, 3_081_000],
        [BETA, 10]
    ]);
});

test("a failed tournament query keeps the prize-corrected nets", async () => {
    getPlayers.mockResolvedValue(directory([row(ALPHA, -1000), row(BETA, 10)]));
    getAllTransactionsMatching.mockImplementation((query: string) => {
        if (query === ALL_PRIZE_CLAIMS_QUERY) return Promise.resolve({ tx_responses: [prizeTx(ALPHA, "2000", "ALPHA")] });
        if (query === ALL_TOURNAMENT_REGISTERED_QUERY) return Promise.reject(new Error("offline"));
        return Promise.resolve({ tx_responses: [] });
    });
    getPlayerSessions.mockResolvedValue(sessionPage(ALPHA, 0));

    const { result } = renderHook(() => usePlayersDirectory({ ...params, limit: 10 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.players.map(player => [player.player_address, player.net_profit])).toEqual([
        [ALPHA, 1000],
        [BETA, 10]
    ]);
    expect(getTournament).not.toHaveBeenCalled();
});
