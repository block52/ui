import { act, renderHook, waitFor } from "@testing-library/react";
import { useMyHandHistory } from "./useMyHandHistory";
import { useIndexerApi } from "../../context/IndexerApiContext";
import type { PlayerHand } from "../../types/players";

// A factory mock: the real module reads import.meta.env, which Jest can't parse.
jest.mock("../../context/IndexerApiContext", () => ({ useIndexerApi: jest.fn() }));

const getPlayerHands = jest.fn();
(useIndexerApi as jest.Mock).mockReturnValue({ getPlayerHands });

const hand = (game_id: string, hand_number: number): PlayerHand => ({
    game_id,
    hand_number,
    seat: 1,
    status: "folded",
    won_amount: 0,
    block_height: 100,
    community_cards: [],
    winner_count: 1
});

const page = (hands: PlayerHand[], total: number) => ({ data: hands, pagination: { limit: 2, offset: 0, total } });

describe("useMyHandHistory (ui#721)", () => {
    beforeEach(() => getPlayerHands.mockReset());

    it("does nothing without a wallet", () => {
        const { result } = renderHook(() => useMyHandHistory(null, "net", 2));
        expect(getPlayerHands).not.toHaveBeenCalled();
        expect(result.current.hands).toEqual([]);
        expect(result.current.hasMore).toBe(false);
    });

    it("loads the first page, then appends the next on loadMore", async () => {
        getPlayerHands.mockResolvedValueOnce(page([hand("0xa", 3), hand("0xa", 2)], 3)).mockResolvedValueOnce(page([hand("0xa", 1)], 3));
        const { result } = renderHook(() => useMyHandHistory("b52me", "net", 2));

        await waitFor(() => expect(result.current.hands).toHaveLength(2));
        expect(getPlayerHands).toHaveBeenLastCalledWith("b52me", 2, 0);
        expect(result.current.hasMore).toBe(true);

        act(() => result.current.loadMore());
        await waitFor(() => expect(result.current.hands).toHaveLength(3));
        expect(getPlayerHands).toHaveBeenLastCalledWith("b52me", 2, 2);
        expect(result.current.hasMore).toBe(false);
    });

    it("starts over for another wallet and ignores the previous wallet's late reply", async () => {
        let resolveOld: (v: unknown) => void = () => {};
        getPlayerHands
            .mockReturnValueOnce(new Promise(r => (resolveOld = r)))
            .mockResolvedValueOnce(page([hand("0xb", 7)], 1));

        const { result, rerender } = renderHook(({ address }) => useMyHandHistory(address, "net", 2), { initialProps: { address: "b52old" } });
        rerender({ address: "b52new" });
        await waitFor(() => expect(result.current.hands.map(h => h.game_id)).toEqual(["0xb"]));

        await act(async () => resolveOld(page([hand("0xa", 1)], 1)));
        expect(result.current.hands.map(h => h.game_id)).toEqual(["0xb"]);
    });

    it("starts over when the network changes", async () => {
        getPlayerHands.mockResolvedValue(page([hand("0xa", 1)], 1));
        const { rerender } = renderHook(({ net }) => useMyHandHistory("b52me", net, 2), { initialProps: { net: "a" } });
        await waitFor(() => expect(getPlayerHands).toHaveBeenCalledTimes(1));
        rerender({ net: "b" });
        await waitFor(() => expect(getPlayerHands).toHaveBeenCalledTimes(2));
    });

    it("reports an error and keeps going", async () => {
        getPlayerHands.mockRejectedValueOnce({ error: "Database error", code: 500 });
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const { result } = renderHook(() => useMyHandHistory("b52me", "net", 2));
        await waitFor(() => expect(result.current.error).toBe("Database error"));
        errSpy.mockRestore();
    });
});
