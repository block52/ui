import React from "react";
import styles from "./DepositComponents.module.css";

interface Web3DepositSectionProps {
    isConnected: boolean;
    web3Address?: string;
    web3Balance: string;
    depositAmount: string;
    isTransferring: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
    onRefreshBalance: () => void;
    onAmountChange: (amount: string) => void;
    onTransfer: () => void;
}

/**
 * Web3 wallet deposit section with connect/disconnect and USDC transfer
 */
export const Web3DepositSection: React.FC<Web3DepositSectionProps> = ({
    isConnected,
    web3Address,
    web3Balance,
    depositAmount,
    isTransferring,
    onConnect,
    onDisconnect,
    onRefreshBalance,
    onAmountChange,
    onTransfer
}) => {
    const isTransferDisabled = !depositAmount || isTransferring || parseFloat(depositAmount) <= 0;

    return (
        <div className={`mt-8 pt-6 border-t ${styles.sectionBorderTop}`}>
            <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-3">
                    <div className={`h-px flex-1 ${styles.sectionDivider}`}></div>
                    <span className="text-gray-400 text-sm px-2">OR</span>
                    <div className={`h-px flex-1 ${styles.sectionDivider}`}></div>
                </div>
            </div>

            <div
                className={`backdrop-blur-sm rounded-xl p-5 shadow-lg transition-all duration-300 ${styles.web3Panel}`}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <svg className="w-8 h-8" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                            <g fill="none" fillRule="evenodd">
                                <circle cx="16" cy="16" r="16" fill="#2775CA" />
                                <path
                                    fill="#FFF"
                                    d="M15.75 27.5C9.26 27.5 4 22.24 4 15.75S9.26 4 15.75 4a11.75 11.75 0 110 23.5zm-.7-16.11a2.58 2.58 0 00-2.45 2.47c0 1.21.74 2 2.31 2.33 1.1.26 1.3.5 1.3.93s-.27.69-.9.69a4.46 4.46 0 01-2.44-.75l-.44 1.84a5.26 5.26 0 002.44.57v1.78h1.5V19c1.84-.17 2.87-1.33 2.87-2.69 0-1.17-.7-1.94-2.27-2.3-1.1-.23-1.34-.48-1.34-.91s.28-.66.83-.66a4.06 4.06 0 012 .54L19 11.3a5.66 5.66 0 00-2-.43v-1.8h-1.5v1.78a2.52 2.52 0 00-.45.04z"
                                />
                            </g>
                        </svg>
                        <div>
                            <h2 className={`text-lg font-bold ${styles.titleText}`}>
                                USDC via Web3 Wallet
                            </h2>
                            <p className={`text-xs ${styles.secondaryTextStrong}`}>
                                Web3 compatible wallets
                            </p>
                        </div>
                    </div>
                </div>

                <div
                    className={`p-3 rounded-lg mb-4 ${styles.methodInfoPanel}`}
                >
                    <p className={`text-xs ${styles.secondaryTextStrong}`}>
                        <strong>How it works:</strong> Connect wallet → Send USDC directly → No conversion fees → Credits your gaming account
                    </p>
                </div>

                {!isConnected ? (
                    <button
                        onClick={onConnect}
                        className={`w-full py-3 px-4 rounded-lg transition duration-300 shadow-md hover:opacity-90 ${styles.connectButton}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-white">Connect Wallet</span>
                        </div>
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div className={`flex justify-between items-center ${styles.connectedText}`}>
                            <span>
                                Connected: {web3Address?.slice(0, 6)}...{web3Address?.slice(-4)}
                            </span>
                            <button
                                onClick={onDisconnect}
                                className="text-xs px-3 py-1 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-lg transition duration-300 shadow-md"
                            >
                                Disconnect
                            </button>
                        </div>

                        <div
                            className={`p-3 rounded-lg ${styles.balancePanel}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center ${styles.balanceIconWrap}`}
                                    >
                                        <span className={`font-bold text-lg ${styles.primaryText}`}>$</span>
                                    </div>
                                    <div>
                                        <p className={`text-sm font-bold ${styles.titleText}`}>Web3 Wallet USDC Balance</p>
                                        <p className={`text-xs ${styles.secondaryTextStrong}`}>Available on Ethereum Mainnet</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="text-right">
                                        <p className={`text-lg font-bold ${styles.primaryText}`}>${web3Balance || "0.00"}</p>
                                    </div>
                                    <button
                                        onClick={onRefreshBalance}
                                        className="p-1.5 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
                                        title="Refresh balance"
                                    >
                                        <svg className={`w-4 h-4 ${styles.iconPrimary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className={`text-sm mb-2 ${styles.secondaryText}`}>Enter amount in USD:</p>
                            <input
                                type="number"
                                value={depositAmount}
                                onChange={e => onAmountChange(e.target.value)}
                                placeholder="100.00"
                                className={`w-full p-3 rounded-lg focus:outline-none focus:ring-2 transition-all ${styles.amountInput}`}
                                min="0"
                                step="0.01"
                            />

                            <button
                                onClick={onTransfer}
                                disabled={isTransferDisabled}
                                className={`w-full py-3 px-4 rounded-lg transition duration-300 shadow-md ${styles.transferButton}`}
                            >
                                {isTransferring ? "Processing..." : "Deposit USDC"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Web3DepositSection;
