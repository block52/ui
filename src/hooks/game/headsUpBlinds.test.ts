import { renderHook } from "@testing-library/react";
import { TexasHoldemStateDTO, PlayerDTO, TexasHoldemRound, PlayerStatus, GameFormat, GameOptionsDTO } from "@block52/poker-vm-sdk";
import { useTableData } from "./useTableData";
import { useDealerPosition } from "./useDealerPosition";
import { useNextToActInfo } from "./useNextToActInfo";
import { TEST_ADDRESSES } from "../../test-utils";

// Mock GameStateContext — hooks read from this context
const mockUseGameStateContext = jest.fn();
jest.mock("../../context/GameStateContext", () => ({
    useGameStateContext: () => mockUseGameStateContext()
}));

// Mock colorConfig to avoid import.meta issues
jest.mock("../../utils/colorConfig", () => ({
    colors: {
        brand: { primary: "#3b82f6", secondary: "#1a2639" },
        table: { bgGradientStart: "#1a2639", bgGradientMid: "#2a3f5f", bgGradientEnd: "#1a2639", bgBase: "#111827", borderColor: "#3a546d" },
        animation: { color1: "#3d59a1", color2: "#2a488f", color3: "#4263af", color4: "#1e346b", color5: "#324f97" },
        accent: { glow: "#64ffda", success: "#10b981", danger: "#ef4444", warning: "#f59e0b", withdraw: "#1a2639" },
        ui: { bgDark: "#1f2937", bgMedium: "#374151", borderColor: "rgba(59,130,246,0.2)", textSecondary: "#9ca3af" }
    }
}));

// ============================================================================
// Helper Factory
// ============================================================================

const DEFAULT_GAME_OPTIONS: GameOptionsDTO = {
    minBuyIn: "100000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "5000000",
    bigBlind: "10000000",
    timeout: 30
};

function createHUPlayer(overrides: Partial<PlayerDTO> = {}): PlayerDTO {
    return {
        address: TEST_ADDRESSES.PLAYER_1,
        seat: 1,
        stack: "500000000",
        isSmallBlind: false,
        isBigBlind: false,
        isDealer: false,
        holeCards: undefined,
        status: PlayerStatus.ACTIVE,
        lastAction: undefined,
        legalActions: [],
        sumOfBets: "0",
        timeout: 30,
        signature: "sig1",
        ...overrides
    };
}

function createHUGameState(overrides: Partial<TexasHoldemStateDTO> = {}): TexasHoldemStateDTO {
    const player1 = createHUPlayer({
        address: TEST_ADDRESSES.PLAYER_1,
        seat: 1,
        isDealer: true,
        isSmallBlind: true
    });

    const player2 = createHUPlayer({
        address: TEST_ADDRESSES.PLAYER_2,
        seat: 2,
        isBigBlind: true
    });

    return {
        gameOptions: DEFAULT_GAME_OPTIONS,
        smallBlindPosition: 1,
        bigBlindPosition: 2,
        dealer: 1,
        players: [player1, player2],
        communityCards: [],
        deck: "encrypted_deck",
        pots: ["0"],
        totalPot: "0",
        nextToAct: 1,
        previousActions: [],
        actionCount: 0,
        handNumber: 1,
        round: TexasHoldemRound.ANTE,
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: "game_sig",
        ...overrides
    };
}

function setMockContext(gameState: TexasHoldemStateDTO | undefined, gameFormat: GameFormat = GameFormat.CASH): void {
    mockUseGameStateContext.mockReturnValue({
        gameState,
        gameFormat,
        gameVariant: undefined,
        isLoading: false,
        error: null,
        validationError: null,
        pendingAction: null,
        subscribeToTable: jest.fn(),
        unsubscribeFromTable: jest.fn(),
        sendAction: jest.fn()
    });
}

// ============================================================================
// Tests
// ============================================================================

