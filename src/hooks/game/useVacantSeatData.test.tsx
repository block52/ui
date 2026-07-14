import { renderHook } from "@testing-library/react";
import { GameFormat, type PlayerDTO, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useVacantSeatData } from "./useVacantSeatData";
import { STORAGE_KEYS } from "../../constants/storageKeys";

const mockUseGameStateContext = jest.fn();
jest.mock("../../context/GameStateContext", () => ({
    useGameStateContext: () => mockUseGameStateContext(),
}));

const player = (seat: number, address: string): PlayerDTO =>
    ({ seat, address } as PlayerDTO);

const setGameState = (
    overrides: Partial<TexasHoldemStateDTO>,
    gameFormat: GameFormat = GameFormat.SIT_AND_GO,
) => {
    mockUseGameStateContext.mockReturnValue({
        gameState: {
            players: [],
            results: [],
            handNumber: 1,
            gameOptions: { maxPlayers: 4 },
            ...overrides,
        } as unknown as TexasHoldemStateDTO,
        gameFormat,
        isLoading: false,
        error: null,
    });
};

beforeEach(() => {
    mockUseGameStateContext.mockReset();
    localStorage.clear();
    // A user who is NOT already seated, so join gating is exercised.
    localStorage.setItem(STORAGE_KEYS.cosmosAddress, "b521newcomer");
});

describe("useVacantSeatData — started SNG freezes joins (block52/ui#511 / poker-vm#2404)", () => {
    it("no seat is joinable in a started SNG (hand > 1) even when a seat is empty", () => {
        // Seat 3 empty (busted player evicted mid-tournament), hand 7 in progress.
        setGameState({
            players: [player(1, "b521a"), player(2, "b521b"), player(4, "b521d")],
            handNumber: 7,
            results: [{ place: 4, playerId: "b521c", payout: "0" }] as never,
        });
        const { result } = renderHook(() => useVacantSeatData());

        expect(result.current.canJoinSeat(3)).toBe(false);
        expect(result.current.availableSeatIndexes).toEqual([]);
    });

    it("no seat is joinable in an SNG that has a recorded result even on hand 1", () => {
        setGameState({
            players: [player(1, "b521a"), player(2, "b521b")],
            handNumber: 1,
            results: [{ place: 4, playerId: "b521c", payout: "0" }] as never,
        });
        const { result } = renderHook(() => useVacantSeatData());

        expect(result.current.canJoinSeat(3)).toBe(false);
        expect(result.current.availableSeatIndexes).toEqual([]);
    });

    it("pre-start SNG (hand 1, no results) still allows joining an empty seat", () => {
        setGameState({
            players: [player(1, "b521a")],
            handNumber: 1,
            results: [],
        });
        const { result } = renderHook(() => useVacantSeatData());

        expect(result.current.canJoinSeat(2)).toBe(true);
        expect(result.current.availableSeatIndexes).toContain(2);
    });

    it("cash game seat availability is unaffected by the SNG guard", () => {
        setGameState(
            {
                players: [player(1, "b521a")],
                handNumber: 12,
                results: [],
            },
            GameFormat.CASH,
        );
        const { result } = renderHook(() => useVacantSeatData());

        expect(result.current.canJoinSeat(2)).toBe(true);
        expect(result.current.availableSeatIndexes).toContain(2);
    });
});
