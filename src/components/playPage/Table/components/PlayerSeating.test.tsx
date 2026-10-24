import React from "react";
import { render, screen } from "@testing-library/react";
import { PlayerSeating, PlayerSeatingProps } from "./PlayerSeating";
import { getSeatPositions, layoutSizeFor } from "../../../../config/stageGeometry";
import type { UseTableLayoutReturn } from "../../../../hooks/game/useTableLayout";

jest.mock("../../Players/Player", () => ({ __esModule: true, default: (p: { index: number }) => <div data-testid={`player-${p.index}`} /> }));
jest.mock("../../Players/OppositePlayer", () => ({ __esModule: true, default: (p: { index: number }) => <div data-testid={`opponent-${p.index}`} /> }));
jest.mock("../../Players/VacantPlayer", () => ({ __esModule: true, default: (p: { index: number }) => <div data-testid={`vacant-${p.index}`} /> }));
jest.mock("../../Animations/TurnAnimation", () => ({ __esModule: true, default: () => null }));
jest.mock("../../Animations/WinAnimation", () => ({ __esModule: true, default: () => null }));
jest.mock("../../../../context/GameSettingsContext", () => ({ useGameSettings: () => ({ winCelebration: false }) }));

const layoutFor = (size: 2 | 4 | 6 | 9): UseTableLayoutReturn => {
    const seats = getSeatPositions(size);
    return {
        viewportMode: "desktop",
        positions: { players: seats, vacantPlayers: seats, turnAnimations: seats } as unknown as UseTableLayoutReturn["positions"],
        zoom: 1,
        tableTransform: "",
        isLandscape: true,
        refreshLayout: () => {},
        containerWidth: 1000,
        containerHeight: 800
    };
};

const renderSeating = (maxPlayers: number, seated: number[] = []) => {
    const tableSize = layoutSizeFor(maxPlayers);
    const players = seated.map(seat => ({ seat, address: `0xP${seat}`, stack: "1000", status: "active" })) as unknown as PlayerSeatingProps["tableActivePlayers"];
    return render(
        <PlayerSeating
            tableLayout={layoutFor(tableSize)}
            tableSize={tableSize}
            maxPlayers={maxPlayers}
            startIndex={0}
            tableActivePlayers={players}
            tableDataPlayers={players}
            userWalletAddress={null}
            currentIndex={-1}
            hasWinner={false}
            isSitAndGoWaitingForPlayers={false}
            winnerInfo={null}
            cardBackStyle={"default" as PlayerSeatingProps["cardBackStyle"]}
            updateBalanceOnPlayerJoin={() => {}}
        />
    );
};

const vacantSeats = () => screen.queryAllByTestId(/^vacant-/).map(el => el.dataset.testid);

describe("PlayerSeating on tables smaller than their layout (ui#877)", () => {
    it("a 3-seat table on the 4-seat ring offers seats 1–3 only", () => {
        renderSeating(3);
        expect(vacantSeats()).toEqual(["vacant-1", "vacant-2", "vacant-3"]);
    });

    it("a 5-seat table on the 6-seat ring offers seats 1–5 only", () => {
        renderSeating(5);
        expect(vacantSeats()).toHaveLength(5);
        expect(screen.queryByTestId("vacant-6")).toBeNull();
    });

    it.each([7, 8])("a %i-seat table on the 9-seat ring offers exactly %i seats", maxPlayers => {
        renderSeating(maxPlayers);
        expect(vacantSeats()).toHaveLength(maxPlayers);
    });

    it("seated players still render, and the spare position stays empty", () => {
        renderSeating(3, [1, 3]);
        expect(screen.getByTestId("opponent-1")).toBeInTheDocument();
        expect(screen.getByTestId("opponent-3")).toBeInTheDocument();
        expect(vacantSeats()).toEqual(["vacant-2"]);
    });

    it("full-layout sizes are unchanged", () => {
        renderSeating(4);
        expect(vacantSeats()).toHaveLength(4);
    });
});
