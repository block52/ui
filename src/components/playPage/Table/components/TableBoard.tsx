/**
 * TableBoard Component
 *
 * Displays the central playing surface including:
 * - Club logo
 * - Pot displays (total pot and main pot)
 * - Community cards
 * - Sit & Go waiting state
 */

import React, { useMemo } from "react";
import { getCardImageUrl, getCardBackUrl, CardBackStyle } from "../../../../utils/cardImages";
import { PotDisplayValues } from "../../../../utils/potDisplayUtils";
import { useCardAnimations } from "../../../../hooks/animations/useCardAnimations";
import OppositePlayerCards from "../../Card/OppositePlayerCards";
import { TotalPotDisplay } from "./TotalPotDisplay";
import { MainPotDisplay } from "./MainPotDisplay";
import { NounsGlasses } from "./NounsGlasses";

export type TableTheme = "modern" | "classic" | "nouns";

export interface TableBoardProps {
    // Display data
    clubLogo: string;
    potDisplayValues: PotDisplayValues;
    communityCards: string[];

    // State flags
    isSitAndGoWaitingForPlayers: boolean;

    // Styling
    cardBackStyle: CardBackStyle;
    tableTheme?: TableTheme;

    // Winning hand cards — cards in this set get the lift animation
    winnerCards?: Set<string>;
}

export const TableBoard: React.FC<TableBoardProps> = ({
    clubLogo,
    potDisplayValues,
    communityCards,
    isSitAndGoWaitingForPlayers,
    cardBackStyle,
    tableTheme = "modern",
    winnerCards
}) => {
    // Phase 5 pilot: mounting useCardAnimations here (the always-mounted board)
    // drives the WS-bus animation ack — when the staggered flop/turn/river reveal
    // completes it calls bus.ackAnimation, releasing the drain's next commit. The
    // per-slot flags gate each card's drop-in below: a freshly-dealt card drops
    // into place when its staggered flag turns on, one after another. Late mount /
    // replay reveals already-dealt slots immediately.
    const { revealedSlots } = useCardAnimations();

    // Memoize community cards rendering
    const communityCardsElements = useMemo(() => {
        // Count how many contiguous real cards exist from position 0.
        // Prevents out-of-order reveals when the backend sends intermediate states
        // (e.g. turn revealed before flop during all-in runout).
        let contiguousCount = 0;
        for (let i = 0; i < 5; i++) {
            const c = communityCards[i];
            if (c && c !== "??" && c !== "XX") {
                contiguousCount = i + 1;
            } else {
                break;
            }
        }

        const hasWinningCards = (winnerCards?.size ?? 0) > 0;

        return Array.from({ length: 5 }).map((_, idx) => {
            const card = communityCards[idx];
            // A card shows only once its slot has been revealed by the staggered
            // deal (see useCardAnimations); until then the slot is an empty
            // placeholder, so the flop's cards drop in one after the other.
            const isDealt = idx < contiguousCount && card && card !== "??" && card !== "XX";
            const isVisible = isDealt && revealedSlots[idx] === true;
            const isWinCard = isVisible && hasWinningCards && (winnerCards!.has(card));
            const shouldMute = isVisible && hasWinningCards && !winnerCards!.has(card);

            if (isVisible) {
                // Card drops into place (animate-fall) when its slot flag flips.
                // The stagger comes from the flag timing, so no per-index delay.
                return (
                    <div
                        key={`${idx}-${card}`}
                        className={`card animate-fall${isWinCard ? " animate-win-card" : ""}${shouldMute ? " opacity-40" : ""}`}
                    >
                        <OppositePlayerCards frontSrc={getCardImageUrl(card)} backSrc={getCardBackUrl(cardBackStyle)} flipped />
                    </div>
                );
            } else {
                return (
                    <div
                        key={idx}
                        className="w-[85px] h-[127px] aspect-square border-[0.5px] border-dashed border-white rounded-[5px] "
                        style={{ borderColor: "rgba(255,255,255,0.35)" }}
                    />
                );
            }
        });
    }, [communityCards, cardBackStyle, winnerCards, revealedSlots]);

    return (
        <>
            {/* Club Logo */}
            <div className={`table-logo ${tableTheme === "nouns" ? "table-logo-nouns" : ""}`}>
                {tableTheme === "nouns" ? <NounsGlasses width={300} className="nouns-glasses-logo" /> : <img src={clubLogo} alt="Club Logo" />}
            </div>

            {/* Central Display Area */}
            <div className="flex flex-col items-center justify-center -mt-8">
                {/* Hide pot display when sit-and-go is waiting for players */}
                {!isSitAndGoWaitingForPlayers && (
                    <>
                        {potDisplayValues.showTotalPot && (
                            <TotalPotDisplay amount={potDisplayValues.totalPot} isTournamentStyle={potDisplayValues.isTournamentStyle} />
                        )}
                        {/* Main Pot only post-flop, and only when it differs from Total Pot (#639) */}
                        {potDisplayValues.showMainPot && (
                            <MainPotDisplay amount={potDisplayValues.mainPot} isTournamentStyle={potDisplayValues.isTournamentStyle} />
                        )}
                    </>
                )}

                {/* Community Cards */}
                <div className="flex gap-2 mt-8">{communityCardsElements}</div>
            </div>
        </>
    );
};
