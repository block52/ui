import React from "react";

interface PreCheckControlProps {
    /** Whether the pre-check is currently queued. */
    checked: boolean;
    /** Toggle the queued state. */
    onChange: (next: boolean) => void;
    isMobileLandscape?: boolean;
}

/**
 * Pre-select "Check" control (ui#388).
 *
 * Shown when the player is in the hand, not yet to act, and checking would be
 * free (no live bet to them). Ticking it queues an auto-CHECK that fires the
 * moment action reaches them. If a bet lands first, the parent hides this control
 * and clears the queue — so it can only ever check, never fold.
 *
 * Rendered where the CHECK button normally sits so it stays in place when the
 * player's turn arrives.
 */
export const PreCheckControl: React.FC<PreCheckControlProps> = ({ checked, onChange, isMobileLandscape }) => {
    return (
        <div className="flex justify-center">
            <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label="Pre-select check for your turn"
                title="Auto-checks when your turn comes if it's still free. If someone bets first, this clears and it's your decision."
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
                <span>Check</span>
            </button>
        </div>
    );
};
