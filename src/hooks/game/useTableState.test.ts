/**
 * Tests for useTableState.
 *
 * Two things worth pinning: the pot fallback chain, and that `tableSize` is
 * never fabricated while loading (#466 -- a placeholder seat count caused a
 * visible 9 -> real flash). The hook also had no memoization, so every consumer
 * re-ran formatMicroAsUsdc and rebuilt two objects on every render.
 */
import { renderHook } from "@testing-library/react";
import { useTableState } from "./useTableState";
import { useGameData } from "../../context/gameState/GameDataContext";
import { useGameMeta } from "../../context/gameState/GameMetaContext";
import { useGameUI } from "../../context/gameState/GameUIContext";
import { formatMicroAsUsdc } from "../../constants/currency";
import { TexasHoldemRound, GameFormat } from "@block52/poker-vm-sdk";

jest.mock("../../context/gameState/GameDataContext");
jest.mock("../../context/gameState/GameMetaContext");
jest.mock("../../context/gameState/GameUIContext");

const mockedData = useGameData as jest.MockedFunction<typeof useGameData>;
const mockedMeta = useGameMeta as jest.MockedFunction<typeof useGameMeta>;
const mockedUI = useGameUI as jest.MockedFunction<typeof useGameUI>;

function withState(state: unknown, over: { isLoading?: boolean; error?: Error | null; gameFormat?: unknown } = {}) {
    mockedData.mockReturnValue({ gameState: state } as any);
    mockedMeta.mockReturnValue({ gameFormat: over.gameFormat ?? GameFormat.CASH } as any);
    mockedUI.mockReturnValue({ isLoading: over.isLoading ?? false, error: over.error ?? null } as any);
}

function tableState(over: Record<string, unknown> = {}) {
    return {
        totalPot: "2500000",
        pots: ["1000000"],
        round: TexasHoldemRound.FLOP,
        gameOptions: { maxPlayers: 6 },
        ...over
    };
}

describe("useTableState", () => {
    afterEach(() => jest.clearAllMocks());

    describe("pot resolution", () => {
        it("prefers totalPot", () => {
            withState(tableState());
            const { result } = renderHook(() => useTableState());

            expect(result.current.totalPot).toBe("2500000");
            expect(result.current.formattedTotalPot).toBe(formatMicroAsUsdc("2500000"));
        });

        it("falls back to the main pot when totalPot is absent", () => {
            withState(tableState({ totalPot: undefined }));
            expect(renderHook(() => useTableState()).result.current.totalPot).toBe("1000000");
        });

        it("reports zero when there is neither", () => {
            withState(tableState({ totalPot: undefined, pots: [] }));
            expect(renderHook(() => useTableState()).result.current.totalPot).toBe("0");
        });
    });

    describe("table shape", () => {
        it("reads tableSize from gameOptions.maxPlayers", () => {
            withState(tableState());
            expect(renderHook(() => useTableState()).result.current.tableSize).toBe(6);
        });

        it("exposes the round as both currentRound and roundType", () => {
            withState(tableState({ round: TexasHoldemRound.RIVER }));
            const { result } = renderHook(() => useTableState());

            expect(result.current.currentRound).toBe(TexasHoldemRound.RIVER);
            expect(result.current.roundType).toBe(TexasHoldemRound.RIVER);
        });
    });

    describe("loading and error", () => {
        it("never fabricates a seat count while loading (#466)", () => {
            withState(tableState(), { isLoading: true });
            const { result } = renderHook(() => useTableState());

            expect(result.current.tableSize).toBe(0);
            expect(result.current.isLoading).toBe(true);
        });

        it("returns the default state with no game state", () => {
            withState(undefined);
            expect(renderHook(() => useTableState()).result.current.tableSize).toBe(0);
        });

        it("surfaces an error rather than masking a missing gameOptions", () => {
            // Commandment 6/7: maxPlayers is required, so a missing gameOptions is
            // a chain bug that must surface, not be defaulted away.
            const spy = jest.spyOn(console, "error").mockImplementation(() => {});
            withState(tableState({ gameOptions: undefined }));
            const { result } = renderHook(() => useTableState());

            expect(result.current.error).toBeInstanceOf(Error);
            expect(result.current.tableSize).toBe(0);
            spy.mockRestore();
        });
    });

    describe("recomputation", () => {
        it("keeps a stable identity when the snapshot has not changed", () => {
            withState(tableState());
            const { result, rerender } = renderHook(() => useTableState());
            const first = result.current;

            rerender();
            rerender();

            expect(result.current).toBe(first);
        });

        it("recomputes when the pot changes", () => {
            withState(tableState());
            const { result, rerender } = renderHook(() => useTableState());

            withState(tableState({ totalPot: "9000000" }));
            rerender();

            expect(result.current.totalPot).toBe("9000000");
        });
    });
});
