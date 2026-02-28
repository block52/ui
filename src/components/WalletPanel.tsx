import React from "react";
import { useNavigate } from "react-router-dom";
import { useCosmosWallet } from "../hooks";
import styles from "./WalletPanel.module.css";

// Copy to clipboard utility
const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
};

interface WalletPanelProps {
    onDeposit: () => void;
    onWithdraw: () => void;
    onTransfer: () => void;
    onCreateWallet: () => void;
    onImportWallet: () => void;
    usdcBalance: string;
}

/**
 * WalletPanel - Cosmos wallet display component
 * Shows wallet address, balances, and action buttons
 * Styled to match TableList component
 */
const WalletPanel: React.FC<WalletPanelProps> = ({ onDeposit, onWithdraw, onTransfer, onCreateWallet, onImportWallet, usdcBalance }) => {
    const navigate = useNavigate();
    const cosmosWallet = useCosmosWallet();

    if (!cosmosWallet.address) {
        // No wallet - show create/import options
        return (
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-gray-900 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Game Wallet</h2>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-400 mb-6">Create or import a wallet to start playing</p>

                    <div className="space-y-3">
                        <button
                            onClick={onCreateWallet}
                            className={`w-full py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90 ${styles.primaryButton}`}
                        >
                            Create New Wallet
                        </button>
                        <button
                            onClick={onImportWallet}
                            className="w-full py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90 border border-gray-600 bg-transparent hover:bg-gray-700"
                        >
                            Import Existing Wallet
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Game Wallet</h2>
                <div className="flex items-center gap-2">
                    {/* Settings Button */}
                    <button
                        onClick={() => navigate("/wallet")}
                        className="p-2 rounded-lg transition-all hover:bg-gray-700 hover:opacity-90"
                        title="Manage Wallet"
                    >
                        <svg className="w-5 h-5 text-gray-400 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {/* Address */}
                <div className="mb-4">
                    <label className="text-gray-400 text-sm">Address</label>
                    <div className="flex gap-2 items-center mt-1">
                        <input
                            type="text"
                            value={cosmosWallet.address}
                            readOnly
                            className="flex-1 text-white px-3 py-2 rounded-lg border border-gray-600 bg-gray-900 font-mono text-sm truncate"
                        />
                        <button
                            onClick={() => copyToClipboard(cosmosWallet.address || "", "Address")}
                            className={`text-white px-3 py-2 rounded-lg transition-all hover:opacity-90 text-sm ${styles.primaryButton}`}
                        >
                            Copy
                        </button>
                    </div>
                </div>

                {/* USDC Balance */}
                <div className="mb-4">
                    <div className="p-3 rounded-lg bg-gray-900 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${styles.balanceIconContainer}`}>
                                    <span className={`font-bold text-lg ${styles.balanceIconDollar}`}>$</span>
                                </div>
                                <div>
                                    <p className="text-white font-bold">USDC Balance</p>
                                    <p className="text-gray-400 text-sm">Gaming funds</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-white">${Number(usdcBalance).toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={onDeposit}
                        className={`flex-1 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90 ${styles.primaryButton}`}
                    >
                        Deposit
                    </button>
                    <button
                        onClick={onWithdraw}
                        className={`flex-1 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90 ${styles.primaryButton}`}
                    >
                        Withdraw
                    </button>
                    <button
                        onClick={onTransfer}
                        className={`flex-1 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90 ${styles.primaryButton}`}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WalletPanel;
