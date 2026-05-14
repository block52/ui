/**
 * SitAndGoResultModal
 *
 * One-shot modal shown to the current user once they've finished a
 * Sit-and-Go tournament. Surfaces the place + payout (or a "thanks
 * for playing" message for unpaid finishes), with a "Leave Table"
 * CTA that fires the chain leave so the table can be reaped.
 *
 * Triggering logic lives inside this component (rather than the
 * parent), so the parent only needs to mount it for SNG tables and
 * pass `tableId` + `onLeave`. The modal:
 *   - reads the current user's result via useSitAndGoPlayerResults;
 *   - returns null if there's no result yet (player still active);
 *   - returns null if the user has already dismissed it this game
 *     (localStorage flag keyed on `${tableId}:${userAddress}`).
 *
 * Refs block52/ui#371, originally tracked in block52/poker-vm#2106.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useSitAndGoPlayerResults } from "../../hooks/game/useSitAndGoPlayerResults";
import { formatUSDCToSimpleDollars } from "../../utils/numberUtils";
import { isNullish } from "../../utils/guards";

const PLACE_SUFFIX = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
const ordinal = (place: number): string => PLACE_SUFFIX[place - 1] ?? `${place}th`;

// localStorage flag — once the user has dismissed the modal for this
// (tableId, userAddress), a page refresh shouldn't re-pop it.
const dismissKey = (tableId: string, userAddress: string) =>
    `viewed_sng_result_${tableId}_${userAddress.toLowerCase()}`;

interface SitAndGoResultModalProps {
    tableId: string | undefined;
    /**
     * Invoked when the user clicks "Leave Table". Should fire the
     * chain leave action so the finished table can be reaped (see
     * acceptance criteria in block52/ui#371). The parent passes
     * `handleLeaveTableConfirm` here.
     */
    onLeave: () => void | Promise<void>;
}

export const SitAndGoResultModal: React.FC<SitAndGoResultModalProps> = ({ tableId, onLeave }) => {
    const { isSitAndGo, getPlayerResult } = useSitAndGoPlayerResults();

    // Read the user address fresh on mount only. The active wallet
    // never changes mid-session for a given table view.
    const userAddress = useMemo(
        () => localStorage.getItem("user_cosmos_address")?.toLowerCase() ?? null,
        [],
    );

    const playerResult = useMemo(() => {
        if (!isSitAndGo || isNullish(userAddress)) return null;
        return getPlayerResult(userAddress);
    }, [isSitAndGo, getPlayerResult, userAddress]);

    // Seed dismissed state from localStorage so a page refresh after
    // the user explicitly closed the modal doesn't re-pop it.
    const [dismissed, setDismissed] = useState<boolean>(() => {
        if (isNullish(tableId) || isNullish(userAddress)) return false;
        return localStorage.getItem(dismissKey(tableId, userAddress)) === "true";
    });

    // If the user lands on the page and the result is already present
    // (e.g. tournament ended while they were away), the seeded state
    // above already gates correctly. This effect only matters for the
    // mid-session transition (result arrives via WS push while modal
    // is mounted).
    useEffect(() => {
        if (isNullish(tableId) || isNullish(userAddress)) return;
        setDismissed(localStorage.getItem(dismissKey(tableId, userAddress)) === "true");
    }, [tableId, userAddress]);

    if (isNullish(playerResult) || dismissed) return null;
    if (isNullish(tableId) || isNullish(userAddress)) return null;

    const { place, payout, isWinner } = playerResult;
    const isPaid = payout !== "0";

    const handleLeaveClick = async () => {
        // Persist dismissal first so a slow chain leave doesn't leave
        // the modal hanging if the user navigates away mid-tx.
        localStorage.setItem(dismissKey(tableId, userAddress), "true");
        setDismissed(true);
        await onLeave();
    };

    // Copy: paid finishers get the celebratory variant (with payout
    // line). Unpaid finishers get a softer message with no dollar
    // amount. Winners get a small celebratory swap.
    const heading = isWinner
        ? "🏆 You won the tournament!"
        : isPaid
            ? `You finished ${ordinal(place)}!`
            : `You busted out — finished ${ordinal(place)}.`;

    const subtext = isPaid
        ? null
        : "Thanks for playing.";

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm"
            data-testid="sng-result-modal"
        >
            <div className="bg-gray-800/90 backdrop-blur-md p-8 rounded-xl w-96 shadow-2xl border border-blue-400/20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-xl" />
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500" />

                <div className="relative z-10">
                    <div className="flex items-center justify-center mb-4">
                        <img src="/block52.png" alt="Block52 Logo" className="h-16 w-auto object-contain" />
                    </div>

                    <h2
                        className="text-2xl font-bold text-white text-center mb-2 text-shadow"
                        data-testid="sng-result-heading"
                    >
                        {heading}
                    </h2>

                    {subtext && (
                        <p className="text-gray-300 text-center mb-6 text-sm">
                            {subtext}
                        </p>
                    )}

                    {isPaid && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6 text-center">
                            <div className="text-xs text-green-300 font-semibold mb-1">
                                YOUR PAYOUT
                            </div>
                            <div
                                className="text-3xl text-white font-bold"
                                data-testid="sng-result-payout"
                            >
                                ${formatUSDCToSimpleDollars(payout)}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleLeaveClick}
                        data-testid="sng-result-leave-btn"
                        className="w-full py-3 px-4 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm font-semibold hover:bg-red-500/20 hover:border-red-500/60 transition-colors duration-200"
                    >
                        Leave Table
                    </button>

                    <div className="text-center mt-4">
                        <div className="flex items-center justify-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            <span className="text-xs text-gray-400">Powered by Block52</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SitAndGoResultModal;
