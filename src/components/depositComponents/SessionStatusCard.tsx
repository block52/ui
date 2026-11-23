import React from "react";
import { formatMicroAsUsdc } from "@block52/poker-ui-core/constants/currency";
import { DepositSession } from "@block52/poker-ui-core/types";
import styles from "./DepositComponents.module.css";

interface SessionStatusCardProps {
    session: DepositSession;
}

/**
 * Displays current deposit session status
 */
export const SessionStatusCard: React.FC<SessionStatusCardProps> = ({ session }) => {
    return (
        <div
            className={`backdrop-blur-sm rounded-lg p-4 mb-6 shadow-lg transition-all duration-300 ${styles.panelCard}`}
        >
            <h2 className={`text-lg font-semibold mb-2 ${styles.titleText}`}>
                Session Status
            </h2>
            <p className={`text-sm ${styles.secondaryText}`}>
                Status: {session.status}
            </p>
            <p className={`text-sm ${styles.secondaryText}`}>
                Session ID: {session._id}
            </p>
            {session.amount && (
                <p className={`text-sm ${styles.secondaryText}`}>
                    Amount: ${formatMicroAsUsdc(session.amount, 2)} USDC
                </p>
            )}
        </div>
    );
};

export default SessionStatusCard;
