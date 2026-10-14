import React from "react";
import { PreAction } from "../../utils/preActions";

interface PreActionControlsProps {
    /** The buttons to show, left→right (from preActionButtons). */
    buttons: PreAction[];
    /** Which pre-action is armed, or null. */
    armed: PreAction | null;
    /** Arm a pre-action, or null to disarm. Arming is mutually exclusive. */
    onArm: (action: PreAction | null) => void;
    /** Formatted owed amount, e.g. "$3" — shown on the "Call {amount}" button. */
    callAmountLabel: string;
    isMobileLandscape?: boolean;
}

const LABELS: Record<PreAction, string> = {
    "check-fold": "Check/Fold",
    check: "Check",
    fold: "Fold",
    "call-exact": "Call", // suffixed with the amount at render time
    "call-any": "Call Any",
    "all-in": "All In"
};

const TITLES: Record<PreAction, string> = {
    "check-fold": "Checks when your turn comes if checking is free; folds if someone bets first.",
    check: "Checks when your turn comes. Clears if someone bets first.",
    fold: "Folds your hand when your turn comes.",
    "call-exact": "Calls this exact amount when your turn comes. Clears if the bet is raised.",
    "call-any": "Calls whatever the bet is when your turn comes.",
    "all-in": "Calls all-in when your turn comes (the call commits your whole stack)."
};

/**
 * CoinPoker-style pre-action bar (ui#388): tick-to-arm buttons shown while it is not
 * the player's turn. `buttons` (from preActionButtons) already encodes which options
 * apply — can check, owe a bet, owe an all-in call, or committed (empty → nothing
 * shown). Arming one fires it the instant the player's turn comes (no betting bar).
 */
export const PreActionControls: React.FC<PreActionControlsProps> = ({ buttons, armed, onArm, callAmountLabel, isMobileLandscape }) => {
    if (buttons.length === 0) return null;

    return (
        <div className="flex justify-center gap-2">
            {buttons.map(action => {
                const isArmed = armed === action;
                const label = action === "call-exact" ? `Call ${callAmountLabel}` : LABELS[action];
                return (
                    <button
                        key={action}
                        type="button"
                        role="checkbox"
                        aria-checked={isArmed}
                        aria-label={`Pre-select ${label} for your turn`}
                        title={TITLES[action]}
                        onClick={() => onArm(isArmed ? null : action)}
                        className={`flex items-center gap-2 rounded-lg border font-semibold transition-colors ${
                            isMobileLandscape ? "px-3 py-1 text-xs" : "px-4 py-3 text-sm lg:text-base"
                        } ${
                            isArmed
                                ? "bg-green-600 border-green-500 text-white"
                                : "bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700"
                        }`}
                    >
                        <span
                            className={`flex h-4 w-4 items-center justify-center rounded-sm border text-[10px] leading-none ${
                                isArmed ? "bg-white border-white text-green-600" : "border-gray-400 text-transparent"
                            }`}
                        >
                            ✓
                        </span>
                        <span>{label}</span>
                    </button>
                );
            })}
        </div>
    );
};
