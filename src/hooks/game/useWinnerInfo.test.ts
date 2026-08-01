import { renderHook } from "@testing-library/react";
import { useWinnerInfo } from "./useWinnerInfo";
import { useGameStateContext } from "../../context/GameStateContext";

jest.mock("../../context/GameStateContext");

const mockedUseGameStateContext = useGameStateContext as jest.MockedFunction<typeof useGameStateContext>;

const withState = (state: unknown) =>
    mockedUseGameStateContext.mockReturnValue({
        gameState: state,
        isLoading: false,
        error: null
    } as any);

describe("useWinnerInfo winnerBySeat (#2455)", () => {
    afterEach(() => jest.clearAllMocks());

    it("indexes winners by seat", () => {
        withState({
            winners: [
                { seat: 3, address: "0xa", amount: "100", description: "Full House" },
                { seat: 7, address: "0xb", amount: "50", description: "Two Pair" }
            ],
            players: []
        });

        const { result } = renderHook(() => useWinnerInfo());

        expect(result.current.winnerBySeat.get(3)?.address).toBe("0xa");
        expect(result.current.winnerBySeat.get(7)?.description).toBe("Two Pair");
        expect(result.current.winnerBySeat.get(1)).toBeUndefined();
        // winnerBySeat is consistent with the array it indexes
        expect(result.current.winnerBySeat.size).toBe(result.current.winnerInfo?.length);
    });

    it("returns an empty map when there are no winners", () => {
        withState({ winners: [], players: [] });

        const { result } = renderHook(() => useWinnerInfo());

        expect(result.current.winnerInfo).toBeNull();
        expect(result.current.winnerBySeat.size).toBe(0);
    });

    it("returns an empty map while loading", () => {
        mockedUseGameStateContext.mockReturnValue({
            gameState: undefined,
            isLoading: true,
            error: null
        } as any);

        const { result } = renderHook(() => useWinnerInfo());

        expect(result.current.winnerBySeat.size).toBe(0);
    });
});
