import { renderHook } from "@testing-library/react";
import { GameFormat, GameOptionsDTO, TexasHoldemStateDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { useBlindLevel } from "./useBlindLevel";

const mockUseGameStateContext = jest.fn();
jest.mock("../../context/GameStateContext", () => ({
    useGameStateContext: () => mockUseGameStateContext()
}));

// 3-minute blind levels (the scenario from poker-vm#2292).
const LEVEL_MINUTES = 3;
const LEVEL_SECONDS = LEVEL_MINUTES * 60; // 180

const buildOptions = (overrides: Partial<GameOptionsDTO> = {}): GameOptionsDTO => ({
    minBuyIn: "10000000",
    maxBuyIn: "10000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "25",
    bigBlind: "50",
    timeout: 30,
    blindLevelDuration: LEVEL_MINUTES,
    blindLevel: 0,
    nextSmallBlind: "50",
    nextBigBlind: "100",
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

const setContext = (options: GameOptionsDTO) => {
    mockUseGameStateContext.mockReturnValue({ gameState: buildState(options), gameFormat: GameFormat.SIT_AND_GO });
};

describe("useBlindLevel — countdown resets per level (poker-vm#2292)", () => {
    let nowSpy: jest.SpyInstance;

    // The hook reads the current level's start from gameOptions.levelStartTime.
    // Pin `now` (Date.now) so the hook's tick is deterministic.
    const renderAt = (levelStartTime: number, secondsIntoLevel: number, options: GameOptionsDTO) => {
        nowSpy = jest.spyOn(Date, "now").mockReturnValue(levelStartTime + secondsIntoLevel * 1000);
        setContext({ ...options, levelStartTime });
        return renderHook(() => useBlindLevel());
    };

    afterEach(() => {
        nowSpy?.mockRestore();
        jest.clearAllMocks();
    });

    it("level 0: remaining = full level minus elapsed", () => {
        const start = 1_000_000_000_000;
        const { result } = renderAt(start, 30, buildOptions({ blindLevel: 0 }));
        expect(result.current.secondsRemaining).toBe(LEVEL_SECONDS - 30); // 150
    });

    it("level 1: resets to full level minus elapsed (was the bug: showed ~5.5 min)", () => {
        const start = 1_000_000_180_000; // level-1 start
        const { result } = renderAt(start, 30, buildOptions({ blindLevel: 1 }));
        expect(result.current.secondsRemaining).toBe(LEVEL_SECONDS - 30); // 150, NOT (1+1)*180-30 = 330
    });

    it("level 2: still resets to full level minus elapsed (was: ~8.5 min)", () => {
        const start = 1_000_000_360_000; // level-2 start
        const { result } = renderAt(start, 30, buildOptions({ blindLevel: 2 }));
        expect(result.current.secondsRemaining).toBe(LEVEL_SECONDS - 30); // 150, NOT (2+1)*180-30 = 510
    });

    it("counts down within a level, then goes negative (overtime) past the level end", () => {
        const start = 1_000_000_360_000;
        expect(renderAt(start, 170, buildOptions({ blindLevel: 2 })).result.current.secondsRemaining).toBe(10);
        // Hand still in progress past the level end: backend holds levelStartTime
        // steady, so the UI shows overtime as negative (e.g. -70 → "-1:10" in red),
        // NOT clamped to 0. (poker-vm#2292)
        nowSpy.mockRestore();
        expect(renderAt(start, 190, buildOptions({ blindLevel: 2 })).result.current.secondsRemaining).toBe(-10);
        nowSpy.mockRestore();
        expect(renderAt(start, 250, buildOptions({ blindLevel: 2 })).result.current.secondsRemaining).toBe(-70);
    });
});

describe("useBlindLevel — the clock stops once the tournament has finished", () => {
    const start = 1_000_000_360_000;
    const renderWithResults = (results: TexasHoldemStateDTO["results"]) => {
        const nowSpy = jest.spyOn(Date, "now").mockReturnValue(start + 250 * 1000);
        const options = buildOptions({ blindLevel: 2, levelStartTime: start });
        mockUseGameStateContext.mockReturnValue({ gameState: { ...buildState(options), results }, gameFormat: GameFormat.SIT_AND_GO });
        const { result } = renderHook(() => useBlindLevel());
        nowSpy.mockRestore();
        return result.current;
    };

    it("keeps running while players are only busting out", () => {
        const level = renderWithResults([{ place: 4, playerId: "b521d", payout: "0" }]);
        expect(level.hasTimer).toBe(true);
        expect(level.secondsRemaining).toBe(-70);
    });

    it("has no timer once 1st place is recorded", () => {
        const level = renderWithResults([
            { place: 2, playerId: "b521b", payout: "400000" },
            { place: 1, playerId: "b521a", payout: "1000000" }
        ]);
        expect(level.hasTimer).toBe(false);
        expect(level.secondsRemaining).toBe(-1);
    });
});