describe("Heads-Up Blind Assignment", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ------------------------------------------------------------------
    // AC-HU-1: DEAL assigns dealer and blinds in heads-up
    // ------------------------------------------------------------------
    describe("AC-HU-1: DEAL assigns dealer and blinds", () => {
        it("should assign dealer=1, SB=1, BB=2 after deal in a 2-player game", () => {
            const state = createHUGameState({
                round: TexasHoldemRound.ANTE,
                dealer: 1,
                smallBlindPosition: 1,
                bigBlindPosition: 2
            });
            setMockContext(state);

            const { result } = renderHook(() => useTableData());

            expect(result.current.tableDataDealer).toBe(1);
            expect(result.current.tableDataSmallBlindPosition).toBe(1);
            expect(result.current.tableDataBigBlindPosition).toBe(2);
            expect(result.current.tableDataPlayers).toHaveLength(2);
        });

        it("should have the dealer player flagged as isDealer and isSmallBlind", () => {
            const state = createHUGameState();
            setMockContext(state);

            const { result } = renderHook(() => useTableData());

            const dealerPlayer = result.current.tableDataPlayers.find(p => p.seat === 1);
            expect(dealerPlayer?.isDealer).toBe(true);
            expect(dealerPlayer?.isSmallBlind).toBe(true);
        });

        it("should have the non-dealer player flagged as isBigBlind", () => {
            const state = createHUGameState();
            setMockContext(state);

            const { result } = renderHook(() => useTableData());

            const bbPlayer = result.current.tableDataPlayers.find(p => p.seat === 2);
            expect(bbPlayer?.isBigBlind).toBe(true);
            expect(bbPlayer?.isDealer).toBe(false);
        });
    });

    // ------------------------------------------------------------------
    // AC-HU-2: Hole cards dealt transitions ANTE -> PREFLOP
    // ------------------------------------------------------------------
    describe("AC-HU-2: Hole cards dealt transitions ANTE -> PREFLOP", () => {
        it("should show round=PREFLOP after hole cards are dealt", () => {
            const state = createHUGameState({
                round: TexasHoldemRound.PREFLOP,
                players: [
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_1,
                        seat: 1,
                        isDealer: true,
                        isSmallBlind: true,
                        holeCards: ["AH", "KS"]
                    }),
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_2,
                        seat: 2,
                        isBigBlind: true,
                        holeCards: ["QD", "JC"]
                    })
                ]
            });
            setMockContext(state);

            const { result } = renderHook(() => useTableData());

            expect(result.current.tableDataRound).toBe(TexasHoldemRound.PREFLOP);
        });

        it("should have hole cards assigned to both players", () => {
            const state = createHUGameState({
                round: TexasHoldemRound.PREFLOP,
                players: [
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_1,
                        seat: 1,
                        isDealer: true,
                        isSmallBlind: true,
                        holeCards: ["AH", "KS"]
                    }),
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_2,
                        seat: 2,
                        isBigBlind: true,
                        holeCards: ["QD", "JC"]
                    })
                ]
            });
            setMockContext(state);

            const { result } = renderHook(() => useTableData());

            const p1 = result.current.tableDataPlayers.find(p => p.seat === 1);
            const p2 = result.current.tableDataPlayers.find(p => p.seat === 2);
            expect(p1?.holeCards).toEqual(["AH", "KS"]);
            expect(p2?.holeCards).toEqual(["QD", "JC"]);
        });
    });

    // ------------------------------------------------------------------
    // AC-HU-3: HU PREFLOP action order — SB (dealer) acts first
    // ------------------------------------------------------------------
    describe("AC-HU-3: PREFLOP — SB/dealer acts first", () => {
        it("should report nextToAct as seat 1 (dealer/SB) during PREFLOP", () => {
            const state = createHUGameState({
                round: TexasHoldemRound.PREFLOP,
                nextToAct: 1,
                players: [
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_1,
                        seat: 1,
                        isDealer: true,
                        isSmallBlind: true,
                        legalActions: [{ action: "call" as any, min: "5000000", max: "5000000", index: 0 }]
                    }),
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_2,
                        seat: 2,
                        isBigBlind: true
                    })
                ]
            });
            setMockContext(state);

            const { result } = renderHook(() => useNextToActInfo());

            expect(result.current.seat).toBe(1);
            expect(result.current.player?.address).toBe(TEST_ADDRESSES.PLAYER_1);
        });

        it("should surface available actions for the SB player", () => {
            const state = createHUGameState({
                round: TexasHoldemRound.PREFLOP,
                nextToAct: 1,
                players: [
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_1,
                        seat: 1,
                        isDealer: true,
                        isSmallBlind: true,
                        legalActions: [
                            { action: "call" as any, min: "5000000", max: "5000000", index: 0 },
                            { action: "raise" as any, min: "20000000", max: "500000000", index: 1 },
                            { action: "fold" as any, min: undefined, max: undefined, index: 2 }
                        ]
                    }),
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_2,
                        seat: 2,
                        isBigBlind: true
                    })
                ]
            });
            setMockContext(state);

            const { result } = renderHook(() => useNextToActInfo());

            expect(result.current.availableActions).toHaveLength(3);
        });
    });

    // ------------------------------------------------------------------
    // AC-HU-4/5/6: FLOP/TURN/RIVER — BB (non-dealer) acts first
    // ------------------------------------------------------------------
    describe("AC-HU-4/5/6: Post-flop — BB acts first", () => {
        const postFlopRounds = [
            TexasHoldemRound.FLOP,
            TexasHoldemRound.TURN,
            TexasHoldemRound.RIVER
        ];

        postFlopRounds.forEach(round => {
            it(`should report nextToAct as seat 2 (BB) during ${round.toUpperCase()}`, () => {
                const communityCards = round === TexasHoldemRound.FLOP
                    ? ["AH", "KD", "3C"]
                    : round === TexasHoldemRound.TURN
                        ? ["AH", "KD", "3C", "7S"]
                        : ["AH", "KD", "3C", "7S", "2H"];

                const state = createHUGameState({
                    round,
                    nextToAct: 2,
                    communityCards,
                    players: [
                        createHUPlayer({
                            address: TEST_ADDRESSES.PLAYER_1,
                            seat: 1,
                            isDealer: true,
                            isSmallBlind: true,
                            holeCards: ["TC", "9C"]
                        }),
                        createHUPlayer({
                            address: TEST_ADDRESSES.PLAYER_2,
                            seat: 2,
                            isBigBlind: true,
                            holeCards: ["QD", "JC"],
                            legalActions: [
                                { action: "check" as any, min: undefined, max: undefined, index: 0 },
                                { action: "bet" as any, min: "10000000", max: "500000000", index: 1 }
                            ]
                        })
                    ]
                });
                setMockContext(state);

                const { result } = renderHook(() => useNextToActInfo());

                expect(result.current.seat).toBe(2);
                expect(result.current.player?.address).toBe(TEST_ADDRESSES.PLAYER_2);
            });
        });

        it("should confirm useTableData also reflects nextToAct=2 on FLOP", () => {
            const state = createHUGameState({
                round: TexasHoldemRound.FLOP,
                nextToAct: 2,
                communityCards: ["AH", "KD", "3C"]
            });
            setMockContext(state);

            const { result } = renderHook(() => useTableData());

            expect(result.current.tableDataNextToAct).toBe(2);
            expect(result.current.tableDataRound).toBe(TexasHoldemRound.FLOP);
            expect(result.current.tableDataCommunityCards).toEqual(["AH", "KD", "3C"]);
        });
    });

    // ------------------------------------------------------------------
    // AC-HU-7: Dealer toggles on next DEAL
    // ------------------------------------------------------------------
    describe("AC-HU-7: Dealer toggles on new hand", () => {
        it("should swap dealer from seat 1 to seat 2 on second hand", () => {
            const state = createHUGameState({
                handNumber: 2,
                dealer: 2,
                smallBlindPosition: 2,
                bigBlindPosition: 1,
                players: [
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_1,
                        seat: 1,
                        isDealer: false,
                        isSmallBlind: false,
                        isBigBlind: true
                    }),
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_2,
                        seat: 2,
                        isDealer: true,
                        isSmallBlind: true,
                        isBigBlind: false
                    })
                ]
            });
            setMockContext(state);

            const { result } = renderHook(() => useTableData());

            expect(result.current.tableDataDealer).toBe(2);
            expect(result.current.tableDataSmallBlindPosition).toBe(2);
            expect(result.current.tableDataBigBlindPosition).toBe(1);
        });

        it("should have player flags swapped correctly on second hand", () => {
            const state = createHUGameState({
                handNumber: 2,
                dealer: 2,
                smallBlindPosition: 2,
                bigBlindPosition: 1,
                players: [
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_1,
                        seat: 1,
                        isBigBlind: true,
                        isSmallBlind: false,
                        isDealer: false
                    }),
                    createHUPlayer({
                        address: TEST_ADDRESSES.PLAYER_2,
                        seat: 2,
                        isBigBlind: false,
                        isSmallBlind: true,
                        isDealer: true
                    })
                ]
            });
            setMockContext(state);

            const { result } = renderHook(() => useTableData());

            const p1 = result.current.tableDataPlayers.find(p => p.seat === 1);
            const p2 = result.current.tableDataPlayers.find(p => p.seat === 2);

            // Seat 1 was dealer in hand 1, now BB
            expect(p1?.isBigBlind).toBe(true);
            expect(p1?.isDealer).toBe(false);

            // Seat 2 was BB in hand 1, now dealer/SB
            expect(p2?.isDealer).toBe(true);
            expect(p2?.isSmallBlind).toBe(true);
        });
    });

    // ------------------------------------------------------------------
    // AC-HU-8: Dealer only on active seats
    // ------------------------------------------------------------------
    describe("AC-HU-8: Dealer only on active seats", () => {
        it("should place dealer on an active seat (seat 1)", () => {
            const state = createHUGameState({
                dealer: 1,
                smallBlindPosition: 1,
                bigBlindPosition: 2
            });
            setMockContext(state);

            const { result: tableResult } = renderHook(() => useTableData());
            const { result: dealerResult } = renderHook(() => useDealerPosition());

            const activeSeatNumbers = tableResult.current.tableDataPlayers
                .filter(p => p.status === PlayerStatus.ACTIVE)
                .map(p => p.seat);

            expect(activeSeatNumbers).toContain(tableResult.current.tableDataDealer);
            expect(dealerResult.current.dealerSeat).toBe(1);
        });

        it("should have SB === dealer seat and BB === other seat in HU", () => {
            const state = createHUGameState({
                dealer: 1,
                smallBlindPosition: 1,
                bigBlindPosition: 2
            });
            setMockContext(state);

            const { result } = renderHook(() => useTableData());

            // In HU: dealer === SB
            expect(result.current.tableDataSmallBlindPosition).toBe(result.current.tableDataDealer);
            // BB is the other player
            expect(result.current.tableDataBigBlindPosition).not.toBe(result.current.tableDataDealer);
        });

        it("should not assign dealer to an empty seat", () => {
            const state = createHUGameState();
            setMockContext(state);

            const { result } = renderHook(() => useTableData());

            const occupiedSeats = result.current.tableDataPlayers.map(p => p.seat);
            expect(occupiedSeats).toContain(result.current.tableDataDealer);
        });
    });

    // ------------------------------------------------------------------
    // Edge case: no game state (loading)
    // ------------------------------------------------------------------
    describe("Edge: no game state returns defaults", () => {
        it("useTableData should return defaults when gameState is undefined", () => {
            setMockContext(undefined);

            const { result } = renderHook(() => useTableData());

            expect(result.current.tableDataDealer).toBe(0);
            expect(result.current.tableDataSmallBlindPosition).toBe(0);
            expect(result.current.tableDataBigBlindPosition).toBe(0);
            expect(result.current.tableDataPlayers).toEqual([]);
            expect(result.current.tableDataRound).toBe(TexasHoldemRound.PREFLOP);
        });

        it("useNextToActInfo should return null seat when gameState is undefined", () => {
            setMockContext(undefined);

            const { result } = renderHook(() => useNextToActInfo());

            expect(result.current.seat).toBeNull();
            expect(result.current.player).toBeNull();
        });

        it("useDealerPosition should return null when gameState is undefined", () => {
            setMockContext(undefined);

            const { result } = renderHook(() => useDealerPosition());

            expect(result.current.dealerSeat).toBeNull();
        });
    });
});
