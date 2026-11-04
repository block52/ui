import { render, screen } from "@testing-library/react";
import { GameFormat, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { TableBoard } from "./TableBoard";
import { formatPotDisplay } from "../../../../utils/potDisplayUtils";
import type { CardBackStyle } from "../../../../utils/cardImages";

let mockPotAsChips = false;
jest.mock("../../../../hooks/animations/useCardAnimations", () => ({ useCardAnimations: () => ({ revealedSlots: [true, true, true, true, true] }) }));
jest.mock("../../../../utils/cardImages", () => ({ ...jest.requireActual("../../../../utils/cardImages"), getCardImageUrl: (card: string) => `/cards/${card}.svg`, getCardBackUrl: () => "/back.svg" }));
jest.mock("../../../../context/GameSettingsContext", () => ({ useGameSettings: () => ({ potAsChips: mockPotAsChips }), useChipStyle: () => "marble" }));

const board = (pots: string[], totalPot: string) => (
    <TableBoard
        clubLogo="/logo.png"
        potDisplayValues={formatPotDisplay(pots, totalPot, GameFormat.SIT_AND_GO, TexasHoldemRound.RIVER)}
        communityCards={["QD", "8S", "TH", "2C", "QC"]}
        isSitAndGoWaitingForPlayers={false}
        cardBackStyle={"classic" as CardBackStyle}
    />
);

describe("TableBoard side pots (ui#918)", () => {
    afterEach(() => {
        mockPotAsChips = false;
    });

    it.each([false, true])("renders one pot per entry, main first (pot as chips %s)", chips => {
        mockPotAsChips = chips;
        render(board(["24400", "4000", "120"], "28520"));
        const row = screen.getByTestId("side-pots");
        expect(row).toHaveAttribute("data-count", "3");
        expect(row.children).toHaveLength(3);
        const text = row.textContent ?? "";
        expect(text.indexOf("Main Pot")).toBeLessThan(text.indexOf("Side Pot 1"));
        expect(text.indexOf("Side Pot 1")).toBeLessThan(text.indexOf("Side Pot 2"));
    });

    it("a single pot shows no side-pot row", () => {
        render(board(["1500"], "1500"));
        expect(screen.queryByTestId("side-pots")).toBeNull();
    });
it("Shot Clock hand #3 on the river: 3,204 main + 40 side pot", () => {
        const values = formatPotDisplay(
            ["3204", "40"],
            "3244",
            GameFormat.SIT_AND_GO,
            TexasHoldemRound.RIVER,
            [
                { amount: "3204", eligibleSeats: [1, 2, 3] },
                { amount: "40", eligibleSeats: [1, 3] }
            ] as never
        );
        expect(values.showSidePots).toBe(true);
        render(<TableBoard clubLogo="/logo.png" potDisplayValues={values} communityCards={["QD", "5S", "QH", "TH", "7C"]} isSitAndGoWaitingForPlayers={false} cardBackStyle={"classic" as CardBackStyle} />);
        const row = screen.getByTestId("side-pots");
        expect(row).toHaveAttribute("data-count", "2");
        expect(row.textContent).toContain("3,204");
        expect(row.textContent).toContain("40");
    });
});