import React, { useState } from "react";
import { TopUpModal } from "./modals";
import styles from "./BuyChipsButton.module.css";

interface BuyChipsButtonProps {
    tableId: string;
    currentStack: string; // USDC micro-units
    minBuyIn: string; // USDC micro-units
    maxBuyIn: string; // USDC micro-units
    walletBalance: string; // USDC micro-units
    onTopUp: (amount: string) => Promise<void>; // Callback for top-up action
    disabled?: boolean; // Disabled when TOP_UP isn't a current legal action (in the hand)
    disabledReason?: string; // Tooltip explaining why it's disabled
}

/**
 * BuyChipsButton component
 *
 * Displays a Top-Up Chips button at the bottom-right of the table UI.
 * Always VISIBLE whenever the user is seated (#401), but DISABLED while the
 * player is in the current hand — enablement is driven by the backend TOP_UP
 * legal action (the engine omits it while ACTIVE/ALL_IN), not a client rule
 * (#597). Top-up applies at the start of the next hand.
 *
 * Location: Bottom-right of table screen (as per issue #774).
 */
const BuyChipsButton: React.FC<BuyChipsButtonProps> = ({
    tableId,
    currentStack,
    minBuyIn,
    maxBuyIn,
    walletBalance,
    onTopUp,
    disabled = false,
    disabledReason
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
                onClick={() => !disabled && setShowModal(true)}
                disabled={disabled}
                className={`px-4 py-2 rounded-lg font-medium text-white shadow-md transition-all duration-200 ${
                    disabled ? "opacity-50 cursor-not-allowed" : styles.topUpEnabled
                }`}
                title={disabled ? disabledReason || "You can top up between hands, not while you're in the hand" : "Add chips for the next hand"}
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
