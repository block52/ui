import { renderHook } from "@testing-library/react";
import { GameFormat, GameOptionsDTO, TexasHoldemStateDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { useSitAndGoPayouts } from "./useSitAndGoPayouts";

const mockUseGameStateContext = jest.fn();
jest.mock("../../context/GameStateContext", () => ({
    useGameStateContext: () => mockUseGameStateContext()
}));

const buildOptions = (overrides: Partial<GameOptionsDTO> = {}): GameOptionsDTO => ({
    minBuyIn: "10000000",
    maxBuyIn: "10000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "25",
    bigBlind: "50",
    timeout: 30,
    ...overrides
});

const buildState = (gameOptions?: GameOptionsDTO): TexasHoldemStateDTO => ({
    gameOptions,
    smallBlindPosition: 1,
    bigBlindPosition: 2,
    dealer: 1,
    players: [],
    communityCards: [],
    deck: "",
    pots: ["0"],
    totalPot: "0",
    nextToAct: 1,
    previousActions: [],
    actionCount: 0,
    handNumber: 0,
    round: TexasHoldemRound.ANTE,
    winners: [],
    results: [],
    legalActions: [],
    availableSeats: [],
    signature: "sig"
});

const setContext = (
    gameState: TexasHoldemStateDTO | undefined,
    gameFormat: GameFormat | undefined = GameFormat.SIT_AND_GO
) => {
    mockUseGameStateContext.mockReturnValue({ gameState, gameFormat });
};

describe("useSitAndGoPayouts", () => {
    beforeEach(() => jest.clearAllMocks());

    it("returns empty struct when format is cash", () => {
        setContext(buildState(buildOptions()), GameFormat.CASH);
        const { result } = renderHook(() => useSitAndGoPayouts());
        expect(result.current.isSitAndGo).toBe(false);
        expect(result.current.places).toEqual([]);
        expect(result.current.prizePool).toBeNull();
    });

    it("returns empty places when gameState is missing", () => {
        setContext(undefined, GameFormat.SIT_AND_GO);
        const { result } = renderHook(() => useSitAndGoPayouts());
        expect(result.current.isSitAndGo).toBe(true);
        expect(result.current.places).toEqual([]);
        expect(result.current.prizePool).toBeNull();
    });

    it("returns empty places when minBuyIn is missing", () => {
        setContext(buildState(buildOptions({ minBuyIn: undefined })));
        const { result } = renderHook(() => useSitAndGoPayouts());
        expect(result.current.isSitAndGo).toBe(true);
        expect(result.current.places).toEqual([]);
        expect(result.current.prizePool).toBeNull();
    });

    it("heads-up uses 100% for first", () => {
        setContext(buildState(buildOptions({ minBuyIn: "1000000", maxPlayers: 2 })));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("2000000");
        expect(result.current.places).toEqual([
            { place: 1, percent: 100, payout: "2000000" }
        ]);
    });

    it("3-7 players uses 60/40 split", () => {
        setContext(buildState(buildOptions({ minBuyIn: "10000000", maxPlayers: 4 })));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("40000000");
        expect(result.current.places).toEqual([
            { place: 1, percent: 60, payout: "24000000" },
            { place: 2, percent: 40, payout: "16000000" }
        ]);
    });

    it("8-10 players uses 50/30/20 split", () => {
        setContext(buildState(buildOptions({ minBuyIn: "10000000", maxPlayers: 9 })));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("90000000");
        expect(result.current.places).toEqual([
            { place: 1, percent: 50, payout: "45000000" },
            { place: 2, percent: 30, payout: "27000000" },
            { place: 3, percent: 20, payout: "18000000" }
        ]);
    });

    it("adds integer rounding remainder to first place", () => {
        setContext(buildState(buildOptions({ minBuyIn: "1", maxPlayers: 3 })));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("3");
        expect(result.current.places).toEqual([
            { place: 1, percent: 60, payout: "2" },
            { place: 2, percent: 40, payout: "1" }
        ]);
    });
});
