import React, { useState } from "react";
import { TopUpModal } from "./modals";
import styles from "./BuyChipsButton.module.css";

interface BuyChipsButtonProps {
    tableId: string;
    currentStack: string; // USDC micro-units
    minBuyIn: string; // USDC micro-units
    maxBuyIn: string; // USDC micro-units
    walletBalance: string; // USDC micro-units
    canTopUp: boolean; // Whether player can currently top up
    onTopUp: (amount: string) => Promise<void>; // Callback for top-up action
}

/**
 * BuyChipsButton component
 *
 * Displays a Top-Up Chips button at the bottom-right of the table UI.
 * Visible whenever the user is seated (#401); the disabled state reflects
 * whether the chain currently accepts a top-up request.
 *
 * Location: Bottom-right of table screen (as per issue #774).
 */
const BuyChipsButton: React.FC<BuyChipsButtonProps> = ({
    tableId,
    currentStack,
    minBuyIn,
    maxBuyIn,
    walletBalance,
    canTopUp,
    onTopUp
}) => {
    const [showModal, setShowModal] = useState(false);

    const handleTopUp = async (amount: string) => {
        try {
            await onTopUp(amount);
            setShowModal(false);
        } catch (error) {
            console.error("Top-up failed:", error);
            // Error handling is done in the modal
        }
    };

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                disabled={!canTopUp}
                className={`px-4 py-2 rounded-lg font-medium text-white shadow-md transition-all duration-200 ${
                    canTopUp ? styles.topUpEnabled : styles.topUpDisabled
                }`}
                title={canTopUp ? "Add chips for the next hand" : "Top-up not available right now"}
            >
                💰 TOP-UP CHIPS
            </button>

            {showModal && (
                <TopUpModal
                    tableId={tableId}
                    currentStack={currentStack}
                    minBuyIn={minBuyIn}
                    maxBuyIn={maxBuyIn}
                    walletBalance={walletBalance}
                    onClose={() => setShowModal(false)}
                    onTopUp={handleTopUp}
                />
            )}
        </>
    );
};

export default BuyChipsButton;
