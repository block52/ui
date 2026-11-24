import React from "react";
import { useCosmosWallet } from "../../hooks";
import { microToUsdc } from "@block52/poker-ui-core/constants/currency";
import DepositCore from "./DepositCore";
import type { USDCDepositModalProps } from "./types";
import styles from "./USDCDepositModal.module.css";

const USDCDepositModal: React.FC<USDCDepositModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const cosmosWallet = useCosmosWallet();

    // Get USDC balance from Cosmos wallet
    const b52Balance = React.useMemo(() => {
        const usdcBalance = cosmosWallet.balance.find(b => b.denom === "usdc");
        if (!usdcBalance) return "0.00";
        return microToUsdc(usdcBalance.amount).toFixed(2);
    }, [cosmosWallet.balance]);

    const handleSuccess = () => {
        if (onSuccess) onSuccess();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className={`rounded-xl max-w-md w-full my-auto flex flex-col max-h-[90vh] ${styles.modalSurface}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-4 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white">Deposit Funds</h2>
                        <p className="text-sm text-gray-400 mt-1">Add USDC to your game wallet</p>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* Current Balance */}
                    <div className={`mb-6 p-3 rounded-lg flex items-center justify-between ${styles.surfaceMuted}`}>
                        <span className={`text-sm ${styles.textSecondary}`}>Game Wallet Balance</span>
                        <span className={`font-semibold ${styles.textPrimary}`}>${b52Balance} USDC</span>
                    </div>

                    {/* Deposit Core Component */}
                    <DepositCore onSuccess={handleSuccess} showMethodSelector={true} />

                    {/* Cancel Button */}
                    <button
                        onClick={onClose}
                        className={`w-full mt-4 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90 ${styles.cancelButton}`}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default USDCDepositModal;
