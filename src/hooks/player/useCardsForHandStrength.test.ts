/**
 * Tests for useCardsForHandStrength.
 *
 * This hook evaluates the local player's best hand and is rendered
 * unconditionally on the play page. Its inputs — `holeCards` and
 * `tableDataCommunityCards` — are rebuilt from a fresh `gameState` on every WS
 * frame, so a memo keyed on their identity misses every time and re-runs
 * `Deck.fromString` x7 plus a full hand evaluation several times a second, even
 * when the cards have not changed. The cards only change when a street is dealt.
 */
import { renderHook } from "@testing-library/react";
import { useCardsForHandStrength } from "./useCardsForHandStrength";
import { usePlayerData } from "./usePlayerData";
import { useTableData } from "../game/useTableData";
import { PokerSolver } from "@block52/poker-vm-sdk";

jest.mock("./usePlayerData");
jest.mock("../game/useTableData");
jest.mock("@block52/poker-vm-sdk", () => {
    const actual = jest.requireActual("@block52/poker-vm-sdk");
    return {
        ...actual,
        Deck: { ...actual.Deck, fromString: (card: string) => ({ mnemonic: card }) },
        PokerSolver: {
            ...actual.PokerSolver,
            evaluatePartialHand: jest.fn(() => ({
                description: "Pair of Aces",
                handType: 2,
                bestHand: [{ mnemonic: "AH" }, { mnemonic: "AD" }]
            }))
        },
        PokerGameIntegration: {
            ...actual.PokerGameIntegration,
            formatHandDescription: jest.fn(() => "Pair of Aces, Kicker King")
        }
    };
});

const mockedPlayerData = usePlayerData as jest.MockedFunction<typeof usePlayerData>;
const mockedTableData = useTableData as jest.MockedFunction<typeof useTableData>;
const mockedEvaluate = PokerSolver.evaluatePartialHand as jest.Mock;

/**
 * Fresh array identities every call, as a new WS snapshot produces. Content is
 * what the hook should key on, not identity.
 */
function withCards(hole: string[], board: string[]) {
    mockedPlayerData.mockReturnValue({ holeCards: [...hole] } as any);
    mockedTableData.mockReturnValue({ tableDataCommunityCards: [...board] } as any);
}

describe("useCardsForHandStrength", () => {
    beforeEach(() => mockedEvaluate.mockClear());

    describe("evaluation", () => {
        it("returns null without two hole cards", () => {
            withCards([], []);
            expect(renderHook(() => useCardsForHandStrength(1)).result.current).toBeNull();

            withCards(["AH"], []);
            expect(renderHook(() => useCardsForHandStrength(1)).result.current).toBeNull();
        });

        it("uses the raw description preflop (two cards)", () => {
            withCards(["AH", "AD"], []);
            const { result } = renderHook(() => useCardsForHandStrength(1));

            expect(result.current?.description).toBe("Pair of Aces");
            expect(result.current?.score).toBe(2);
            expect(result.current?.hand).toEqual(["AH", "AD"]);
        });

        it("uses the formatted description once a board exists", () => {
            withCards(["AH", "AD"], ["KS", "7C", "2H"]);
            const { result } = renderHook(() => useCardsForHandStrength(1));

            expect(result.current?.description).toBe("Pair of Aces, Kicker King");
        });

        it("returns null and does not throw when evaluation fails", () => {
            const spy = jest.spyOn(console, "error").mockImplementation(() => {});
            mockedEvaluate.mockImplementationOnce(() => {
                throw new Error("bad cards");
            });
            withCards(["ZZ", "YY"], []);

            expect(renderHook(() => useCardsForHandStrength(1)).result.current).toBeNull();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe("recomputation", () => {
        it("does not re-evaluate when a WS frame changes nothing about the cards", () => {
            withCards(["AH", "AD"], ["KS", "7C", "2H"]);
            const { rerender } = renderHook(() => useCardsForHandStrength(1));
            expect(mockedEvaluate).toHaveBeenCalledTimes(1);

            // Three more frames arrive — new arrays, identical cards.
            withCards(["AH", "AD"], ["KS", "7C", "2H"]);
            rerender();
            withCards(["AH", "AD"], ["KS", "7C", "2H"]);
            rerender();
            withCards(["AH", "AD"], ["KS", "7C", "2H"]);
            rerender();

            expect(mockedEvaluate).toHaveBeenCalledTimes(1);
        });

        it("re-evaluates once per street", () => {
            withCards(["AH", "AD"], []);
            const { rerender } = renderHook(() => useCardsForHandStrength(1));

            withCards(["AH", "AD"], ["KS", "7C", "2H"]);
            rerender();
            withCards(["AH", "AD"], ["KS", "7C", "2H", "JD"]);
            rerender();
            withCards(["AH", "AD"], ["KS", "7C", "2H", "JD", "4S"]);
            rerender();

            expect(mockedEvaluate).toHaveBeenCalledTimes(4);
        });

        it("re-evaluates when the hole cards change", () => {
            withCards(["AH", "AD"], []);
            const { rerender } = renderHook(() => useCardsForHandStrength(1));

            withCards(["KH", "KD"], []);
            rerender();

            expect(mockedEvaluate).toHaveBeenCalledTimes(2);
        });

        it("keeps a stable result identity across unchanged frames", () => {
            // Consumers put this in dep arrays; a fresh object every frame would
            // invalidate everything downstream.
            withCards(["AH", "AD"], ["KS", "7C", "2H"]);
            const { result, rerender } = renderHook(() => useCardsForHandStrength(1));
            const first = result.current;

            withCards(["AH", "AD"], ["KS", "7C", "2H"]);
            rerender();

            expect(result.current).toBe(first);
        });
    });
});
