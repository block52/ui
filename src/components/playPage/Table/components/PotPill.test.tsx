import React from "react";
import { render, screen } from "@testing-library/react";
import { PotPill } from "./PotPill";
import { TotalPotDisplay } from "./TotalPotDisplay";
import { MainPotDisplay } from "./MainPotDisplay";

describe("PotPill", () => {
    it("shows the cash amount in dollars with a POT caption", () => {
        render(<PotPill amount={168_000_000n} label="Pot" isTournament={false} />);
        expect(screen.getByText("$168.00")).toBeInTheDocument();
        expect(screen.getByText("Pot")).toBeInTheDocument();
    });

    it("draws a chip stack for the amount", () => {
        render(<PotPill amount={300_000_000n} label="Pot" isTournament={false} />);
        expect(screen.getAllByRole("img").length).toBeGreaterThan(0);
    });

    it("shows tournament pots as whole chips, no dollar sign", () => {
        render(<PotPill amount={3748n} label="Pot" isTournament={true} />);
        expect(screen.getByText("3,748")).toBeInTheDocument();
    });
});

describe("TotalPotDisplay / MainPotDisplay captions", () => {
    it("reads POT when it is the only pot", () => {
        render(<TotalPotDisplay amount={40_000n} isTournamentStyle={false} hasMainPot={false} />);
        expect(screen.getByLabelText("Pot")).toBeInTheDocument();
    });

    it("reads TOTAL POT when a separate main pot is shown", () => {
        render(<TotalPotDisplay amount={900_000_000n} isTournamentStyle={false} hasMainPot={true} />);
        expect(screen.getByLabelText("Total Pot")).toBeInTheDocument();
    });

    it("labels the main pot MAIN POT", () => {
        render(<MainPotDisplay amount={600_000_000n} isTournamentStyle={false} />);
        expect(screen.getByLabelText("Main Pot")).toBeInTheDocument();
        expect(screen.getByText("$600.00")).toBeInTheDocument();
    });
});
