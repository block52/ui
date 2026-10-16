import React from "react";
import { PotPill } from "./PotPill";

interface TotalPotDisplayProps {
    amount: bigint;
    isTournamentStyle: boolean;
    /** True when a separate Main Pot pill is also shown, so this one reads "Total Pot". */
    hasMainPot: boolean;
}

export const TotalPotDisplay: React.FC<TotalPotDisplayProps> = ({ amount, isTournamentStyle, hasMainPot }) => {
    return (
        <div className="pot-display">
            <PotPill amount={amount} label={hasMainPot ? "Total Pot" : "Pot"} isTournament={isTournamentStyle} />
        </div>
    );
};
