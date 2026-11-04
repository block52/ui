import { act, renderHook, waitFor } from "@testing-library/react";
import { usePlayerAwards } from "./usePlayerAwards";
import { useIndexerApi } from "../../context/IndexerApiContext";
import { MIN_AWARD_DECISIONS } from "../../utils/playerAwards";

// A factory mock: the real module reads import.meta.env, which Jest can't parse.
jest.mock("../../context/IndexerApiContext", () => ({ useIndexerApi: jest.fn() }));

const getPlayers = jest.fn();
const getPlayerProfile = jest.fn();
const getPlayerHands = jest.fn();
(useIndexerApi as jest.Mock).mockReturnValue({ getPlayers, getPlayerProfile, getPlayerHands });

const directoryRow = (player_address: string, total_actions = 500) => ({ player_address, total_actions });
const directory = (rows: ReturnType<typeof directoryRow>[]) => ({ data: rows, pagination: { limit: 1000, offset: 0, total: rows.length } });
const profileFor = (player_address: string, total_folds = 100) => ({
    player_address,
    total_bets: 0,
    total_raises: 0,
    total_calls: 0,
    total_folds,
    total_checks: 200
});
const noHands = { data: [], pagination: { limit: 1000, offset: 0, total: 0 } };
const hand = (hand_number: number, won_amount: number) => ({ game_id: "0xa", hand_number, won_amount, winner_count: 1 });
const handsPage = (hands: ReturnType<typeof hand>[]) => ({ data: hands, pagination: { limit: 1000, offset: 0, total: hands.length } });

describe("usePlayerAwards", () => {
    beforeEach(() => {
        getPlayers.mockReset();
        getPlayerProfile.mockReset();
        getPlayerHands.mockReset();
        getPlayerHands.mockResolvedValue(noHands);
        getPlayerProfile.mockImplementation((address: string) => Promise.resolve(profileFor(address)));
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        (useIndexerApi as jest.Mock).mockReturnValue({ getPlayers, getPlayerProfile, getPlayerHands });
    });

    it("computes the awards from the directory, stats and hands", async () => {
        getPlayers.mockResolvedValue(directory([directoryRow("a"), directoryRow("b")]));
        getPlayerProfile.mockImplementation((address: string) => Promise.resolve(profileFor(address, address === "a" ? 300 : 10)));

        const { result } = renderHook(() => usePlayerAwards());
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.awards.find(award => award.id === "nit")?.podium[0].address).toBe("a");
        expect(result.current.rankedPlayers).toBe(2);
        expect(result.current.failedPlayers).toBe(0);
        expect(result.current.error).toBeNull();
    });

    it("reads a small wallet's hands but not its stats", async () => {
        getPlayers.mockResolvedValue(directory([directoryRow("big", MIN_AWARD_DECISIONS), directoryRow("small", MIN_AWARD_DECISIONS - 1)]));

        const { result } = renderHook(() => usePlayerAwards());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(getPlayerProfile).toHaveBeenCalledTimes(1);
        expect(getPlayerProfile).toHaveBeenCalledWith("big");
        expect(getPlayerHands).toHaveBeenCalledWith("small", 1000, 0);
    });

    it("counts a hand a small wallet won as a loss for a ranked wallet, and leaves out a hand nobody won", async () => {
        const fortyHands = (won: number) => Array.from({ length: 40 }, (_, index) => hand(index + 1, won));
        const unrecorded = hand(99, 0);
        getPlayers.mockResolvedValue(directory([directoryRow("ranked"), directoryRow("small", 1)]));
        getPlayerHands.mockImplementation((address: string) =>
            Promise.resolve(address === "small" ? handsPage(fortyHands(100)) : handsPage([...fortyHands(0), unrecorded]))
        );

        const { result } = renderHook(() => usePlayerAwards());
        await waitFor(() => expect(result.current.loading).toBe(false));

        const cardDead = result.current.awards.find(award => award.id === "card-dead");
        expect(cardDead?.podium[0].evidence).toBe("Won 0 of 40 hands: 0%");
    });

    it("doesn't count a wallet with many actions but too few decisions as ranked", async () => {
        getPlayers.mockResolvedValue(directory([directoryRow("sits-out-a-lot")]));
        getPlayerProfile.mockResolvedValue({ ...profileFor("sits-out-a-lot", 1), total_checks: 1 });

        const { result } = renderHook(() => usePlayerAwards());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.rankedPlayers).toBe(0);
        expect(result.current.awards).toEqual([]);
        expect(result.current.error).toBeNull();
    });

    it("still shows the awards when one wallet fails, and says so", async () => {
        getPlayers.mockResolvedValue(directory([directoryRow("ok"), directoryRow("broken")]));
        getPlayerHands.mockImplementation((address: string) => (address === "broken" ? Promise.reject(new Error("500")) : Promise.resolve(noHands)));

        const { result } = renderHook(() => usePlayerAwards());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.failedPlayers).toBe(1);
        expect(result.current.rankedPlayers).toBe(1);
        expect(result.current.awards).not.toEqual([]);
        expect(result.current.error).toBeNull();
    });

    it("reports an error when every wallet fails", async () => {
        getPlayers.mockResolvedValue(directory([directoryRow("a")]));
        getPlayerProfile.mockRejectedValue(new Error("500"));

        const { result } = renderHook(() => usePlayerAwards());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).not.toBeNull();
        expect(result.current.awards).toEqual([]);
    });

    it("reports an error when the directory fails", async () => {
        getPlayers.mockRejectedValue(new Error("500"));

        const { result } = renderHook(() => usePlayerAwards());
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).not.toBeNull();
        expect(getPlayerProfile).not.toHaveBeenCalled();
    });

    it("recovers on refetch and clears the error", async () => {
        getPlayers.mockRejectedValueOnce(new Error("500")).mockResolvedValue(directory([directoryRow("a")]));

        const { result } = renderHook(() => usePlayerAwards());
        await waitFor(() => expect(result.current.error).not.toBeNull());

        act(() => {
            result.current.refetch();
        });
        await waitFor(() => expect(result.current.awards).not.toEqual([]));
        expect(result.current.error).toBeNull();
    });

    it("drops a slow reply when a newer load has started", async () => {
        let resolveOld: (value: unknown) => void = () => {};
        getPlayers
            .mockImplementationOnce(() => new Promise(resolve => (resolveOld = resolve)))
            .mockResolvedValue(directory([directoryRow("new")]));

        const { result } = renderHook(() => usePlayerAwards());
        act(() => {
            result.current.refetch();
        });
        await waitFor(() => expect(result.current.awards).not.toEqual([]));

        await act(async () => resolveOld(directory([directoryRow("old")])));
        expect(result.current.awards[0].podium[0].address).toBe("new");
    });
});
