import React from "react";
import { formatPotLabel } from "../../../../utils/potTextUtils";

interface MainPotDisplayProps {
    amount: string;
    isTournamentStyle: boolean;
}

export const MainPotDisplay: React.FC<MainPotDisplayProps> = ({ amount, isTournamentStyle }) => {
    return (
        <div className="pot-display-secondary">
            {formatPotLabel("Main Pot", amount, isTournamentStyle)}
        </div>
    );
};
