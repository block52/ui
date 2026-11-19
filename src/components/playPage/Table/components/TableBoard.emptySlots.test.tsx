import { render, screen } from "@testing-library/react";
import { GameFormat, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { TableBoard } from "./TableBoard";
import { formatPotDisplay } from "../../../../utils/potDisplayUtils";
import type { CardBackStyle } from "../../../../utils/cardImages";

jest.mock("../../../../hooks/animations/useCardAnimations", () => ({ useCardAnimations: () => ({ revealedSlots: [true, true, true, true, true] }) }));
jest.mock("../../../../utils/cardImages", () => ({
    ...jest.requireActual("../../../../utils/cardImages"),
    getCardImageUrl: (card: string) => `/cards/${card}.svg`,
    getCardBackUrl: () => "/back.svg"
}));
jest.mock("../../../../context/GameSettingsContext", () => ({ useGameSettings: () => ({ potAsChips: false }), useChipStyle: () => "marble" }));

const board = (communityCards: string[]) => (
    <TableBoard
        clubLogo="/logo.png"
        potDisplayValues={formatPotDisplay(["300"], "300", GameFormat.SIT_AND_GO, TexasHoldemRound.PREFLOP)}
        communityCards={communityCards}
        isSitAndGoWaitingForPlayers={false}
        cardBackStyle={"classic" as CardBackStyle}
    />
);

describe("TableBoard empty community-card slots", () => {
    it("draws no outline for a card that has not been dealt, but keeps its space", () => {
        const { container } = render(board([]));
        const slots = screen.getAllByTestId("board-slot-empty");
        expect(slots).toHaveLength(5);
        slots.forEach(slot => {
            expect(slot).toHaveClass("w-[85px]", "h-[127px]");
            expect(slot.className).not.toMatch(/border/);
        });
        expect(container.querySelector("[class*='border-dashed']")).toBeNull();
    });

    it("keeps one slot per undealt card as the board fills in", () => {
        render(board(["QD", "8S", "TH"]));
        expect(screen.getAllByTestId("board-slot-empty")).toHaveLength(2);
    });
});

describe("TableBoard felt logo", () => {
    it("uses the Blockchain Poker official logo when that appearance is active", () => {
        render(
            <TableBoard
                clubLogo="/logo.png"
                potDisplayValues={formatPotDisplay(["300"], "300", GameFormat.SIT_AND_GO, TexasHoldemRound.PREFLOP)}
                communityCards={[]}
                isSitAndGoWaitingForPlayers={false}
                cardBackStyle={"classic" as CardBackStyle}
                tableTheme="blockchainpoker"
            />
        );
        expect(screen.getByAltText("Club Logo")).toHaveAttribute("src", "/appearances/blockchain-poker/official-felt-logo-2000.png");
    });

    it("keeps the club logo for the modern appearance", () => {
        render(board([]));
        expect(screen.getByAltText("Club Logo")).toHaveAttribute("src", "/logo.png");
    });
});
