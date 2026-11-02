import React from "react";
import Chip from "../../common/Chip";

import type { PotLabel } from "../../../../utils/potTextUtils";

export type PotPillLabel = "Pot" | PotLabel;

interface PotPillProps {
    /** Pot size: micro-USDC for cash, chips for tournaments. */
    amount: bigint;
    label: PotPillLabel;
    isTournament: boolean;
}

/**
 * The pot as a pill: the same chip stack + amount pill as a player's bet, with a
 * small caption underneath naming the pot.
 */
export const PotPill: React.FC<PotPillProps> = ({ amount, label, isTournament }) => (
    <div className="pot-pill" aria-label={label}>
        <Chip amount={amount} isTournament={isTournament} />
        <span className="pot-pill-label">{label}</span>
    </div>
);
