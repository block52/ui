import { renderHook } from "@testing-library/react";
import { PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { usePlayerChipData } from "./usePlayerChipData";
import { useGameStateContext } from "../../context/GameStateContext";

// Mock the GameStateContext
jest.mock("../../context/GameStateContext");

const mockUseGameStateContext = useGameStateContext as jest.MockedFunction<typeof useGameStateContext>;

describe("usePlayerChipData", () => {
    beforeEach(() => {
        jest.clearAllMocks();
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

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(1)).toBe("0");
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

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(2)).toBe("0");
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

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(3)).toBe("0");
        });

        it("should show chips for ACTIVE player with sumOfBets during ante", () => {
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
                    previousActions: []
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(1)).toBe("500000");
        });

        it("should show chips for ACTIVE player with sumOfBets during preflop", () => {
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
                    previousActions: []
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(2)).toBe("2000000");
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
                            amount: "5000000"
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

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(3)).toBe("5000000");
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
                            amount: "1000000"
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

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(4)).toBe("1000000");
        });
    });

    describe("Round-based Chip Display", () => {
        it("should use sumOfBets during ANTE round for active players", () => {
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
                    previousActions: []
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(1)).toBe("100000");
        });

        it("should use sumOfBets during PREFLOP round for active players", () => {
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
                    previousActions: []
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(1)).toBe("2000000");
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
                            amount: "2000000" // Preflop bet
                        },
                        {
                            playerId: "cosmos1player",
                            round: TexasHoldemRound.FLOP,
                            amount: "3000000" // Flop bet (current round)
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

            const { result } = renderHook(() => usePlayerChipData());

            // Should only show current round (FLOP) betting: 3000000
            expect(result.current.getChipAmount(1)).toBe("3000000");
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
                            amount: "2000000" // First river bet
                        },
                        {
                            playerId: "cosmos1player",
                            round: TexasHoldemRound.RIVER,
                            amount: "3000000" // Raise on river
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

            const { result } = renderHook(() => usePlayerChipData());

            // Should sum both river bets: 2000000 + 3000000 = 5000000
            expect(result.current.getChipAmount(1)).toBe("5000000");
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

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(5)).toBe("0");
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

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(1)).toBe("0");
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

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.isLoading).toBe(true);
            expect(result.current.getChipAmount(1)).toBe("0");
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

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.error).toEqual(new Error("Connection failed"));
            expect(result.current.getChipAmount(1)).toBe("0");
        });
    });

    describe("Multiple Players", () => {
        it("should correctly filter SEATED vs ACTIVE players", () => {
            mockUseGameStateContext.mockReturnValue({
                gameState: {
                    round: TexasHoldemRound.PREFLOP,
                    players: [
                        {
                            seat: 1,
                            address: "cosmos1seated",
                            status: PlayerStatus.SEATED,
                            sumOfBets: "5000000", // Buy-in (should NOT show)
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
                    previousActions: []
                },
                isLoading: false,
                error: null,
                gameFormat: "cash",
                validationError: null,
                subscribeToTable: jest.fn(),
                unsubscribeFromTable: jest.fn()
            } as any);

            const { result } = renderHook(() => usePlayerChipData());

            expect(result.current.getChipAmount(1)).toBe("0"); // SEATED - no chips shown
            expect(result.current.getChipAmount(2)).toBe("1000000"); // ACTIVE - small blind
            expect(result.current.getChipAmount(3)).toBe("2000000"); // ACTIVE - big blind
        });
    });
});
