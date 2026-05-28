import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TexasHoldemRound } from "@block52/poker-vm-sdk";

// Stub the shared Modal shell — its SVG/colorConfig stack relies on Vite's
// import.meta.env which Jest can't load. The test only needs to inspect the
// modal body content, so a plain pass-through is enough.
jest.mock("../common", () => ({
    Modal: ({ children, title }: { children: React.ReactNode; title?: string }) => (
        <div data-testid="modal" data-title={title}>{children}</div>
    ),
    LoadingSpinner: () => <span data-testid="loading-spinner" />
}));

jest.mock("../../context/GameStateContext");

// eslint-disable-next-line import/first
import TopUpModal from "./TopUpModal";
// eslint-disable-next-line import/first
import { useGameStateContext } from "../../context/GameStateContext";

const mockUseGameStateContext = useGameStateContext as jest.MockedFunction<typeof useGameStateContext>;

// Stack/buy-in inputs are USDC micro-units (6 decimals).
const TEN_USDC = "10000000";
const FIFTY_USDC = "50000000";
const ONE_HUNDRED_USDC = "100000000";

const baseProps = {
    tableId: "table-1",
    currentStack: TEN_USDC,
    minBuyIn: TEN_USDC,
    maxBuyIn: ONE_HUNDRED_USDC,
    walletBalance: FIFTY_USDC,
    onClose: jest.fn()
};

const mockGameState = (round: TexasHoldemRound) => {
    mockUseGameStateContext.mockReturnValue({
        gameState: { round },
        isLoading: false,
        error: null,
        gameFormat: "cash",
        validationError: null,
        subscribeToTable: jest.fn(),
        unsubscribeFromTable: jest.fn()
    } as unknown as ReturnType<typeof useGameStateContext>);
};

describe("TopUpModal — confirmation copy (issue #2141 AC-4)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("shows the deferred-credit message after submit when the hand is in progress", async () => {
        mockGameState(TexasHoldemRound.FLOP);
        const onTopUp = jest.fn().mockResolvedValue(undefined);

        render(<TopUpModal {...baseProps} onTopUp={onTopUp} />);

        await userEvent.click(screen.getByRole("button", { name: /^BUY$/ }));

        await waitFor(() => {
            expect(
                screen.getByText("Top-up confirmed. Chips will be added from the next hand.")
            ).toBeInTheDocument();
        });
        expect(onTopUp).toHaveBeenCalledTimes(1);
    });

    it("shows the immediate-credit message after submit at END (between hands)", async () => {
        mockGameState(TexasHoldemRound.END);
        const onTopUp = jest.fn().mockResolvedValue(undefined);

        render(<TopUpModal {...baseProps} onTopUp={onTopUp} />);

        await userEvent.click(screen.getByRole("button", { name: /^BUY$/ }));

        await waitFor(() => {
            expect(
                screen.getByText("Top-up confirmed. Chips added to your stack.")
            ).toBeInTheDocument();
        });
    });

    it("shows the immediate-credit message at ANTE (pre-hand / blinds setup)", async () => {
        mockGameState(TexasHoldemRound.ANTE);
        const onTopUp = jest.fn().mockResolvedValue(undefined);

        render(<TopUpModal {...baseProps} onTopUp={onTopUp} />);

        await userEvent.click(screen.getByRole("button", { name: /^BUY$/ }));

        await waitFor(() => {
            expect(
                screen.getByText("Top-up confirmed. Chips added to your stack.")
            ).toBeInTheDocument();
        });
    });
});
