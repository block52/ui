import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameFormat, NonPlayerActionType, PlayerStatus } from "@block52/poker-vm-sdk";
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

// Mock the action submission controller hook — sit-in/out now route through it.
const mockSubmit = jest.fn();
jest.mock("../../../../context/ActionSubmitContext", () => ({
    useActionSubmit: () => ({ submit: mockSubmit, loadingAction: null, isBusy: false, lastError: null }),
}));

// Mock GameStateContext — the sit-in dirty state added in block52/ui#367
// reads actionCount from this context. These tests don't exercise that
// pathway (they assert render structure + click handlers), so a static
// stub is sufficient.
const mockGameStateContext = { gameState: { actionCount: 0 }, gameFormat: undefined as GameFormat | undefined };
jest.mock("../../../../context/GameStateContext", () => ({
    useGameStateContext: () => mockGameStateContext,
}));

// Mock GameSettingsContext — the seat-at-bottom toggle added in
// block52/ui#392 reads from this context. Static stub keeps these
// render/click tests focused on the existing behaviour.
const mockToggleSeatAtBottom = jest.fn();
// Mutable so a test can flip sitInOptions. Defaults ON so the method-UI (radio /
// bootstrap) tests below exercise the panel; the auto-drive (OFF) is tested
// explicitly. Product default is OFF (auto).
const mockGameSettings = { seatAtBottom: true, toggleSeatAtBottom: mockToggleSeatAtBottom, sitInOptions: true };
jest.mock("../../../../context/GameSettingsContext", () => ({
    useGameSettings: () => mockGameSettings,
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
    mockSubmit.mockClear();
    mockGameSettings.sitInOptions = true; // method-UI tests; auto-drive test sets false
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

    it("renders the two sit-in radios (commit-on-select), no confirm button", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_IN), action(NonPlayerActionType.SIT_IN_AND_WAIT)]}
                totalSeatedPlayers={3}
                handNumber={5}
                hasActivePlayers={true}
            />
        );
        expect(screen.getByRole("radio", { name: "Sit In Next Big Blind" })).toBeInTheDocument();
        expect(screen.getByRole("radio", { name: "Sit In Next Hand" })).toBeInTheDocument();
        // No action/confirm buttons in the sit-in panel anymore.
        expect(screen.queryByRole("button", { name: "Sit In" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Sit In Next Hand" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Sit In And Wait for BB" })).not.toBeInTheDocument();
    });

    it("selecting Sit In Next Big Blind submits under the sit-in key", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_IN), action(NonPlayerActionType.SIT_IN_AND_WAIT)]}
                totalSeatedPlayers={3}
                handNumber={5}
                hasActivePlayers={true}
            />
        );
        fireEvent.click(screen.getByRole("radio", { name: "Sit In Next Big Blind" }));
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ actionName: "sit-in", run: expect.any(Function) })
        );
    });

    it("selecting Sit In Next Hand submits under the sit-in key", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_IN), action(NonPlayerActionType.SIT_IN_AND_WAIT)]}
                totalSeatedPlayers={3}
                handNumber={5}
                hasActivePlayers={true}
            />
        );
        fireEvent.click(screen.getByRole("radio", { name: "Sit In Next Hand" }));
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ actionName: "sit-in", run: expect.any(Function) })
        );
    });

    it("hides Sit In Next Big Blind when SIT_IN_AND_WAIT is not legal", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_IN)]}
                totalSeatedPlayers={3}
                handNumber={5}
                hasActivePlayers={true}
            />
        );
        expect(screen.queryByRole("radio", { name: "Sit In Next Big Blind" })).not.toBeInTheDocument();
        expect(screen.getByRole("radio", { name: "Sit In Next Hand" })).toBeInTheDocument();
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

    it("hides BuyChipsButton in SNG games even when TOP_UP is in legalActions", () => {
        mockGameStateContext.gameFormat = GameFormat.SIT_AND_GO;
        const { container } = render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.TOP_UP)]}
                totalSeatedPlayers={3}
                handNumber={2}
            />
        );
        // The wrapping div for BuyChipsButton should not be rendered in SNG
        expect(container.querySelector(".fixed.z-30")).toBeNull();
        mockGameStateContext.gameFormat = undefined;
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

    // ui#50: empty-table bootstrap shows a single explicit "Sit In" button and
    // must NOT auto-fire the action (the old auto-sit-in behavior is gone).
    it("renders a single explicit Sit In button on bootstrap and does NOT auto-submit", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_IN)]}
                totalSeatedPlayers={2}
                handNumber={1}
                hasActivePlayers={false}
            />
        );
        expect(screen.getByRole("button", { name: "Sit In" })).toBeInTheDocument();
        // The two-option labels are NOT used on bootstrap.
        expect(screen.queryByRole("button", { name: "Sit In Next Hand" })).not.toBeInTheDocument();
        expect(screen.queryByText("Starting game...")).not.toBeInTheDocument();
        // Crucially, nothing is submitted on mount — the player must click.
        expect(mockSubmit).not.toHaveBeenCalled();
    });

    it("bootstrap Sit In button submits a post-now sit-in when clicked", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_IN)]}
                totalSeatedPlayers={2}
                handNumber={1}
                hasActivePlayers={false}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: "Sit In" }));
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ actionName: "sit-in", run: expect.any(Function) })
        );
    });

    // ui#550: with sitInOptions OFF (product default), taking a seat auto-sits-in —
    // no radios/buttons, and the sit-in fires automatically on mount.
    it("auto-sits-in and shows an indicator when sitInOptions is off", () => {
        mockGameSettings.sitInOptions = false;
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_IN), action(NonPlayerActionType.SIT_IN_AND_WAIT)]}
                totalSeatedPlayers={3}
                handNumber={5}
                hasActivePlayers={true}
            />
        );
        // Fires the sit-in automatically (post-now), no user interaction.
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ actionName: "sit-in", run: expect.any(Function) })
        );
        // No method UI shown.
        expect(screen.queryByRole("radio", { name: "Sit In Next Big Blind" })).not.toBeInTheDocument();
        expect(screen.getByText("Sitting in...")).toBeInTheDocument();
    });
});
