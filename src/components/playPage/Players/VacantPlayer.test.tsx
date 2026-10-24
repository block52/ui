import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameFormat } from "@block52/poker-vm-sdk";
import VacantPlayer from "./VacantPlayer";

// The seat's look depends on: the table format, whether the viewer is seated,
// and whether this seat can be taken. Everything else is stubbed.
let mockFormat: GameFormat | undefined = GameFormat.CASH;
let mockAlreadyPlaying = false;
let mockCanJoin = true;

jest.mock("react-router-dom", () => ({ useParams: () => ({ id: "0xtable" }) }));
jest.mock("../../../context/gameState/GameMetaContext", () => ({ useGameMeta: () => ({ gameFormat: mockFormat }) }));
jest.mock("../../../hooks/game/useVacantSeatData", () => ({
    useVacantSeatData: () => ({ isUserAlreadyPlaying: mockAlreadyPlaying, canJoinSeat: () => mockCanJoin })
}));
jest.mock("../../../hooks/game/useDealerPosition", () => ({ useDealerPosition: () => ({ dealerSeat: 1 }) }));
jest.mock("../../../hooks/game/useGameOptions", () => ({
    useGameOptions: () => ({ gameOptions: { minBuyIn: "400000", maxBuyIn: "2000000", bigBlind: "20000", maxPlayers: 6 } })
}));
jest.mock("../../../hooks", () => ({ useCosmosWallet: () => ({ balance: [{ denom: "usdc", amount: "100000000" }] }) }));
jest.mock("../../../context/NetworkContext", () => ({ useNetwork: () => ({ currentNetwork: {} }) }));
jest.mock("../../../hooks/playerActions/joinTable", () => ({ joinTable: jest.fn() }));
jest.mock("../../modals", () => ({ USDCDepositModal: () => null }));

const renderSeat = () => render(<VacantPlayer left="10px" top="20px" index={3} onJoin={jest.fn()} />);

describe("VacantPlayer — empty seat look (ui#872)", () => {
    beforeEach(() => {
        mockFormat = GameFormat.CASH;
        mockAlreadyPlaying = false;
        mockCanJoin = true;
    });

    it("cash: a plus circle you can click to sit, with no seat text on the felt", () => {
        renderSeat();
        const seat = screen.getByRole("button", { name: "Sit in seat 3" });
        expect(seat).toBeEnabled();
        expect(screen.queryByText(/Click to Join|Vacant Seat|Seat 3/)).not.toBeInTheDocument();

        fireEvent.click(seat);
        expect(screen.getByText("Cash Game Buy-In")).toBeInTheDocument();
    });

    it("cash: no plus and no buy-in while you're already seated", () => {
        mockAlreadyPlaying = true;
        renderSeat();
        const seat = screen.getByRole("button", { name: "Seat 3 — open" });
        expect(seat).toBeDisabled();
        fireEvent.click(seat);
        expect(screen.queryByText("Cash Game Buy-In")).not.toBeInTheDocument();
    });

    it.each([GameFormat.SIT_AND_GO, GameFormat.TOURNAMENT])("%s: a non-clickable EMPTY circle", format => {
        mockFormat = format;
        renderSeat();
        expect(screen.getByText("EMPTY")).toHaveAttribute("aria-label", "Seat 3 — empty");
        expect(screen.queryByRole("button")).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId("vacant-seat-3"));
        expect(screen.queryByText(/Buy-In/)).not.toBeInTheDocument();
    });
});
