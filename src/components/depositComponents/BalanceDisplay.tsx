import React from "react";
import { formatBalance } from "../../utils/numberUtils";
import { hasValue } from "../../utils/guards";
import styles from "./DepositComponents.module.css";

interface BalanceDisplayProps {
    balance: string;
    nonce?: number | null;
    clubName: string;
}

/**
 * Displays the user's Block52 balance and nonce
 */
export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({ balance, nonce, clubName }) => {
    return (
        <div
            className={`backdrop-blur-sm rounded-lg p-4 mb-6 shadow-lg transition-all duration-300 ${styles.panelCard}`}
        >
            <p className={`text-lg mb-2 ${styles.titleText}`}>
                {clubName} Balance:
            </p>
            <p className={`text-xl font-bold ${styles.primaryText}`}>
                ${formatBalance(balance)} USDC
            </p>
            {hasValue(nonce) && (
                <p
                    className={`text-sm mt-2 border-t pt-2 ${styles.secondaryText} ${styles.secondaryBorder}`}
                >
                    <span className={styles.primaryTextMuted}>Nonce:</span> {nonce}
                </p>
            )}
        </div>
    );
};

export default BalanceDisplay;
