import React from "react";
import { useSitAndGoPayouts } from "../../hooks/game/useSitAndGoPayouts";
import { convertUSDCToNumber, formatForCashGame } from "../../utils/numberUtils";
import { hasContent, isEmpty } from "../../utils/guards";

const PLACE_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

const ordinal = (place: number): string => PLACE_LABELS[place - 1] ?? `${place}th`;
const calcPercent = (payout: string, prizePool: string): number => {
    const pool = BigInt(prizePool);
    if (pool <= 0n) return 0;
    return Number((BigInt(payout) * 10000n) / pool) / 100;
};

const SngPayoutPanel: React.FC = () => {
    const { isSitAndGo, prizePool, places } = useSitAndGoPayouts();

    if (!isSitAndGo || !hasContent(prizePool) || isEmpty(places)) {
        return null;
    }

    return (
        <div
            className="w-fit rounded-xl border border-white/15 bg-black/55 px-3 py-2 backdrop-blur-sm shadow-xl"
            data-testid="sng-payout-structure"
        >
            <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-yellow-300 mb-1">
                Payout Structure
            </div>
            <ul className="space-y-1">
                {places.map(({ place, payout }) => (
                    <li
                        key={place}
                        className="text-[10px] sm:text-xs text-white font-medium font-mono whitespace-nowrap"
                        data-testid={`sng-payout-place-${place}`}
                    >
                        {ordinal(place)} {calcPercent(payout, prizePool)}%: {formatForCashGame(convertUSDCToNumber(payout))}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SngPayoutPanel;
