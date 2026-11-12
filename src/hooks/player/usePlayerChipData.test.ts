import { renderHook } from "@testing-library/react";
import { PlayerActionType, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { usePlayerChipData } from "./usePlayerChipData";
import { resetClosingClock } from "./closingBetClock";
import { useGameStateContext } from "../../context/GameStateContext";

// Mock the GameStateContext and the slice hooks the migrated usePlayerChipData reads from.
jest.mock("../../context/GameStateContext");

const mockUseGameStateContext = useGameStateContext as jest.MockedFunction<typeof useGameStateContext>;

jest.mock("../../context/gameState/GameDataContext", () => ({
    useGameData: () => ({ gameState: mockUseGameStateContext().gameState })
}));
jest.mock("../../context/gameState/GameUIContext", () => ({
    useGameUI: () => {
        const m = mockUseGameStateContext();
        return {
            isLoading: m.isLoading,
            error: m.error,
            validationError: m.validationError,
            pendingAction: m.pendingAction
        };
    }
}));

describe("usePlayerChipData", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetClosingClock();
    });

    describe("Player Status Filtering", () => {
        it("should show 0 chips for SEATED player (just joined, game not started)", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.ANTE,
                    players: [
                        {
                            seat: 1,
                            address: "cosmos1seated",
                            status: PlayerStatus.SEATED,
                            sumOfBets: "5000000", // Buy-in amount ($5.00)
                            stack: "5000000"
                        }
                    ],
                    previousActions: []
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(1));

            expect(result.current.chipAmount).toBe("0");
        });

        it("should show 0 chips for SITTING_OUT player", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.PREFLOP,
                    players: [
                        {
                            seat: 2,
                            address: "cosmos1sittingout",
                            status: PlayerStatus.SITTING_OUT,
                            sumOfBets: "1000000",
                            stack: "10000000"
                        }
                    ],
                    previousActions: []
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(2));

            expect(result.current.chipAmount).toBe("0");
        });

        it("should show 0 chips for BUSTED player", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.FLOP,
                    players: [
                        {
                            seat: 3,
                            address: "cosmos1busted",
                            status: PlayerStatus.BUSTED,
                            sumOfBets: "0",
                            stack: "0"
                        }
                    ],
                    previousActions: []
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(3));

            expect(result.current.chipAmount).toBe("0");
        });

        it("should show 0 chips for ACTIVE player with sumOfBets but NO betting actions (buy-in only)", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.ANTE,
                    players: [
                        {
                            seat: 1,
                            address: "cosmos1active",
                            status: PlayerStatus.ACTIVE,
                            sumOfBets: "5000000", // Buy-in amount, not actual bet
                            stack: "5000000"
                        }
                    ],
                    previousActions: [] // No betting actions
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(1));

            // Should show 0 because no actual betting actions exist
            expect(result.current.chipAmount).toBe("0");
        });

        it("should show chips for ACTIVE player with sumOfBets during ante when betting action exists", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.ANTE,
                    players: [
                        {
                            seat: 1,
                            address: "cosmos1active",
                            status: PlayerStatus.ACTIVE,
                            sumOfBets: "500000", // $0.50 ante
                            stack: "10000000"
                        }
                    ],
                    previousActions: [
                        {
                            playerId: "cosmos1active",
                            round: TexasHoldemRound.ANTE,
                            action: "post-small-blind",
                            amount: "500000",
                            index: 0
                        }
                    ]
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(1));

            expect(result.current.chipAmount).toBe("500000");
        });

        it("should show chips for ACTIVE player with sumOfBets during preflop when betting action exists", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.PREFLOP,
                    players: [
                        {
                            seat: 2,
                            address: "cosmos1bigblind",
                            status: PlayerStatus.ACTIVE,
                            sumOfBets: "2000000", // $2.00 big blind
                            stack: "10000000"
                        }
                    ],
                    previousActions: [
                        {
                            playerId: "cosmos1bigblind",
                            round: TexasHoldemRound.ANTE,
                            action: "post-big-blind",
                            amount: "2000000",
                            index: 0
                        }
                    ]
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(2));

            expect(result.current.chipAmount).toBe("2000000");
        });

        it("should show chips for ALL_IN player", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.FLOP,
                    players: [
                        {
                            seat: 3,
                            address: "cosmos1allin",
                            status: PlayerStatus.ALL_IN,
                            sumOfBets: "10000000",
                            stack: "0"
                        }
                    ],
                    previousActions: [
                        {
                            playerId: "cosmos1allin",
                            round: TexasHoldemRound.FLOP,
                            action: PlayerActionType.ALL_IN,
                            amount: "5000000",
                            index: 0
                        }
                    ]
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(3));

            expect(result.current.chipAmount).toBe("5000000");
        });

        it("should show chips for FOLDED player (current round bets before folding)", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.TURN,
                    players: [
                        {
                            seat: 4,
                            address: "cosmos1folded",
                            status: PlayerStatus.FOLDED,
                            sumOfBets: "3000000",
                            stack: "7000000"
                        }
                    ],
                    previousActions: [
                        {
                            playerId: "cosmos1folded",
                            round: TexasHoldemRound.TURN,
                            action: PlayerActionType.BET,
                            amount: "1000000",
                            index: 0
                        }
                    ]
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(4));

            expect(result.current.chipAmount).toBe("1000000");
        });
    });

    describe("Round-based Chip Display", () => {
        it("should use sumOfBets during ANTE round when player has betting actions", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.ANTE,
                    players: [
                        {
                            seat: 1,
                            address: "cosmos1player",
                            status: PlayerStatus.ACTIVE,
                            sumOfBets: "100000",
                            stack: "10000000"
                        }
                    ],
                    previousActions: [
                        {
                            playerId: "cosmos1player",
                            round: TexasHoldemRound.ANTE,
                            action: "post-small-blind",
                            amount: "100000",
                            index: 0
                        }
                    ]
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(1));

            expect(result.current.chipAmount).toBe("100000");
        });

        it("should use sumOfBets during PREFLOP round when player has betting actions", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.PREFLOP,
                    players: [
                        {
                            seat: 1,
                            address: "cosmos1player",
                            status: PlayerStatus.ACTIVE,
                            sumOfBets: "2000000",
                            stack: "8000000"
                        }
                    ],
                    previousActions: [
                        {
                            playerId: "cosmos1player",
                            round: TexasHoldemRound.ANTE,
                            action: "post-big-blind",
                            amount: "2000000",
                            index: 0
                        }
                    ]
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(1));

            expect(result.current.chipAmount).toBe("2000000");
        });

        it("should calculate current round betting for FLOP round", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.FLOP,
                    players: [
                        {
                            seat: 1,
                            address: "cosmos1player",
                            status: PlayerStatus.ACTIVE,
                            sumOfBets: "5000000", // Total from all rounds
                            stack: "5000000"
                        }
                    ],
                    previousActions: [
                        {
                            playerId: "cosmos1player",
                            round: TexasHoldemRound.PREFLOP,
                            action: PlayerActionType.CALL,
                            amount: "2000000", // Preflop bet
                            index: 0
                        },
                        {
                            playerId: "cosmos1player",
                            round: TexasHoldemRound.FLOP,
                            action: PlayerActionType.BET,
                            amount: "3000000", // Flop bet (current round)
                            index: 1
                        }
                    ]
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(1));

            // Should only show current round (FLOP) betting: 3000000
            expect(result.current.chipAmount).toBe("3000000");
        });

        it("should sum multiple bets in current round", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.RIVER,
                    players: [
                        {
                            seat: 1,
                            address: "cosmos1player",
                            status: PlayerStatus.ACTIVE,
                            sumOfBets: "10000000",
                            stack: "5000000"
                        }
                    ],
                    previousActions: [
                        {
                            playerId: "cosmos1player",
                            round: TexasHoldemRound.RIVER,
                            action: PlayerActionType.BET,
                            amount: "2000000", // First river bet
                            index: 0
                        },
                        {
                            playerId: "cosmos1player",
                            round: TexasHoldemRound.RIVER,
                            action: PlayerActionType.RAISE,
                            amount: "3000000", // Raise on river
                            index: 1
                        }
                    ]
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(1));

            // Should sum both river bets: 2000000 + 3000000 = 5000000
            expect(result.current.chipAmount).toBe("5000000");
        });
    });

    describe("Edge Cases", () => {
        it("should return 0 for non-existent seat", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.PREFLOP,
                    players: [
                        {
                            seat: 1,
                            address: "cosmos1player",
                            status: PlayerStatus.ACTIVE,
                            sumOfBets: "1000000",
                            stack: "10000000"
                        }
                    ],
                    previousActions: []
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(5));

            expect(result.current.chipAmount).toBe("0");
        });

        it("should handle null gameState", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: null,
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(1));

            expect(result.current.chipAmount).toBe("0");
        });

        it("should handle loading state", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: null,
                isLoading: true,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(1));

            expect(result.current.isLoading).toBe(true);
            expect(result.current.chipAmount).toBe("0");
        });

        it("should handle error state", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: null,
                isLoading: false,
                error: new Error("Connection failed"),
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData(1));

            expect(result.current.error).toEqual(new Error("Connection failed"));
            expect(result.current.chipAmount).toBe("0");
        });
    });

    describe("Multiple Players", () => {
        // Each seat now subscribes via its own hook call, so we render the hook
        // once per seat we want to assert on (mirrors how PlayerChipDisplay consumes it).
        const multiSeatState = {
            gameState: {
                round: TexasHoldemRound.PREFLOP,
                players: [
                    {
                        seat: 1,
                        address: "cosmos1seated",
                        status: PlayerStatus.SEATED,
                        sumOfBets: "5000000", // Buy-in (should NOT show - SEATED status)
                        stack: "5000000"
                    },
                    {
                        seat: 2,
                        address: "cosmos1active",
                        status: PlayerStatus.ACTIVE,
                        sumOfBets: "1000000", // Small blind (should show)
                        stack: "9000000"
                    },
                    {
                        seat: 3,
                        address: "cosmos1active2",
                        status: PlayerStatus.ACTIVE,
                        sumOfBets: "2000000", // Big blind (should show)
                        stack: "8000000"
                    }
                ],
                previousActions: [
                    {
                        playerId: "cosmos1active",
                        round: TexasHoldemRound.ANTE,
                        action: "post-small-blind",
                        amount: "1000000",
                        index: 0
                    },
                    {
                        playerId: "cosmos1active2",
                        round: TexasHoldemRound.ANTE,
                        action: "post-big-blind",
                        amount: "2000000",
                        index: 1
                    }
                ]
            },
            isLoading: false,
            error: null,
            gameFormat: "cash",
            validationError: null,
            subscribeToTable: jest.fn(),
            unsubscribeFromTable: jest.fn()
        };

        it("should correctly filter SEATED vs ACTIVE players with betting actions", () => {
            mockUseGameStateContext.mockReturnValue(multiSeatState as any);

            const { result: seat1 } = renderHook(() => usePlayerChipData(1));
            const { result: seat2 } = renderHook(() => usePlayerChipData(2));
            const { result: seat3 } = renderHook(() => usePlayerChipData(3));

            expect(seat1.current.chipAmount).toBe("0"); // SEATED - no chips shown
            expect(seat2.current.chipAmount).toBe("1000000"); // ACTIVE - small blind
            expect(seat3.current.chipAmount).toBe("2000000"); // ACTIVE - big blind
        });

        it("should show 0 chips for ACTIVE player with buy-in but no betting actions", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.PREFLOP,
                    players: [
                        {
                            seat: 1,
                            address: "cosmos1newjoin",
                            status: PlayerStatus.ACTIVE,
                            sumOfBets: "5000000", // Buy-in only (no betting actions)
                            stack: "5000000"
                        },
                        {
                            seat: 2,
                            address: "cosmos1smallblind",
                            status: PlayerStatus.ACTIVE,
                            sumOfBets: "1000000", // Small blind
                            stack: "9000000"
                        }
                    ],
                    previousActions: [
                        {
                            playerId: "cosmos1smallblind",
                            round: TexasHoldemRound.ANTE,
                            action: "post-small-blind",
                            amount: "1000000",
                            index: 0
                        }
                        // Note: cosmos1newjoin has NO betting actions
                    ]
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result: seat1 } = renderHook(() => usePlayerChipData(1));
            const { result: seat2 } = renderHook(() => usePlayerChipData(2));

            expect(seat1.current.chipAmount).toBe("0"); // ACTIVE but no betting actions - buy-in should NOT show
            expect(seat2.current.chipAmount).toBe("1000000"); // ACTIVE with small blind action - should show
        });
    });
});
