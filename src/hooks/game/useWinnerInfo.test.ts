import { renderHook } from "@testing-library/react";
import { GameFormat } from "@block52/poker-vm-sdk";
import { formatWinAmount, useWinnerInfo } from "./useWinnerInfo";
import { useGameStateContext } from "../../context/GameStateContext";

jest.mock("../../context/GameStateContext");

const mockedUseGameStateContext = useGameStateContext as jest.MockedFunction<typeof useGameStateContext>;

const withState = (state: unknown, gameFormat: GameFormat = GameFormat.CASH) =>
    mockedUseGameStateContext.mockReturnValue({
        gameState: state,
        gameFormat,
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

describe("win amounts use the table's units (ui#727)", () => {
    afterEach(() => jest.clearAllMocks());

    it("formats chips for SNG and tournament, USDC for cash", () => {
        expect(formatWinAmount("120", true)).toBe("120 chips");
        expect(formatWinAmount("12400", true)).toBe(`${(12400).toLocaleString()} chips`);
        expect(formatWinAmount("400000", false)).toBe("0.40");
    });

    it("an SNG win reads in chips, not the cash-style 0.00", () => {
        withState({ winners: [{ seat: 3, address: "0xa", amount: "120" }], players: [] }, GameFormat.SIT_AND_GO);

        const { result } = renderHook(() => useWinnerInfo());

        expect(result.current.winnerBySeat.get(3)?.formattedAmount).toBe("120 chips");
    });

    it("a tournament win reads in chips", () => {
        withState({ winners: [{ seat: 1, address: "0xa", amount: "3000" }], players: [] }, GameFormat.TOURNAMENT);

        const { result } = renderHook(() => useWinnerInfo());

        expect(result.current.winnerBySeat.get(1)?.formattedAmount).toBe(`${(3000).toLocaleString()} chips`);
    });

    it("a cash win keeps the existing USDC format", () => {
        withState({ winners: [{ seat: 2, address: "0xa", amount: "400000" }], players: [] }, GameFormat.CASH);

        const { result } = renderHook(() => useWinnerInfo());

        expect(result.current.winnerBySeat.get(2)?.formattedAmount).toBe("0.40");
    });
});
