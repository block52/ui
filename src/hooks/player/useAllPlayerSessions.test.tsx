import { renderHook, waitFor } from "@testing-library/react";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerSession } from "../../types/players";
import { useAllPlayerSessions } from "./usePlayerSessions";

jest.mock("../../context/IndexerApiContext", () => ({ useIndexerApi: jest.fn() }));

const getPlayerSessions = jest.fn();
(useIndexerApi as jest.Mock).mockReturnValue({ getPlayerSessions });

const PLAYER = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";

const session = (game_id: string): PlayerSession => ({
    player_address: PLAYER,
    game_id,
    join_block: 10,
    buy_in_amount: 10000,
    cash_out_amount: 0,
    created_at: "2026-01-01T00:00:00Z"
});

const page = (data: PlayerSession[], total: number) => ({ data, pagination: { limit: 1000, offset: 0, total } });

beforeEach(() => getPlayerSessions.mockReset());

test("reads every session page so the game filter can see the whole history", async () => {
    getPlayerSessions.mockResolvedValueOnce(page([session("0xa")], 2)).mockResolvedValueOnce(page([session("0xb")], 2));
    const { result } = renderHook(() => useAllPlayerSessions(PLAYER));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions.map(row => row.game_id)).toEqual(["0xa", "0xb"]);
    expect(result.current.total).toBe(2);
    expect(getPlayerSessions).toHaveBeenNthCalledWith(1, PLAYER, 1000, 0);
    expect(getPlayerSessions).toHaveBeenNthCalledWith(2, PLAYER, 1000, 1);
});

test("a failed read leaves the history empty", async () => {
    getPlayerSessions.mockRejectedValue(new Error("indexer down"));
    const { result } = renderHook(() => useAllPlayerSessions(PLAYER));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toEqual([]);
    expect(result.current.error).toBe("indexer down");
});

test("does nothing without an address", () => {
    const { result } = renderHook(() => useAllPlayerSessions(undefined));
    expect(getPlayerSessions).not.toHaveBeenCalled();
    expect(result.current.sessions).toEqual([]);
    expect(result.current.loading).toBe(false);
});
