/**
 * Tests for the ActionsLog component.
 *
 * The rows are the expensive part: `formatAmount` runs ethers formatting PER
 * ROW, across the whole hand's action log. `previousActions` is a fresh array on
 * every WS frame, so the rows used to be rebuilt several times a second — and
 * because TableSidebar hides the panel with a CSS class rather than unmounting
 * it, that happened even while nobody could see it.
 */
import { render, screen } from "@testing-library/react";
import ActionsLog from "./ActionsLog";
import { useGameProgress } from "../hooks/game/useGameProgress";
import { useWinnerInfo } from "../hooks/game/useWinnerInfo";
import { useGameStateContext } from "../context/GameStateContext";
import { formatAmount } from "../utils/accountUtils";
import { TexasHoldemRound, PlayerActionType } from "@block52/poker-vm-sdk";

jest.mock("react-router-dom", () => ({ useParams: () => ({ id: "0xtable" }) }));
jest.mock("../hooks/game/useGameProgress");
jest.mock("../hooks/game/useWinnerInfo");
jest.mock("../context/GameStateContext");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../utils/accountUtils", () => ({
    ...jest.requireActual("../utils/accountUtils"),
    formatAmount: jest.fn(() => "1.00")
}));

const mockedProgress = useGameProgress as jest.MockedFunction<typeof useGameProgress>;
const mockedWinner = useWinnerInfo as jest.MockedFunction<typeof useWinnerInfo>;
const mockedContext = useGameStateContext as jest.MockedFunction<typeof useGameStateContext>;
const mockedFormatAmount = formatAmount as jest.Mock;

function action(index: number, over: Record<string, unknown> = {}) {
    return {
        playerId: "0xa",
        seat: 1,
        action: PlayerActionType.CALL,
        amount: "1000000",
        round: TexasHoldemRound.PREFLOP,
        index,
        timestamp: 0,
        ...over
    };
}

/** Fresh array identities each call, as a new WS snapshot produces. */
function withLog(actions: ReturnType<typeof action>[], over: { round?: TexasHoldemRound; winners?: unknown[] } = {}) {
    mockedProgress.mockReturnValue({ previousActions: actions.map(a => ({ ...a })) } as any);
    mockedContext.mockReturnValue({
        gameState: { round: over.round ?? TexasHoldemRound.PREFLOP, previousActions: actions },
        gameFormat: "cash"
    } as any);
    mockedWinner.mockReturnValue({ winnerInfo: (over.winners ?? null) as any, winnerBySeat: new Map(), error: null } as any);
}

describe("ActionsLog", () => {
    beforeEach(() => mockedFormatAmount.mockClear());
    afterEach(() => jest.clearAllMocks());

    describe("rendering", () => {
        it("shows a placeholder with no actions", () => {
            withLog([]);
            render(<ActionsLog />);
            expect(screen.getByText("No actions recorded yet.")).toBeInTheDocument();
        });

        it("renders one row per action, with seat and round", () => {
            withLog([action(1), action(2, { seat: 3, round: TexasHoldemRound.FLOP })]);
            render(<ActionsLog />);

            expect(screen.getByText(/Seat 1/)).toBeInTheDocument();
            expect(screen.getByText(/Seat 3/)).toBeInTheDocument();
            expect(screen.queryByText("No actions recorded yet.")).not.toBeInTheDocument();
        });

        it("appends winner rows once the hand ends", () => {
            withLog([action(1)], {
                round: TexasHoldemRound.END,
                winners: [{ seat: 2, formattedAmount: "$5.00", description: "Two Pair", winType: "showdown" }]
            });
            render(<ActionsLog />);

            expect(screen.getByText(/WINS \$5.00/)).toBeInTheDocument();
            expect(screen.getByText(/Showdown/)).toBeInTheDocument();
        });

        it("does not show winner rows before the hand ends", () => {
            withLog([action(1)], {
                round: TexasHoldemRound.RIVER,
                winners: [{ seat: 2, formattedAmount: "$5.00", description: "Two Pair", winType: "showdown" }]
            });
            render(<ActionsLog />);

            expect(screen.queryByText(/WINS/)).not.toBeInTheDocument();
        });
    });

    describe("row rebuilds", () => {
        it("does not reformat rows when a frame changes nothing in the log", () => {
            const log = [action(1), action(2), action(3)];
            withLog(log);
            const { rerender } = render(<ActionsLog />);
            expect(mockedFormatAmount).toHaveBeenCalledTimes(3);

            // Three more frames — new arrays, same actions.
            withLog(log);
            rerender(<ActionsLog />);
            withLog(log);
            rerender(<ActionsLog />);
            withLog(log);
            rerender(<ActionsLog />);

            expect(mockedFormatAmount).toHaveBeenCalledTimes(3);
        });

        it("rebuilds when a new action lands", () => {
            withLog([action(1), action(2)]);
            const { rerender } = render(<ActionsLog />);
            expect(mockedFormatAmount).toHaveBeenCalledTimes(2);

            withLog([action(1), action(2), action(3)]);
            rerender(<ActionsLog />);

            // Three rows reformatted, so six calls in total.
            expect(mockedFormatAmount).toHaveBeenCalledTimes(5);
        });

        it("rebuilds when the log resets for a new hand", () => {
            // previousActions is replaced per hand while indices keep climbing,
            // so a same-length log with different indices must not be cached.
            withLog([action(10), action(11)]);
            const { rerender } = render(<ActionsLog />);
            expect(mockedFormatAmount).toHaveBeenCalledTimes(2);

            withLog([action(20), action(21)]);
            rerender(<ActionsLog />);

            expect(mockedFormatAmount).toHaveBeenCalledTimes(4);
        });
    });
});
