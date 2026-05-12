import React, { useState } from "react";
import { FaTrophy } from "react-icons/fa";
import { Modal } from "../common/Modal";
import { useSitAndGoPayouts } from "../../hooks/game/useSitAndGoPayouts";
import { convertUSDCToNumber, formatForCashGame } from "../../utils/numberUtils";
import { hasContent, isEmpty } from "../../utils/guards";

const PLACE_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

const ordinal = (place: number): string => PLACE_LABELS[place - 1] ?? `${place}th`;

const SngPayoutPanel: React.FC = () => {
    const { isSitAndGo, prizePool, places } = useSitAndGoPayouts();
    const [isOpen, setIsOpen] = useState(false);

    if (!isSitAndGo || !hasContent(prizePool) || isEmpty(places)) {
        return null;
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-1 text-[10px] sm:text-[15px] font-semibold transition-colors duration-200 hover:opacity-80 text-yellow-300"
                title="Show payout positions"
                data-testid="sng-payouts-button"
            >
                <FaTrophy size={10} />
                <span className="hidden sm:inline">Payouts</span>
            </button>

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Payouts"
                titleIcon={<FaTrophy size={16} />}
                widthClass="w-96"
                patternId="hexagons-sng-payouts"
                scrollable={false}
            >
                <div className="mb-4 flex items-baseline justify-between rounded-lg bg-black/30 px-3 py-2 border border-white/10">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">Prize Pool</span>
                    <span className="text-lg font-bold text-white font-mono tabular-nums">
                        {formatForCashGame(convertUSDCToNumber(prizePool))}
                    </span>
                </div>

                <ul className="space-y-2 mb-2">
                    {places.map(({ place, payout, percentBasisPoints }) => (
                        <li
                            key={place}
                            className="flex items-baseline justify-between gap-4 rounded-lg bg-black/20 px-3 py-2 border border-white/5"
                            data-testid={`sng-payout-place-${place}`}
                        >
                            <span className="text-white font-semibold">
                                {ordinal(place)}{" "}
                                <span className="text-gray-400 text-sm font-normal">({percentBasisPoints / 100}%)</span>
                            </span>
                            <span className="font-mono tabular-nums text-white">
                                {formatForCashGame(convertUSDCToNumber(payout))}
                            </span>
                        </li>
                    ))}
                </ul>

                <p className="text-xs text-gray-400 mt-3">
                    Payout structure is fixed for the table size and buy-in. Computed client-side until the chain exposes a payout structure on the game.
                </p>
            </Modal>
        </>
    );
};

export default SngPayoutPanel;
