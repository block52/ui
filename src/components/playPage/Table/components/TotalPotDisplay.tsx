import React from "react";
import { formatPotLabel } from "../../../../utils/potTextUtils";
import { PotPill } from "./PotPill";
import { useLanguage } from "../../../../i18n/useLanguage";

interface TotalPotDisplayProps {
    /** Formatted pot size, for the text label. */
    amount: string;
    /** Raw pot size (micro-USDC for cash, chips for tournaments), for the chip stack. */
    rawAmount: bigint;
    isTournamentStyle: boolean;
    /** True when a separate Main Pot is also shown, so the chip caption reads "Total Pot". */
    hasMainPot: boolean;
    /** "Pot as Chips" setting (ui#772): a chip pill instead of the "Total Pot: $x" text. */
    asChips: boolean;
}

export const TotalPotDisplay: React.FC<TotalPotDisplayProps> = ({ amount, rawAmount, isTournamentStyle, hasMainPot, asChips }) => {
    useLanguage();
    if (asChips) {
        return (
            <div className="pot-chips">
                <PotPill amount={rawAmount} label={hasMainPot ? "Total Pot" : "Pot"} isTournament={isTournamentStyle} />
            </div>
        );
    }
    return (
        <div className="pot-display">
            {formatPotLabel("Total Pot", amount, isTournamentStyle)}
        </div>
    );
};
