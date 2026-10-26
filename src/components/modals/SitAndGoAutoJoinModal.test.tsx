import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SitAndGoAutoJoinModal from "./SitAndGoAutoJoinModal";
import { STORAGE_KEYS } from "../../constants/storageKeys";

// ui#837: a late (registration closed) or underfunded player must be able to
// dismiss the entry prompt and spectate instead of being trapped behind it.

let mockLatePhase: string = "not-started";
const mockBalance = jest.fn();
const mockJoin = jest.fn();

jest.mock("../../hooks/game/useGameOptions", () => ({
    useGameOptions: () => ({
        gameOptions: { maxBuyIn: "10000000", minBuyIn: "10000000", smallBlind: "100", bigBlind: "200", startingStack: "10000", maxPlayers: 6, minPlayers: 2, entryFee: "0" }
    })
}));
jest.mock("../../hooks/game/useVacantSeatData", () => ({
    useVacantSeatData: () => ({ emptySeatIndexes: [1, 2, 3], isUserAlreadyPlaying: false })
}));
jest.mock("../../hooks/playerActions/joinTable", () => ({ joinTable: (...args: unknown[]) => mockJoin(...args) }));
jest.mock("../../utils/cosmosAccountUtils", () => ({ getCosmosBalance: (...args: unknown[]) => mockBalance(...args) }));
jest.mock("../../context/NetworkContext", () => ({ useNetwork: () => ({ currentNetwork: { name: "fixture" } }) }));
jest.mock("../../context/GameStateContext", () => ({
    useGameStateContext: () => ({ subscribeToTable: jest.fn(), gameState: { players: [], gameOptions: {} } })
}));
jest.mock("../../utils/scheduledSng", () => ({
    ...jest.requireActual("../../utils/scheduledSng"),
    lateRegistrationPhase: () => mockLatePhase,
    lateRegistrationEndsAt: () => undefined,
    scheduledSngPhase: () => "unscheduled"
}));

const renderModal = () => render(<SitAndGoAutoJoinModal tableId="fixture-table" onJoinSuccess={jest.fn()} />);

beforeEach(() => {
    jest.clearAllMocks();
    mockLatePhase = "not-started";
    localStorage.setItem(STORAGE_KEYS.cosmosAddress, "fixture-address");
});

it("lets an underfunded player dismiss the prompt to watch", async () => {
    mockBalance.mockResolvedValue("0");
    renderModal();
    await waitFor(() => expect(screen.getByText("Insufficient Balance")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Watch instead" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockJoin).not.toHaveBeenCalled();
});

it("lets a late player dismiss the prompt once registration has closed", async () => {
    mockLatePhase = "closed";
    mockBalance.mockResolvedValue("50000000");
    renderModal();
    expect(await screen.findByTestId("late-registration-closed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Watch instead" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockJoin).not.toHaveBeenCalled();
});

it("closes on Escape", async () => {
    mockBalance.mockResolvedValue("0");
    renderModal();
    const dialog = await screen.findByRole("dialog", { name: "Sit & Go Tournament" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("still offers the seat to a funded player while registration is open", async () => {
    mockLatePhase = "open";
    mockBalance.mockResolvedValue("50000000");
    renderModal();
    await waitFor(() => expect(screen.getByRole("button", { name: "Take My Seat" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Watch instead" })).toBeInTheDocument();
});
