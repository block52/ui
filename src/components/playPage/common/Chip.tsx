import React from "react";
import { formatUSDCToSimpleDollars, formatForSitAndGo } from "../../../utils/numberUtils";
import { getChipImageUrl } from "../../../utils/cardImages";

type ChipProps = {
    amount: string | bigint;
    isTournament?: boolean;
};

const Chip: React.FC<ChipProps> = React.memo(({ amount, isTournament }) => {
    // Convert amount to string - handle edge cases
    const amountStr = amount ? amount.toString() : "0";

    // Format based on game type: raw chips for tournaments, USDC conversion for cash
    const formattedAmount = isTournament
        ? formatForSitAndGo(Number(amountStr))
        : formatUSDCToSimpleDollars(amountStr);
    
    // Check if we're on mobile (portrait or landscape)
    const isMobile = window.innerWidth <= 768 || window.innerHeight <= 500;
    
    return (
        <div className={`relative rounded-full bg-[#00000054] flex items-center ${
            isMobile 
                ? "h-[36px] pl-[18px] pr-[18px]"  // Larger padding for mobile
                : "h-[32px] pl-[16px] pr-[16px]"  // Larger padding for desktop too
        }`}>
            <img
                src={getChipImageUrl()}
                alt="Chip Icon" 
                className={`absolute ${
                    isMobile
                        ? "left-[-24px] w-[32px]"  // Larger chip icon for mobile
                        : "left-[-20px] w-[28px]"  // Larger chip icon for desktop
                } h-auto`}
            />
            <span className={`text-[#dbd3d3] font-bold whitespace-nowrap ${
                isMobile 
                    ? "text-4xl"  // 3x larger text for mobile
                    : "text-2xl"  // 2x larger text for desktop
            }`}>
                {isTournament ? formattedAmount : `$${formattedAmount}`}
            </span>
        </div>
    );
});

export default Chip;
