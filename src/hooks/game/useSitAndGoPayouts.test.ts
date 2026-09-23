import { renderHook } from "@testing-library/react";
import { GameFormat, GameOptionsDTO, PayoutPlaceDTO, TexasHoldemStateDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { useSitAndGoPayouts } from "./useSitAndGoPayouts";

const mockUseGameData = jest.fn();
const mockUseGameMeta = jest.fn();
jest.mock("../../context/gameState/GameDataContext", () => ({
    useGameData: () => mockUseGameData()
}));
jest.mock("../../context/gameState/GameMetaContext", () => ({
    useGameMeta: () => mockUseGameMeta()
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

const buildState = (payouts?: PayoutPlaceDTO[]): TexasHoldemStateDTO => ({
    gameOptions: buildOptions(),
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
    payouts,
    signature: "sig"
});

const setContext = (
    gameState: TexasHoldemStateDTO | undefined,
    gameFormat: GameFormat | undefined = GameFormat.SIT_AND_GO,
    isOptimistic = false
) => {
    mockUseGameData.mockReturnValue({ gameState, isOptimistic });
    mockUseGameMeta.mockReturnValue({ gameFormat });
};

describe("useSitAndGoPayouts", () => {
    beforeEach(() => jest.clearAllMocks());

    it("returns empty struct when format is cash", () => {
        setContext(buildState([{ place: 1, amount: "20000000" }]), GameFormat.CASH);
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

    it("returns empty places when payouts[] is absent", () => {
        setContext(buildState(undefined));
        const { result } = renderHook(() => useSitAndGoPayouts());
        expect(result.current.isSitAndGo).toBe(true);
        expect(result.current.places).toEqual([]);
        expect(result.current.prizePool).toBeNull();
    });

    it("heads-up payout from state.payouts", () => {
        setContext(buildState([{ place: 1, amount: "20000000" }]));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("20000000");
        expect(result.current.places).toEqual([
            { place: 1, payout: "20000000" }
        ]);
    });

    it("top-2 payouts from state.payouts", () => {
        setContext(buildState([
            { place: 1, amount: "39000000" },
            { place: 2, amount: "21000000" }
        ]));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("60000000");
        expect(result.current.places.map(p => p.payout)).toEqual(["39000000", "21000000"]);
    });

    it("top-3 payouts from state.payouts", () => {
        setContext(buildState([
            { place: 1, amount: "36000000" },
            { place: 2, amount: "18000000" },
            { place: 3, amount: "6000000" }
        ]));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("60000000");
        expect(result.current.places.map(p => p.place)).toEqual([1, 2, 3]);
        expect(result.current.places.map(p => p.payout)).toEqual(["36000000", "18000000", "6000000"]);
    });

    it("passes through exact payouts when pool has drift", () => {
        setContext(buildState([
            { place: 1, amount: "4" },
            { place: 2, amount: "2" }
        ]));
        const { result } = renderHook(() => useSitAndGoPayouts());

        expect(result.current.prizePool).toBe("6");
        expect(result.current.places.map(p => p.payout)).toEqual(["4", "2"]);
    });

    // ui#659: the 21 Sept c1001 session showed first place alternating between
    // $0.20 and $0.18 at an unchanged hand and action count. The render track
    // commits the relay's optimistic projections as well as committed state,
    // and the two producers answer differently — so the panel restated the
    // prize pool on every mempool push. A pending action cannot change anyone's
    // entitlement, so a projection is never a reason to restate it.
    describe("committed provenance (ui#659)", () => {
        const COMMITTED = "200000"; // $0.20
        const PROJECTED = "180000"; // $0.18

        it("ignores a payout figure that arrives on an optimistic frame", () => {
            const { result, rerender } = renderHook(() => useSitAndGoPayouts());

            setContext(buildState([{ place: 1, amount: COMMITTED }]));
            rerender();
            expect(result.current.places).toEqual([{ place: 1, payout: COMMITTED }]);

            setContext(buildState([{ place: 1, amount: PROJECTED }]), GameFormat.SIT_AND_GO, true);
            rerender();
            expect(result.current.places).toEqual([{ place: 1, payout: COMMITTED }]);
            expect(result.current.prizePool).toBe(COMMITTED);
        });

        it("does not alternate across the session's observed update sequence", () => {
            const { result, rerender } = renderHook(() => useSitAndGoPayouts());
            const seen: (string | undefined)[] = [];

            // committed, projection, projection, committed, projection …
            const sequence: [string, boolean][] = [
                [COMMITTED, false],
                [PROJECTED, true],
                [PROJECTED, true],
                [COMMITTED, false],
                [PROJECTED, true],
                [COMMITTED, false]
            ];

            for (const [amount, optimistic] of sequence) {
                setContext(buildState([{ place: 1, amount }]), GameFormat.SIT_AND_GO, optimistic);
                rerender();
                seen.push(result.current.places[0]?.payout);
            }

            expect(new Set(seen)).toEqual(new Set([COMMITTED]));
        });

        it("takes a genuinely changed payout from committed state", () => {
            const { result, rerender } = renderHook(() => useSitAndGoPayouts());

            setContext(buildState([{ place: 1, amount: COMMITTED }]));
            rerender();

            // a real structure change — committed, so it must land
            setContext(buildState([{ place: 1, amount: "150000" }, { place: 2, amount: "50000" }]));
            rerender();

            expect(result.current.places).toEqual([
                { place: 1, payout: "150000" },
                { place: 2, payout: "50000" }
            ]);
            expect(result.current.prizePool).toBe("200000");
        });

        it("holds the committed structure rather than blanking when a projection omits payouts", () => {
            const { result, rerender } = renderHook(() => useSitAndGoPayouts());

            setContext(buildState([{ place: 1, amount: COMMITTED }]));
            rerender();

            setContext(buildState(undefined), GameFormat.SIT_AND_GO, true);
            rerender();

            expect(result.current.places).toEqual([{ place: 1, payout: COMMITTED }]);
        });

        it("clears when committed state itself drops the payouts", () => {
            const { result, rerender } = renderHook(() => useSitAndGoPayouts());

            setContext(buildState([{ place: 1, amount: COMMITTED }]));
            rerender();

            setContext(buildState(undefined));
            rerender();

            expect(result.current.places).toEqual([]);
            expect(result.current.prizePool).toBeNull();
        });
    });
});
