import React from "react";

interface PreCheckFoldControlProps {
    /** Whether Check/Fold is currently queued. */
    checked: boolean;
    /** Toggle the queued state. */
    onChange: (next: boolean) => void;
    /** True once a bet has landed, so the queued Check/Fold will now fold. */
    facingBet: boolean;
    isMobileLandscape?: boolean;
}

/**
 * Pre-select "Check/Fold" control (ui#388).
 *
 * Offered when the player is in the hand, not yet to act, and checking is free.
 * Ticking it queues the standard Check/Fold: check if it is still free when the
 * player's turn comes, fold if someone bets first. Once ticked it stays visible
 * after a bet lands, relabelled "Fold", so the player sees what will happen and
 * can untick it.
 *
 * Rendered where the CHECK button normally sits so it stays in place when the
 * player's turn arrives.
 */
export const PreCheckFoldControl: React.FC<PreCheckFoldControlProps> = ({ checked, onChange, facingBet, isMobileLandscape }) => {
    const label = facingBet ? "Fold" : "Check/Fold";
    return (
        <div className="flex justify-center">
            <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={facingBet ? "Pre-select fold for your turn" : "Pre-select check or fold for your turn"}
                title="Checks when your turn comes if checking is free. If someone bets first, you fold."
                onClick={() => onChange(!checked)}
                className={`flex items-center gap-2 rounded-lg border font-semibold transition-colors ${
                    isMobileLandscape ? "px-3 py-1 text-xs" : "px-6 py-3 text-sm lg:text-base"
                } ${
                    checked
                        ? "bg-green-600 border-green-500 text-white"
                        : "bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700"
                }`}
            >
                <span
                    className={`flex h-4 w-4 items-center justify-center rounded-sm border text-[10px] leading-none ${
                        checked ? "bg-white border-white text-green-600" : "border-gray-400 text-transparent"
                    }`}
                >
                    ✓
                </span>
                <span>{label}</span>
            </button>
        </div>
    );
};
