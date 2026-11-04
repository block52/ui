import React from "react";
import Chip from "../../common/Chip";

import type { PotLabel } from "../../../../utils/potTextUtils";
import { potLabelText } from "../../../../utils/potTextUtils";

export type PotPillLabel = "Pot" | PotLabel;

interface PotPillProps {
    /** Pot size: micro-USDC for cash, chips for tournaments. */
    amount: bigint;
    label: PotPillLabel;
    isTournament: boolean;
}

/**
 * The pot as a pill: the same chip stack + amount pill as a player's bet, with a
 * small caption naming the pot centred under the amount (not the chips).
 */
export const PotPill: React.FC<PotPillProps> = ({ amount, label, isTournament }) => (
    <div className="pot-pill" aria-label={potLabelText(label)}>
        <Chip amount={amount} isTournament={isTournament} caption={potLabelText(label)} />
    </div>
);
