import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SitAndGoResultModal } from "./SitAndGoResultModal";

// Mock the data hook — the modal's trigger logic depends entirely on
// what getPlayerResult returns. By varying the mock per test we can
// drive all four states (not-finished, paid, unpaid, winner) without
// standing up a real GameStateContext.
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));

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

// Stub the Claim NFT flow's hooks. The render-level assertions in
// this suite cover the "Leave Table" path + content variants; the
// Claim flow has its own dedicated tests elsewhere. Mocks here are
// inert so the modal mounts cleanly.
const mockFetchSignature = jest.fn();
jest.mock("../../hooks/game/useFetchSngClaimSignature", () => ({
    useFetchSngClaimSignature: () => ({ fetchSignature: mockFetchSignature }),
}));
const mockClaim = jest.fn();
jest.mock("../../hooks/wallet/useClaimSngWinNFT", () => ({
    useClaimSngWinNFT: () => ({
        claim: mockClaim,
        hash: undefined,
        isClaimPending: false,
        isClaimConfirmed: false,
        claimError: null,
    }),
}));
jest.mock("../../hooks/wallet/useUserWalletConnect", () => ({
    __esModule: true,
    default: () => ({
        address: "0xUSER",
        isConnected: true,
        open: jest.fn(),
    }),
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
    mockFetchSignature.mockReset();
    mockClaim.mockReset();
    mockNavigate.mockReset();
    mockIsSitAndGo.mockReturnValue(true);
    setStoredAddress(USER_ADDRESS);
});

describe("SitAndGoResultModal", () => {
    it("waits while the finish is still being shown on the table (ui#874)", () => {
        mockGetPlayerResult.mockReturnValue({ place: 2, payout: "300", isWinner: false });
        const { rerender } = render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={true} />);
        expect(screen.queryByTestId("sng-result-modal")).toBeNull();

        rerender(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);
        expect(screen.getByTestId("sng-result-heading")).toHaveTextContent("You finished 2nd!");
    });

    it("renders nothing when user has no tournament result yet", () => {
        mockGetPlayerResult.mockReturnValue(null);
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);

        expect(screen.queryByTestId("sng-result-modal")).toBeNull();
    });

    it("renders nothing when not a Sit & Go", () => {
        mockIsSitAndGo.mockReturnValue(false);
        mockGetPlayerResult.mockReturnValue({ place: 1, payout: "1000000", isWinner: true });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);

        expect(screen.queryByTestId("sng-result-modal")).toBeNull();
    });

    it("renders winner copy + payout for the tournament winner", () => {
        mockGetPlayerResult.mockReturnValue({ place: 1, payout: "1000000", isWinner: true });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);

        expect(screen.getByTestId("sng-result-modal")).toBeInTheDocument();
        expect(screen.getByTestId("sng-result-heading")).toHaveTextContent(/won the tournament/i);
        expect(screen.getByTestId("sng-result-payout")).toHaveTextContent("$1000000");
    });

    it("renders paid finish (2nd) with payout, no 'thanks for playing'", () => {
        mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);

        expect(screen.getByTestId("sng-result-heading")).toHaveTextContent("You finished 2nd!");
        expect(screen.getByTestId("sng-result-payout")).toHaveTextContent("$400000");
        expect(screen.queryByText(/thanks for playing/i)).toBeNull();
    });

    it("renders unpaid finish (4th of 4 in paid-3) with 'thanks for playing', no payout line", () => {
        mockGetPlayerResult.mockReturnValue({ place: 4, payout: "0", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);

        expect(screen.getByTestId("sng-result-heading")).toHaveTextContent("You busted out — finished 4th.");
        expect(screen.getByText(/thanks for playing/i)).toBeInTheDocument();
        expect(screen.queryByTestId("sng-result-payout")).toBeNull();
    });

    it("unpaid finisher: Spectate Table button fires onLeave and persists dismissal", async () => {
        const onLeave = jest.fn();
        mockGetPlayerResult.mockReturnValue({ place: 4, payout: "0", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={onLeave} onClaim={jest.fn()} held={false} />);

        fireEvent.click(screen.getByTestId("sng-result-leave-btn"));

        expect(onLeave).toHaveBeenCalledTimes(1);
        // Persisted dismissal flag is now set so a remount won't re-pop the modal.
        expect(localStorage.getItem(`viewed_sng_result_${TABLE_ID}_${USER_ADDRESS.toLowerCase()}`)).toBe("true");
    });

    it("paid finisher: shows Claim (not Leave); claim calls onClaim then the button dismisses", async () => {
        const onClaim = jest.fn().mockResolvedValue(undefined);
        mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={onClaim} held={false} />);

        // A paid finisher claims — no Leave button is offered.
        expect(screen.queryByTestId("sng-result-leave-btn")).toBeNull();
        const claimBtn = screen.getByTestId("sng-result-claim-winnings-btn");

        fireEvent.click(claimBtn);
        await waitFor(() => expect(onClaim).toHaveBeenCalledTimes(1));
        // ui#737: after collection the Collect button never stays on "Paid";
        // it's replaced by the collected state + next actions.
        await screen.findByTestId("sng-result-prize-collected");
        expect(screen.getByTestId("sng-result-prize-collected")).toHaveTextContent("Your winnings have been collected.");
        expect(screen.getByText("WINNINGS COLLECTED")).toBeInTheDocument();
        expect(screen.getByTestId("sng-result-payout")).toHaveTextContent("$400000");
        expect(screen.queryByTestId("sng-result-claim-winnings-btn")).toBeNull();
        expect(screen.queryByText(/paid!/i)).toBeNull();
        // 2nd place: no Spectate (mirrors HODL: place > 2 only).
        expect(screen.queryByTestId("sng-result-spectate-btn")).toBeNull();

        fireEvent.click(screen.getByTestId("sng-result-return-to-lobby-btn"));
        expect(onClaim).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith("/");
        expect(localStorage.getItem(`viewed_sng_result_${TABLE_ID}_${USER_ADDRESS.toLowerCase()}`)).toBe("true");
        expect(screen.queryByTestId("sng-result-modal")).toBeNull();
    });

    it("paid 3rd place: after collecting, Spectate table closes the modal without navigating (ui#737)", async () => {
        const onClaim = jest.fn().mockResolvedValue(undefined);
        const onLeave = jest.fn();
        mockGetPlayerResult.mockReturnValue({ place: 3, payout: "200000", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={onLeave} onClaim={onClaim} held={false} />);

        expect(screen.queryByTestId("sng-result-spectate-btn")).toBeNull();
        fireEvent.click(screen.getByTestId("sng-result-claim-winnings-btn"));
        const spectate = await screen.findByTestId("sng-result-spectate-btn");
        expect(spectate).toHaveTextContent("Spectate table");
        expect(screen.getByTestId("sng-result-return-to-lobby-btn")).toHaveTextContent("Return to lobby");

        fireEvent.click(spectate);
        expect(screen.queryByTestId("sng-result-modal")).toBeNull();
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(onLeave).not.toHaveBeenCalled();
        expect(onClaim).toHaveBeenCalledTimes(1);
    });

    it("paid finisher: shows a disabled Collecting… state and ignores repeat clicks while collecting (ui#737)", async () => {
        let resolveClaim: () => void = () => undefined;
        const onClaim = jest.fn().mockReturnValue(new Promise<void>(r => { resolveClaim = r; }));
        mockGetPlayerResult.mockReturnValue({ place: 1, payout: "1000000", isWinner: true });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={onClaim} held={false} />);

        const claimBtn = screen.getByTestId("sng-result-claim-winnings-btn");
        expect(claimBtn).toHaveTextContent("Collect $1000000");
        fireEvent.click(claimBtn);
        fireEvent.click(claimBtn);
        await waitFor(() => expect(claimBtn).toHaveTextContent(/collecting/i));
        expect(claimBtn).toBeDisabled();
        fireEvent.click(claimBtn);
        expect(onClaim).toHaveBeenCalledTimes(1);

        resolveClaim();
        await screen.findByTestId("sng-result-return-to-lobby-btn");
        expect(onClaim).toHaveBeenCalledTimes(1);
    });

    it("paid finisher: a failed collection shows the error and lets the player retry (ui#737)", async () => {
        const onClaim = jest.fn()
            .mockRejectedValueOnce(new Error("network down"))
            .mockResolvedValueOnce(undefined);
        mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={onClaim} held={false} />);

        const claimBtn = screen.getByTestId("sng-result-claim-winnings-btn");
        fireEvent.click(claimBtn);
        await screen.findByTestId("sng-result-prize-claim-error");
        expect(screen.getByTestId("sng-result-prize-claim-error")).toHaveTextContent("network down");
        expect(claimBtn).toHaveTextContent("Collect $400000");
        expect(claimBtn).not.toBeDisabled();

        fireEvent.click(claimBtn);
        await screen.findByTestId("sng-result-prize-collected");
        expect(screen.queryByTestId("sng-result-prize-claim-error")).toBeNull();
        expect(onClaim).toHaveBeenCalledTimes(2);
    });

    it("paid finisher: an 'already claimed' rejection is treated as collected, not an error (ui#737)", async () => {
        const onClaim = jest.fn().mockRejectedValue(new Error("player b521user already claimed payout"));
        mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={onClaim} held={false} />);

        const claimBtn = screen.getByTestId("sng-result-claim-winnings-btn");
        fireEvent.click(claimBtn);
        await screen.findByTestId("sng-result-prize-collected");
        expect(screen.queryByTestId("sng-result-prize-claim-error")).toBeNull();
        expect(screen.queryByTestId("sng-result-claim-winnings-btn")).toBeNull();
        expect(onClaim).toHaveBeenCalledTimes(1);
    });

    it("does NOT re-render on a remount once dismissed (refresh-after-close)", () => {
        mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });

        // Simulate a previous session having dismissed the modal.
        localStorage.setItem(
            `viewed_sng_result_${TABLE_ID}_${USER_ADDRESS.toLowerCase()}`,
            "true",
        );

        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);

        expect(screen.queryByTestId("sng-result-modal")).toBeNull();
    });

    it("does NOT render if no user address is stored (spectator)", () => {
        setStoredAddress(null);
        mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });
        render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);

        expect(screen.queryByTestId("sng-result-modal")).toBeNull();
    });

    describe("Claim NFT button (block52/poker-vm#2119)", () => {
        // The button is conditionally rendered: only on paid finishes.

        it("shows the Claim NFT button for a paid finish", () => {
            mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });
            render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);
            expect(screen.getByTestId("sng-result-claim-btn")).toBeInTheDocument();
        });

        it("does NOT show the Claim NFT button for an unpaid finish", () => {
            mockGetPlayerResult.mockReturnValue({ place: 4, payout: "0", isWinner: false });
            render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);
            expect(screen.queryByTestId("sng-result-claim-btn")).toBeNull();
        });

        it("Claim flow: signature fetched → contract claim called", async () => {
            const payload = {
                recipient: "0xUSER" as const,
                gameId: "0xabc" as const,
                place: 2,
                payout: "400000",
                timestamp: 1747300000,
                format: "0xff" as const,
                signature: "0xsig" as const,
            };
            mockFetchSignature.mockResolvedValue(payload);
            mockClaim.mockResolvedValue(undefined);
            mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });

            render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);
            fireEvent.click(screen.getByTestId("sng-result-claim-btn"));

            // Both calls should fire in order.
            await new Promise(r => setTimeout(r, 0)); // flush microtasks
            expect(mockFetchSignature).toHaveBeenCalledWith(TABLE_ID, USER_ADDRESS.toLowerCase());
            expect(mockClaim).toHaveBeenCalledWith(payload);
        });

        it("surfaces the structured 'feature not yet live' error when fetchSignature throws", async () => {
            mockFetchSignature.mockRejectedValue(
                new Error("SNG win-NFT claim endpoint not yet deployed on the chain"),
            );
            mockGetPlayerResult.mockReturnValue({ place: 2, payout: "400000", isWinner: false });

            render(<SitAndGoResultModal tableId={TABLE_ID} onLeave={jest.fn()} onClaim={jest.fn()} held={false} />);
            fireEvent.click(screen.getByTestId("sng-result-claim-btn"));

            // Error renders into the dedicated error slot.
            await screen.findByTestId("sng-result-claim-error");
            expect(screen.getByTestId("sng-result-claim-error")).toHaveTextContent(
                /not yet deployed/i,
            );
            expect(mockClaim).not.toHaveBeenCalled();
        });
    });
});
