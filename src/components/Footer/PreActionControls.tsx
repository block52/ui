import React from "react";
import { PreAction } from "../../utils/preActions";
import { isEmpty } from "../../utils/guards";
import type { TranslationKey } from "../../i18n";
import { useLanguage } from "../../i18n/useLanguage";

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

const LABELS: Record<Exclude<PreAction, "call-exact">, TranslationKey> = {
    "check-fold": "pre.checkFold",
    check: "pre.check",
    fold: "pre.fold",
    "call-any": "pre.callAny",
    "all-in": "pre.allIn"
};

const TITLES: Record<PreAction, TranslationKey> = {
    "check-fold": "pre.checkFoldHelp",
    check: "pre.checkHelp",
    fold: "pre.foldHelp",
    "call-exact": "pre.callHelp",
    "call-any": "pre.callAnyHelp",
    "all-in": "pre.allInHelp"
};

/**
 * CoinPoker-style pre-action bar (ui#388): tick-to-arm buttons shown while it is not
 * the player's turn. `buttons` (from preActionButtons) already encodes which options
 * apply — can check, owe a bet, owe an all-in call, or committed (empty → nothing
 * shown). Arming one fires it the instant the player's turn comes (no betting bar).
 */
export const PreActionControls: React.FC<PreActionControlsProps> = ({ buttons, armed, onArm, callAmountLabel, isMobileLandscape }) => {
    const { t } = useLanguage();
    if (isEmpty(buttons)) return null;

    return (
        <div className="flex justify-center gap-2">
            {buttons.map(action => {
                const isArmed = armed === action;
                const label = action === "call-exact" ? t("pre.callAmount", { amount: callAmountLabel }) : t(LABELS[action]);
                return (
                    <button
                        key={action}
                        type="button"
                        role="checkbox"
                        aria-checked={isArmed}
                        aria-label={t("pre.aria", { label })}
                        title={t(TITLES[action])}
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
