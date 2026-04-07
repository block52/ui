import React from "react";
import { formatPotLabel } from "../../../../utils/potTextUtils";

interface TotalPotDisplayProps {
    amount: string;
    isTournamentStyle: boolean;
}

export const TotalPotDisplay: React.FC<TotalPotDisplayProps> = ({ amount, isTournamentStyle }) => {
    return (
        <div className="pot-display">
            {formatPotLabel("Total Pot", amount, isTournamentStyle)}
        </div>
    );
};
