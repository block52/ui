import React, { useState, useMemo, useCallback } from "react";
import { microToUsdc, usdcToMicroBigInt } from "../../constants/currency";
import { Modal, LoadingSpinner } from "../common";
import styles from "./TopUpModal.module.css";
import type { TopUpModalProps } from "./types";

const TopUpModal: React.FC<TopUpModalProps> = ({ currentStack, minBuyIn, maxBuyIn, walletBalance, onClose, onTopUp }) => {
    const [topUpError, setTopUpError] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const { currentStackFormatted, maxBuyInFormatted, walletBalanceFormatted, minTopUpFormatted, maxTopUpFormatted, minTopUpMicro, maxTopUpMicro } = useMemo(() => {
        const current = microToUsdc(currentStack);
        const min = microToUsdc(minBuyIn);
        const max = microToUsdc(maxBuyIn);
        const wallet = microToUsdc(walletBalance);

        // Min top-up ensures player reaches at least minBuyIn
        const minTopUpAmount = current < min ? min - current : 0.01;
        // Max top-up capped by table max and wallet balance
        const maxTopUpAmount = Math.min(max - current, wallet);

        return {
            currentStackFormatted: current.toFixed(2),
            maxBuyInFormatted: max.toFixed(2),
            walletBalanceFormatted: wallet.toFixed(2),
            minTopUpFormatted: minTopUpAmount.toFixed(2),
            maxTopUpFormatted: maxTopUpAmount.toFixed(2),
            minTopUpMicro: usdcToMicroBigInt(minTopUpAmount),
            maxTopUpMicro: usdcToMicroBigInt(maxTopUpAmount)
        };
    }, [currentStack, minBuyIn, maxBuyIn, walletBalance]);

    const [topUpAmount, setTopUpAmount] = useState(() => maxTopUpFormatted);

    const canTopUp = useMemo(() => {
        return parseFloat(maxTopUpFormatted) > 0;
    }, [maxTopUpFormatted]);

    const handleTopUpChange = useCallback((amount: string) => {
        setTopUpAmount(amount);
        setTopUpError("");
    }, []);

    const handleMinClick = useCallback(() => {
        handleTopUpChange(minTopUpFormatted);
    }, [minTopUpFormatted, handleTopUpChange]);

    const handleMaxClick = useCallback(() => {
        handleTopUpChange(maxTopUpFormatted);
    }, [maxTopUpFormatted, handleTopUpChange]);

    const isAmountInvalid = useMemo(() => {
        const amount = parseFloat(topUpAmount);
        if (isNaN(amount) || amount <= 0) return true;
        const amountMicro = usdcToMicroBigInt(amount);
        return amountMicro < minTopUpMicro || amountMicro > maxTopUpMicro;
    }, [topUpAmount, minTopUpMicro, maxTopUpMicro]);

    const handleTopUpClick = useCallback(async () => {
        try {
            setTopUpError("");
            setIsProcessing(true);

            const topUpMicrounits = usdcToMicroBigInt(parseFloat(topUpAmount));

            if (topUpMicrounits <= 0n) {
                setTopUpError("Top-up amount must be positive");
                return;
            }

            if (topUpMicrounits < minTopUpMicro) {
                setTopUpError(`Minimum top-up is $${minTopUpFormatted}`);
                return;
            }

            if (topUpMicrounits > maxTopUpMicro) {
                setTopUpError(`Maximum top-up is $${maxTopUpFormatted}`);
                return;
            }

            await onTopUp(topUpMicrounits.toString());
        } catch (error) {
            console.error("Error in top-up:", error);
            setTopUpError("Failed to top up. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    }, [topUpAmount, minTopUpMicro, maxTopUpMicro, minTopUpFormatted, maxTopUpFormatted, onTopUp]);

    if (!canTopUp) {
        return (
            <Modal isOpen={true} onClose={onClose} title="Cannot Top Up" patternId="hexagons-topup-error">
                <p className="text-gray-300 mb-6">
                    {parseFloat(walletBalanceFormatted) === 0
                        ? "Insufficient wallet balance. Please deposit USDC to continue."
                        : "You are already at the table maximum buy-in."}
                </p>
                <button
                    onClick={onClose}
                    className={`w-full px-5 py-3 rounded-lg text-white font-medium hover:opacity-80 transition-opacity ${styles.cancelButton}`}
                >
                    Close
                </button>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Buy Chips"
            titleIcon="💰"
            error={topUpError}
            isProcessing={isProcessing}
            patternId="hexagons-topup"
        >
            {/* Current Stack */}
            <div className={`mb-4 p-4 rounded-lg ${styles.infoCard}`}>
                <div className="text-sm text-gray-400 mb-1">Current Stack</div>
                <div className="text-2xl font-bold text-white">${currentStackFormatted}</div>
                <div className="text-xs text-gray-500 mt-1">Table Max: ${maxBuyInFormatted}</div>
            </div>

            {/* Wallet Balance */}
            <div className={`mb-6 p-4 rounded-lg ${styles.infoCard}`}>
                <div className="text-sm text-gray-400 mb-1">Wallet Balance</div>
                <div className="text-xl font-bold text-white">${walletBalanceFormatted}</div>
            </div>

            {/* Top-Up Amount Selection */}
            <div className="mb-6">
                <label className="block text-gray-300 mb-2 font-medium text-sm">Top-Up Amount</label>
                <div className="flex gap-2 mb-3">
                    <button
                        onClick={handleMinClick}
                        className={`flex-1 py-2 text-white rounded transition duration-200 hover:bg-opacity-80 ${styles.maxButton}`}
                    >
                        <div className="text-xs text-gray-400">MIN</div>
                        <div className="font-bold">${minTopUpFormatted}</div>
                    </button>
                    <button
                        onClick={handleMaxClick}
                        className={`flex-1 py-2 text-white rounded transition duration-200 hover:bg-opacity-80 ${styles.maxButton}`}
                    >
                        <div className="text-xs text-gray-400">MAX</div>
                        <div className="font-bold">${maxTopUpFormatted}</div>
                    </button>
                </div>
                <div className="flex-1">
                    <input
                        type="number"
                        value={topUpAmount}
                        onChange={e => handleTopUpChange(e.target.value)}
                        className={`w-full p-2 text-white rounded-lg text-center focus:outline-none ${styles.amountInput}`}
                        style={isAmountInvalid && topUpAmount ? { borderColor: "red" } : undefined}
                        placeholder="0.00"
                        step="0.01"
                    />
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-3">
                <button
                    onClick={handleTopUpClick}
                    disabled={isProcessing || isAmountInvalid}
                    className={`w-full px-5 py-3 rounded-lg font-medium text-white shadow-md flex items-center justify-center gap-2 ${styles.buyButton}`}
                >
                    {isProcessing ? (
                        <>
                            <LoadingSpinner size="sm" />
                            Processing...
                        </>
                    ) : (
                        "BUY"
                    )}
                </button>
                <button
                    onClick={onClose}
                    disabled={isProcessing}
                    className={`w-full px-5 py-3 rounded-lg text-white font-medium transition-all duration-200 disabled:opacity-50 hover:opacity-80 ${styles.cancelButton}`}
                >
                    Cancel
                </button>
            </div>

            <div className={`mt-4 text-xs ${styles.noteText}`}>
                <strong>Note:</strong> You can only top up when not in an active hand.
            </div>
        </Modal>
    );
};

export default TopUpModal;
