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
import OppositePlayerCards from "../../Card/OppositePlayerCards";
import { TotalPotDisplay } from "./TotalPotDisplay";
import { MainPotDisplay } from "./MainPotDisplay";

export interface TableBoardProps {
    // Display data
    clubLogo: string;
    potDisplayValues: PotDisplayValues;
    communityCards: string[];

    // State flags
    isSitAndGoWaitingForPlayers: boolean;

    // Styling
    cardBackStyle: CardBackStyle;
}

export const TableBoard: React.FC<TableBoardProps> = ({
    clubLogo,
    potDisplayValues,
    communityCards,
    isSitAndGoWaitingForPlayers,
    cardBackStyle
}) => {
    // Memoize community cards rendering
    const communityCardsElements = useMemo(() => {
        return Array.from({ length: 5 }).map((_, idx) => {
            if (idx < communityCards.length) {
                const card = communityCards[idx];
                return (
                    <div key={idx} className="card animate-fall">
                        <OppositePlayerCards frontSrc={getCardImageUrl(card)} backSrc={getCardBackUrl(cardBackStyle)} flipped />
                    </div>
                );
            } else {
                return <div key={idx} className="w-[85px] h-[127px] aspect-square border-[0.5px] border-dashed border-white rounded-[5px]" />;
            }
        });
    }, [communityCards, cardBackStyle]);

    return (
        <>
            {/* Club Logo */}
            <div className="table-logo">
                <img src={clubLogo} alt="Club Logo" />
            </div>

            {/* Central Display Area */}
            <div className="flex flex-col items-center justify-center -mt-20">
                {/* Hide pot display when sit-and-go is waiting for players */}
                {!isSitAndGoWaitingForPlayers && (
                    <>
                        <TotalPotDisplay amount={potDisplayValues.totalPot} isTournamentStyle={potDisplayValues.isTournamentStyle} />
                        {/* Only show Main Pot when not in preflop (i.e., when community cards are dealt) */}
                        {!potDisplayValues.isPreflop && (
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
