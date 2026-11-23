import React from "react";
import { winAmountFloatText } from "@block52/poker-ui-core/utils/winAmountFloat";
import { hasContent } from "@block52/ui-sdk/helpers";
import "./WinAmountFloat.css";

interface WinAmountFloatProps {
    /** The seat's won amount as formatted by useWinnerInfo ("0.04" / "1,240 chips"). */
    formattedAmount: string | null | undefined;
    /** Whether the table plays in chips (SNG/tournament) rather than USDC. */
    isTournament: boolean;
}

/**
 * Floating "+$0.04" pill on a winning seat (ui#861): it appears at the seat's
 * drop-down action bar and floats up to the top of the hole cards over ~3s,
 * then fades. Mounted while the seat is a winner, so it plays once per pot.
 */
export const WinAmountFloat: React.FC<WinAmountFloatProps> = ({ formattedAmount, isTournament }) => {
    const text = winAmountFloatText(formattedAmount, isTournament);
    if (!hasContent(text)) return null;
    return (
        <div key={text} className="win-amount-float" aria-hidden="true">
            {text}
        </div>
    );
};
