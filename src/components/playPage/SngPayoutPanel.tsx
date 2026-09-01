import React, { useState } from "react";
import { FaTrophy } from "react-icons/fa";
import { Modal } from "../common/Modal";
import { useSitAndGoPayouts } from "../../hooks/game/useSitAndGoPayouts";
import { convertUSDCToNumber, formatForCashGame } from "../../utils/numberUtils";
import { hasContent, isEmpty } from "../../utils/guards";
import buyInStyles from "../modals/BuyInModal.module.css";

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
                className="flex items-center gap-1 text-[10px] sm:text-[15px] font-semibold transition-colors duration-200 hover:opacity-80 px-1 sm:px-2 py-0.5 sm:py-1 rounded text-yellow-300"
                title="Show payout positions"
                data-testid="sng-payouts-button"
            >
                <FaTrophy size={10} />
                <span>Payouts</span>
            </button>

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                widthClass="w-96"
                patternId="hexagons-sng-payouts"
                scrollable={false}
                className={buyInStyles.modalContainer}
            >
                <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                    <span className={`mr-2 ${buyInStyles.suitClub}`}>♣</span>
                    Payouts
                    <span className={`ml-2 ${buyInStyles.suitDiamond}`}>♦</span>
                </h2>
                <div className={`w-full h-0.5 mb-4 opacity-50 ${buyInStyles.dividerPrimary}`}></div>

                <div className="mb-4 flex items-baseline justify-between rounded-lg bg-black/30 px-3 py-2 border border-white/10">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">Prize Pool</span>
                    <span className="text-lg font-bold text-white font-mono tabular-nums">
                        {formatForCashGame(convertUSDCToNumber(prizePool))}
                    </span>
                </div>

                <ul className="space-y-2 mb-2">
                    {places.map(({ place, payout }) => (
                        <li
                            key={place}
                            className="flex items-baseline justify-between gap-4 rounded-lg bg-black/20 px-3 py-2 border border-white/5"
                            data-testid={`sng-payout-place-${place}`}
                        >
                            <span className="text-white font-semibold">
                                {ordinal(place)}
                            </span>
                            <span className="font-mono tabular-nums text-white">
                                {formatForCashGame(convertUSDCToNumber(payout))}
                            </span>
                        </li>
                    ))}
                </ul>

                <button
                    onClick={() => setIsOpen(false)}
                    className={`w-full py-3 rounded-lg text-white font-medium transition-all duration-200 ${buyInStyles.cancelButton}`}
                >
                    Close
                </button>
            </Modal>
        </>
    );
};

export default SngPayoutPanel;
