import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Stub the shared Modal shell + colorConfig — they both rely on Vite's
// import.meta.env, which Jest can't load. Test only needs to inspect the
// modal body content.
jest.mock("../common", () => ({
    Modal: ({ children, title }: { children: React.ReactNode; title?: string }) => (
        <div data-testid="modal" data-title={title}>{children}</div>
    ),
    LoadingSpinner: () => <span data-testid="loading-spinner" />
}));

jest.mock("../../utils/colorConfig", () => ({
    colors: { accent: { danger: "#ff0000" } }
}));

import ForceCloseTableModal from "./ForceCloseTableModal";

const baseProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue(undefined),
    gameId: "0xa41af2f2e414dcebce35b097d90dac45ee20b7ad566486932d959d488a066003",
    seatedPlayerCount: 3
};

describe("ForceCloseTableModal", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders the kick-and-refund warning copy and truncated table id", () => {
        render(<ForceCloseTableModal {...baseProps} />);
        // Warning bullets — kicked off + refunded + permanently removed.
        expect(screen.getByText(/kicked off the table/i)).toBeInTheDocument();
        expect(screen.getByText(/refunded to their wallets/i)).toBeInTheDocument();
        expect(screen.getByText(/permanently removed/i)).toBeInTheDocument();
        // Player count rendered with correct pluralization for 3 players.
        expect(screen.getByText(/All 3 players/i)).toBeInTheDocument();
        // Table id truncated to 6 chars + ... + last 6.
        expect(screen.getByText(/0xa41a\.\.\.066003/)).toBeInTheDocument();
    });

    it("uses singular 'player' when only one seat is occupied", () => {
        render(<ForceCloseTableModal {...baseProps} seatedPlayerCount={1} />);
        expect(screen.getByText(/All 1 player/i)).toBeInTheDocument();
        expect(screen.queryByText(/All 1 players/i)).not.toBeInTheDocument();
    });

    it("calls onConfirm + onClose when the user confirms", async () => {
        const onConfirm = jest.fn().mockResolvedValue(undefined);
        const onClose = jest.fn();
        render(<ForceCloseTableModal {...baseProps} onConfirm={onConfirm} onClose={onClose} />);

        await userEvent.click(screen.getByRole("button", { name: /Close Table & Refund/i }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("keeps the modal open and surfaces the error when onConfirm rejects", async () => {
        const onConfirm = jest.fn().mockRejectedValue(new Error("chain returned: not the creator"));
        const onClose = jest.fn();
        render(<ForceCloseTableModal {...baseProps} onConfirm={onConfirm} onClose={onClose} />);

        await userEvent.click(screen.getByRole("button", { name: /Close Table & Refund/i }));

        // Modal does NOT close on error — user can correct and retry.
        await waitFor(() => expect(onConfirm).toHaveBeenCalled());
        expect(onClose).not.toHaveBeenCalled();
    });

    it("calls onClose when the user cancels", async () => {
        const onClose = jest.fn();
        render(<ForceCloseTableModal {...baseProps} onClose={onClose} />);
        await userEvent.click(screen.getByRole("button", { name: /Cancel/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
