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
 * Displays a button in the bottom-left corner of the table UI that allows
 * players to top up their chip stack when not in an active hand.
 *
 * Location: Bottom-left corner of table screen (as per issue #774)
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
                title={canTopUp ? "Add chips to your stack" : "Cannot top up during an active hand"}
            >
                💰 BUY CHIPS
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
