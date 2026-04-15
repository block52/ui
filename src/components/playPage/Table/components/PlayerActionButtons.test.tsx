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
};

beforeEach(() => {
    mockHandleSitIn.mockClear();
    mockHandleSitOut.mockClear();
});

describe("PlayerActionButtons", () => {
    it("renders nothing visible when display kind is none and no top-up available", () => {
        const { container } = render(
            <PlayerActionButtons
                {...baseProps}
                totalSeatedPlayers={3}
                handNumber={2}
                legalActions={[]}
            />
        );
        // BuyChipsButton is mocked to return null, so container should be empty
        expect(container.firstChild).toBeNull();
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

    it("renders sit-out checkbox when SIT_OUT action available", () => {
        render(
            <PlayerActionButtons
                {...baseProps}
                legalActions={[action(NonPlayerActionType.SIT_OUT)]}
                totalSeatedPlayers={3}
                handNumber={2}
            />
        );
        expect(screen.getByRole("checkbox")).toBeInTheDocument();
        expect(screen.getByText("Sit Out Next Hand")).toBeInTheDocument();
    });
});
