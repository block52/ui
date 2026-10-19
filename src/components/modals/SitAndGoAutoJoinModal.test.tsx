import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SitAndGoAutoJoinModal from "./SitAndGoAutoJoinModal";
import { STORAGE_KEYS } from "../../constants/storageKeys";

// The modal must be dismissible so a player who is late to the tournament or
// short on funds can still WATCH the table instead of being stuck behind the
// overlay (ui#837). These tests drive the dismiss/reopen paths; the join flow
// itself is chain-side and exercised elsewhere.

const mockGameOptions = jest.fn();
jest.mock("../../hooks/game/useGameOptions", () => ({
    useGameOptions: () => ({ gameOptions: mockGameOptions() }),
}));

const mockVacantSeatData = jest.fn();
jest.mock("../../hooks/game/useVacantSeatData", () => ({
    useVacantSeatData: () => mockVacantSeatData(),
}));

jest.mock("../../context/NetworkContext", () => ({
    useNetwork: () => ({ currentNetwork: { id: "test" } }),
}));

jest.mock("../../context/GameStateContext", () => ({
    useGameStateContext: () => ({
        subscribeToTable: jest.fn(),
        gameState: { players: [] },
    }),
}));

const mockGetCosmosBalance = jest.fn();
jest.mock("../../utils/cosmosAccountUtils", () => ({
    getCosmosBalance: (...args: unknown[]) => mockGetCosmosBalance(...args),
}));

jest.mock("../../hooks/playerActions/joinTable", () => ({
    joinTable: jest.fn(),
}));

const TABLE_ID = "0xabc";

const GAME_OPTIONS = {
    maxBuyIn: "10000000", // $10
    minBuyIn: "10000000",
    smallBlind: "10",
    bigBlind: "20",
    startingStack: "1500",
    minPlayers: 2,
    maxPlayers: 9,
    entryFee: "0",
};

const renderModal = () => render(<SitAndGoAutoJoinModal tableId={TABLE_ID} onJoinSuccess={jest.fn()} />);

// Balance fetch resolves asynchronously on mount; await the settled button
// label so assertions run after the loading state (and inside act()).
const renderModalSettled = async () => {
    const result = renderModal();
    await screen.findByTestId("sng-autojoin-modal");
    await screen.findByText(/take my seat|insufficient balance/i);
    return result;
};

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.cosmosAddress, "b521user");
    mockGameOptions.mockReturnValue(GAME_OPTIONS);
    mockVacantSeatData.mockReturnValue({ emptySeatIndexes: [2, 3], isUserAlreadyPlaying: false });
    mockGetCosmosBalance.mockReset();
    mockGetCosmosBalance.mockResolvedValue("100000000"); // $100 — enough
});

describe("SitAndGoAutoJoinModal dismissal (ui#837)", () => {
    it("renders the modal with close and spectate controls", async () => {
        await renderModalSettled();

        expect(screen.getByTestId("sng-autojoin-modal")).toBeInTheDocument();
        expect(screen.getByTestId("sng-autojoin-close-btn")).toBeInTheDocument();
        expect(screen.getByTestId("sng-autojoin-spectate-btn")).toBeInTheDocument();
    });

    it("close button dismisses the overlay and shows the reopen pill", async () => {
        await renderModalSettled();

        fireEvent.click(screen.getByTestId("sng-autojoin-close-btn"));

        expect(screen.queryByTestId("sng-autojoin-modal")).toBeNull();
        expect(screen.getByTestId("sng-autojoin-reopen-btn")).toBeInTheDocument();
    });

    it("player with insufficient balance can still dismiss and spectate", async () => {
        mockGetCosmosBalance.mockResolvedValue("1000000"); // $1 — below the $10 buy-in
        await renderModalSettled();

        // Join is blocked...
        expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();

        // ...but watching is not.
        fireEvent.click(screen.getByTestId("sng-autojoin-spectate-btn"));
        expect(screen.queryByTestId("sng-autojoin-modal")).toBeNull();
        expect(screen.getByTestId("sng-autojoin-reopen-btn")).toBeInTheDocument();
    });

    it("late player (cancelled tournament) can still dismiss and spectate", async () => {
        mockGameOptions.mockReturnValue({
            ...GAME_OPTIONS,
            // Start time in the past with 0 registered of 2 → phase "cancelled"
            scheduledStartTime: Math.floor(Date.now() / 1000) - 3600,
        });
        await renderModalSettled();

        expect(screen.getByTestId("scheduled-cancelled")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("sng-autojoin-spectate-btn"));
        expect(screen.queryByTestId("sng-autojoin-modal")).toBeNull();
    });

    it("reopen pill restores the modal", async () => {
        await renderModalSettled();

        fireEvent.click(screen.getByTestId("sng-autojoin-spectate-btn"));
        fireEvent.click(screen.getByTestId("sng-autojoin-reopen-btn"));

        expect(screen.getByTestId("sng-autojoin-modal")).toBeInTheDocument();
        expect(screen.queryByTestId("sng-autojoin-reopen-btn")).toBeNull();
    });

    it("Escape key dismisses the modal", async () => {
        await renderModalSettled();

        fireEvent.keyDown(document, { key: "Escape" });

        expect(screen.queryByTestId("sng-autojoin-modal")).toBeNull();
        expect(screen.getByTestId("sng-autojoin-reopen-btn")).toBeInTheDocument();
    });

    it("backdrop click dismisses, click inside the panel does not", async () => {
        await renderModalSettled();

        fireEvent.click(screen.getByTestId("sng-autojoin-close-btn").parentElement as HTMLElement);
        expect(screen.getByTestId("sng-autojoin-modal")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("sng-autojoin-modal"));
        expect(screen.queryByTestId("sng-autojoin-modal")).toBeNull();
    });

    it("renders nothing at all when the user is already seated", async () => {
        mockVacantSeatData.mockReturnValue({ emptySeatIndexes: [2, 3], isUserAlreadyPlaying: true });
        renderModal();

        // Flush the mount-time balance fetch so its setState lands inside act()
        await waitFor(() => expect(mockGetCosmosBalance).toHaveBeenCalled());

        expect(screen.queryByTestId("sng-autojoin-modal")).toBeNull();
        expect(screen.queryByTestId("sng-autojoin-reopen-btn")).toBeNull();
    });
});
