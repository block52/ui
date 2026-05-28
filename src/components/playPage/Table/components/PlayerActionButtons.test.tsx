import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NonPlayerActionType, PlayerStatus } from "@block52/poker-vm-sdk";
import { PlayerActionButtons, PlayerActionButtonsProps } from "./PlayerActionButtons";
import { SIT_IN_METHOD_POST_NOW } from "../../../../hooks/playerActions";
import type { NetworkEndpoints } from "../../../../context/NetworkContext";

// Mock BuyChipsButton to avoid import.meta.env issues
jest.mock("../../../BuyChipsButton", () => {
    return function MockBuyChipsButton() { return null; };
});

// Mock useTableTopUp hook
jest.mock("../../../../hooks/game/useTableTopUp", () => ({
    useTableTopUp: () => ({ topUp: jest.fn(), loading: false, error: null }),
}));

// Mock action handlers
const mockHandleSitIn = jest.fn();
const mockHandleSitOut = jest.fn();
jest.mock("../../../common/actionHandlers", () => ({
    handleSitIn: (...args: unknown[]) => mockHandleSitIn(...args),
    handleSitOut: (...args: unknown[]) => mockHandleSitOut(...args),
}));

// Mock GameStateContext — the sit-in dirty state added in block52/ui#367
// reads actionCount from this context. These tests don't exercise that
// pathway (they assert render structure + click handlers), so a static
// stub is sufficient.
jest.mock("../../../../context/GameStateContext", () => ({
    useGameStateContext: () => ({ gameState: { actionCount: 0 } }),
}));

// Mock GameSettingsContext — the seat-at-bottom toggle added in
// block52/ui#392 reads from this context. Static stub keeps these
// render/click tests focused on the existing behaviour.
const mockToggleSeatAtBottom = jest.fn();
jest.mock("../../../../context/GameSettingsContext", () => ({
    useGameSettings: () => ({
        seatAtBottom: true,
        toggleSeatAtBottom: mockToggleSeatAtBottom,
    }),
}));

// Mock getPlayerActionDisplay — import the real module so we can spy on it
jest.mock("../../../../utils/playerActionDisplayUtils", () => {
    const actual = jest.requireActual("../../../../utils/playerActionDisplayUtils");
    return {
        ...actual,
        getPlayerActionDisplay: jest.fn(actual.getPlayerActionDisplay),
    };
});

const mockNetwork: NetworkEndpoints = {
    name: "test",
    rpc: "http://localhost:26657",
    rest: "http://localhost:1317",
    grpc: "localhost:9090",
    ws: "ws://localhost:26657/websocket",
};

const action = (a: string) => ({
    action: a as NonPlayerActionType,
    min: undefined,
    max: undefined,
    index: 0,
});

const baseProps: PlayerActionButtonsProps = {
    isMobile: false,
    isMobileLandscape: false,
    legalActions: [],
    tableId: "table-123",
    currentNetwork: mockNetwork,
    playerStatus: null,
    sitInMethod: null,
    pendingSitOut: null,
    totalSeatedPlayers: 0,
    handNumber: 1,
    hasActivePlayers: false,
    currentStack: "0",
    minBuyIn: "100000000",
    maxBuyIn: "1000000000",
    walletBalance: "500000000",
    isCurrentUserSeated: true,
    isTableFull: false,
};

beforeEach(() => {
    mockHandleSitIn.mockClear();
    mockHandleSitOut.mockClear();
});

describe("PlayerActionButtons", () => {
    it("renders only the Top-Up Chips wrapper when display kind is none and no top-up legal (#401)", () => {
        const { container } = render(
            <PlayerActionButtons
                {...baseProps}
                totalSeatedPlayers={3}
                handNumber={2}
                legalActions={[]}
            />
        );
        // Per #401 AC-1 the Top-Up Chips button slot is always present while seated;
        // its inner BuyChipsButton (mocked here) renders disabled when chain rejects.
        // Confirm: a single wrapper div, no other action panels.
        expect(container.children).toHaveLength(1);
        expect(container.firstChild).toHaveClass("fixed", "z-30");
    });

    it("renders waiting for players message for solo player", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                totalSeatedPlayers={1}
            />
        );
        expect(screen.getByText("Waiting for players to join...")).toBeInTheDocument();
    });

    it("renders sit-in button for sit-in-options", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_IN)]}
                totalSeatedPlayers={3}
                handNumber={5}
                hasActivePlayers={true}
            />
        );
        expect(screen.getByRole("button", { name: "Sit In Next Hand" })).toBeInTheDocument();
    });

    it("sit-in button calls handleSitIn with POST_NOW", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_IN)]}
                totalSeatedPlayers={3}
                handNumber={5}
                hasActivePlayers={true}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: "Sit In Next Hand" }));
        expect(mockHandleSitIn).toHaveBeenCalledWith(
            "table-123",
            mockNetwork,
            SIT_IN_METHOD_POST_NOW
        );
    });

    it("does NOT render Sit In Next Big Blind text anywhere", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_IN)]}
                totalSeatedPlayers={3}
                handNumber={5}
                hasActivePlayers={true}
            />
        );
        expect(screen.queryByText(/Sit In Next Big Blind/i)).not.toBeInTheDocument();
    });

    it("renders pending state with waiting message", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                playerStatus={PlayerStatus.SITTING_IN}
                totalSeatedPlayers={3}
                sitInMethod={SIT_IN_METHOD_POST_NOW}
            />
        );
        expect(screen.getByText("Waiting to sit in...")).toBeInTheDocument();
    });

    it("shows spectator message and join hint when user is not seated and table is not full", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                isCurrentUserSeated={false}
                isTableFull={false}
            />
        );
        expect(screen.getByText("You are spectating this table")).toBeInTheDocument();
        expect(screen.getByText("To join the table, click on an available seat.")).toBeInTheDocument();
    });

    it("renders both sit-out checkboxes when SIT_OUT action available", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_OUT)]}
                totalSeatedPlayers={3}
                handNumber={2}
            />
        );
        expect(screen.getAllByRole("checkbox")).toHaveLength(2);
        expect(screen.getByText("Sit Out Next Hand")).toBeInTheDocument();
        expect(screen.getByText("Sit Out Next Big Blind")).toBeInTheDocument();
    });
});
