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

const buildState = (options: GameOptionsDTO): TexasHoldemStateDTO => ({
    gameOptions: options,
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

    it("returns empty places when gameOptions is missing", () => {
        setContext(undefined, GameFormat.SIT_AND_GO);
        const { result } = renderHook(() => useSitAndGoPayouts());
        expect(result.current.isSitAndGo).toBe(true);
        expect(result.current.places).toEqual([]);
        expect(result.current.prizePool).toBeNull();
    });

    it("heads-up (2 players): single 100% payout", () => {
        const options = buildOptions({ minBuyIn: "10000000", maxPlayers: 2 });
        setContext(buildState(options));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("20000000");
        expect(result.current.places).toEqual([
            { place: 1, percentBasisPoints: 10000, payout: "20000000" }
        ]);
    });

    it("3 players: 70/30 split", () => {
        const options = buildOptions({ minBuyIn: "10000000", maxPlayers: 3 });
        setContext(buildState(options));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("30000000");
        expect(result.current.places.map(p => p.payout)).toEqual(["21000000", "9000000"]);
    });

    it("6 players: 65/35 split", () => {
        const options = buildOptions({ minBuyIn: "10000000", maxPlayers: 6 });
        setContext(buildState(options));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("60000000");
        expect(result.current.places.map(p => p.payout)).toEqual(["39000000", "21000000"]);
    });

    it("9 players: 50/30/20 split", () => {
        const options = buildOptions({ minBuyIn: "10000000", maxPlayers: 9 });
        setContext(buildState(options));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("90000000");
        expect(result.current.places.map(p => p.payout)).toEqual([
            "45000000",
            "27000000",
            "18000000"
        ]);
        expect(result.current.places.map(p => p.percentBasisPoints)).toEqual([5000, 3000, 2000]);
    });

    it("returns empty places when maxPlayers is outside the supported curve range", () => {
        const options = buildOptions({ minBuyIn: "10000000", maxPlayers: 12 });
        setContext(buildState(options));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.isSitAndGo).toBe(true);
        expect(result.current.places).toEqual([]);
        expect(result.current.prizePool).toBeNull();
    });
});
