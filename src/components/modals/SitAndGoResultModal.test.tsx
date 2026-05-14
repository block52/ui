import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SitAndGoResultModal } from "./SitAndGoResultModal";

// Mock the data hook — the modal's trigger logic depends entirely on
// what getPlayerResult returns. By varying the mock per test we can
// drive all four states (not-finished, paid, unpaid, winner) without
// standing up a real GameStateContext.
const mockGetPlayerResult = jest.fn();
const mockIsSitAndGo = jest.fn();
jest.mock("../../hooks/game/useSitAndGoPlayerResults", () => ({
    useSitAndGoPlayerResults: () => ({
        getPlayerResult: mockGetPlayerResult,
        isSitAndGo: mockIsSitAndGo(),
        getSeatResult: jest.fn(),
        allResults: [],
        hasResults: false,
    }),
}));

// USDC formatter — fixed for this test suite. We don't care about
// exact formatting precision; we just need the payout to be a string
// that doesn't collide with "$0.00" when present.
jest.mock("../../utils/numberUtils", () => ({
    formatUSDCToSimpleDollars: (raw: string) => raw,
}));

const TABLE_ID = "0xabc";
const USER_ADDRESS = "b521user";

const setStoredAddress = (addr: string | null) => {
    if (addr === null) localStorage.removeItem("user_cosmos_address");
    else localStorage.setItem("user_cosmos_address", addr);
};

beforeEach(() => {
    localStorage.clear();
    mockGetPlayerResult.mockReset();
    mockIsSitAndGo.mockReset();
    mockIsSitAndGo.mockReturnValue(true);
    setStoredAddress(USER_ADDRESS);
});

describe("SitAndGoResultModal", () => {
    it("renders nothing when user has no tournament result yet", () => {
        mockGetPlayerResult.mockReturnValue(null);
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} />);

        expect(screen.queryByTestId("sng-result-modal")).toBeNull();
    });

    it("renders nothing when not a Sit & Go", () => {
        mockIsSitAndGo.mockReturnValue(false);
        mockGetPlayerResult.mockReturnValue({ place: 1, payout: "1000000", isWinner: true });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} />);

        expect(screen.queryByTestId("sng-result-modal")).toBeNull();
    });

    it("renders winner copy + payout for the tournament winner", () => {
        mockGetPlayerResult.mockReturnValue({ place: 1, payout: "1000000", isWinner: true });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} />);

        expect(screen.getByTestId("sng-result-modal")).toBeInTheDocument();
        expect(screen.getByTestId("sng-result-heading")).toHaveTextContent(/won the tournament/i);
        expect(screen.getByTestId("sng-result-payout")).toHaveTextContent("$1000000");
    });

    it("renders paid finish (2nd) with payout, no 'thanks for playing'", () => {
        mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} />);

        expect(screen.getByTestId("sng-result-heading")).toHaveTextContent("You finished 2nd!");
        expect(screen.getByTestId("sng-result-payout")).toHaveTextContent("$400000");
        expect(screen.queryByText(/thanks for playing/i)).toBeNull();
    });

    it("renders unpaid finish (4th of 4 in paid-3) with 'thanks for playing', no payout line", () => {
        mockGetPlayerResult.mockReturnValue({ place: 4, payout: "0", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} />);

        expect(screen.getByTestId("sng-result-heading")).toHaveTextContent("You busted out — finished 4th.");
        expect(screen.getByText(/thanks for playing/i)).toBeInTheDocument();
        expect(screen.queryByTestId("sng-result-payout")).toBeNull();
    });

    it("Leave Table button fires onLeave and persists dismissal", async () => {
        const onLeave = jest.fn();
        mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={onLeave} />);

        fireEvent.click(screen.getByTestId("sng-result-leave-btn"));

        expect(onLeave).toHaveBeenCalledTimes(1);
        // Persisted dismissal flag is now set so a remount won't re-pop the modal.
        expect(localStorage.getItem(`viewed_sng_result_${TABLE_ID}_${USER_ADDRESS.toLowerCase()}`)).toBe("true");
    });

    it("does NOT re-render on a remount once dismissed (refresh-after-close)", () => {
        mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });

        // Simulate a previous session having dismissed the modal.
        localStorage.setItem(
            `viewed_sng_result_${TABLE_ID}_${USER_ADDRESS.toLowerCase()}`,
            "true",
        );

        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} />);

        expect(screen.queryByTestId("sng-result-modal")).toBeNull();
    });

    it("does NOT render if no user address is stored (spectator)", () => {
        setStoredAddress(null);
        mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} />);

        expect(screen.queryByTestId("sng-result-modal")).toBeNull();
    });
});
