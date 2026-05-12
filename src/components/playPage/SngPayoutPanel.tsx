import React from "react";
import { useSitAndGoPayouts } from "../../hooks/game/useSitAndGoPayouts";
import { convertUSDCToNumber, formatForCashGame } from "../../utils/numberUtils";
import { hasContent, isEmpty } from "../../utils/guards";

const PLACE_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

const ordinal = (place: number): string => PLACE_LABELS[place - 1] ?? `${place}th`;

const SngPayoutPanel: React.FC = () => {
    const { isSitAndGo, prizePool, places } = useSitAndGoPayouts();

    if (!isSitAndGo || !hasContent(prizePool) || isEmpty(places)) {
        return null;
    }

    return (
        <div
            className="absolute bottom-4 right-4 z-30 hidden sm:block rounded-lg border border-blue-400/20 bg-gray-900/80 px-3 py-2 text-white shadow-lg backdrop-blur-sm"
            data-testid="sng-payout-panel"
        >
            <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-300">Payouts</span>
                <span className="text-xs text-gray-300">Pool {formatForCashGame(convertUSDCToNumber(prizePool))}</span>
            </div>
            <ul className="space-y-0.5 text-sm">
                {places.map(({ place, payout, percentBasisPoints }) => (
                    <li key={place} className="flex items-baseline justify-between gap-4">
                        <span className="text-gray-200">
                            {ordinal(place)} <span className="text-gray-400">({percentBasisPoints / 100}%)</span>
                        </span>
                        <span className="font-mono tabular-nums">{formatForCashGame(convertUSDCToNumber(payout))}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SngPayoutPanel;
