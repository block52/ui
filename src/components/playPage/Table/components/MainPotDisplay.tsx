import React from "react";
import { PotPill } from "./PotPill";

interface MainPotDisplayProps {
    amount: bigint;
    isTournamentStyle: boolean;
}

export const MainPotDisplay: React.FC<MainPotDisplayProps> = ({ amount, isTournamentStyle }) => {
    return (
        <div className="pot-display-secondary">
            <PotPill amount={amount} label="Main Pot" isTournament={isTournamentStyle} />
        </div>
    );
};
