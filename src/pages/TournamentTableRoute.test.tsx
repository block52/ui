import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentTableRoute from "./TournamentTableRoute";

const mockUseTournament = jest.fn();
jest.mock("../hooks/tournament/useTournament", () => ({ useTournament: (id: string | undefined) => mockUseTournament(id) }));

const T = "0xabc";

const record = (status: string, tables: Array<{ n: number; broken: boolean }>) => ({
    tournamentId: T,
    status,
    tables: tables.map(t => ({ tableId: `${T}/t${t.n}`, ordinal: t.n, players: [], broken: t.broken, handNumber: 1, atBoundary: false }))
});

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route
                    path="/tournament/:tournamentId/table/:n"
                    element={
                        <TournamentTableRoute>
                            <div>the table</div>
                        </TournamentTableRoute>
                    }
                />
                <Route path="/tournament/:tournamentId" element={<div>the tournament page</div>} />
            </Routes>
        </MemoryRouter>
    );

describe("TournamentTableRoute", () => {
    beforeEach(() => mockUseTournament.mockReset());

    it("shows a table that is still in play", () => {
        mockUseTournament.mockReturnValue({ tournament: record("running", [{ n: 1, broken: false }]) });
        renderAt(`/tournament/${T}/table/1`);
        expect(screen.getByText("the table")).toBeInTheDocument();
    });

    it("sends a table that was broken up to the tournament page", () => {
        mockUseTournament.mockReturnValue({ tournament: record("running", [{ n: 1, broken: false }, { n: 3, broken: true }]) });
        renderAt(`/tournament/${T}/table/3`);
        expect(screen.getByText("the tournament page")).toBeInTheDocument();
    });

    it("sends a table that never existed to the tournament page", () => {
        mockUseTournament.mockReturnValue({ tournament: record("finished", [{ n: 1, broken: false }]) });
        renderAt(`/tournament/${T}/table/9`);
        expect(screen.getByText("the tournament page")).toBeInTheDocument();
    });

    it("renders the table while the tournament record is still loading, and for one not yet started", () => {
        mockUseTournament.mockReturnValue({ tournament: undefined });
        const { unmount } = renderAt(`/tournament/${T}/table/3`);
        expect(screen.getByText("the table")).toBeInTheDocument();
        unmount();
        mockUseTournament.mockReturnValue({ tournament: record("registering", []) });
        renderAt(`/tournament/${T}/table/3`);
        expect(screen.getByText("the table")).toBeInTheDocument();
    });
});
