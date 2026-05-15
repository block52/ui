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
}

export const TableBoard: React.FC<TableBoardProps> = ({
    clubLogo,
    potDisplayValues,
    communityCards,
    isSitAndGoWaitingForPlayers,
    cardBackStyle,
    tableTheme = "modern"
}) => {
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

        return Array.from({ length: 5 }).map((_, idx) => {
            const card = communityCards[idx];
            const isVisible = idx < contiguousCount && card && card !== "??" && card !== "XX";

            if (isVisible) {
                return (
                    <div key={`${idx}-${card}`} className="card animate-fall" style={{ animationDelay: `${idx * 150}ms` }}>
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
    }, [communityCards, cardBackStyle]);

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
