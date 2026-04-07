import { useState, useEffect, useCallback } from "react";
import * as React from "react";
import useUserWalletConnect from "../../hooks/wallet/useUserWalletConnect";
import useDepositUSDC from "../../hooks/wallet/useDepositUSDC";
import useAllowance from "../../hooks/wallet/useAllowance";
import useDecimal from "../../hooks/wallet/useDecimals";
import useApprove from "../../hooks/wallet/useApprove";
import spinner from "../../assets/spinning-circles.svg";
import btcLogo from "../../assets/crypto/btc.svg";
import usdcLogo from "../../assets/crypto/usdc.svg";
import useWalletBalance from "../../hooks/wallet/useWalletBalance";
import { toast } from "react-toastify";
import { COSMOS_BRIDGE_ADDRESS } from "../../config/constants";
import { maxUint256 } from "viem";
import { getTokenAddress } from "../../utils/tokenUtils";
import type { DepositToken } from "../../utils/tokenUtils";
import { useCosmosWallet } from "../../hooks";
import { formatUSDCToSimpleDollars, convertAmountToBigInt } from "../../utils/numberUtils";
import CurrencySelector from "./CryptoPayment/CurrencySelector";
import PaymentDisplay from "./CryptoPayment/PaymentDisplay";
import PaymentStatusMonitor from "./CryptoPayment/PaymentStatusMonitor";
import { useProfileAvatar } from "../../context/profile/ProfileAvatarContext";
import styles from "./DepositCore.module.css";
import { DepositCountdown } from "../common";

type DepositMethod = "crypto" | "usdc";

interface PaymentData {
    payment_id: string;
    pay_address: string;
    pay_amount: number;
    pay_currency: string;
    price_amount: number;
    expires_at: string;
    success?: boolean;
}

import type { DepositCoreProps } from "./types";
import { usePaymentApi } from "../../context/PaymentApiContext";

const DepositCore: React.FC<DepositCoreProps> = ({ onSuccess, showMethodSelector = true }) => {
    const BRIDGE_ADDRESS = COSMOS_BRIDGE_ADDRESS;

    // Token selection for Web3 deposit (USDC or USDT)
    const [selectedToken, setSelectedToken] = useState<DepositToken>("USDC");
    const tokenAddress = getTokenAddress(selectedToken);

    const { open, disconnect, isConnected, address } = useUserWalletConnect();
    const { deposit, depositToken, isDepositPending, isDepositConfirmed, isPending, depositError } = useDepositUSDC();
    const { isApprovePending, isApproveConfirmed, isLoading, approve, approveError } = useApprove();
    const [amount, setAmount] = useState<string>("0");
    const { decimals } = useDecimal(tokenAddress);
    const [walletAllowance, setWalletAllowance] = useState<bigint>(BigInt(0));
    const [tmpWalletAllowance, setTmpWalletAllowance] = useState<bigint>(BigInt(0));
    const [tmpDepositAmount, setTmpDepositAmount] = useState<bigint>(BigInt(0));
    const { allowance } = useAllowance(tokenAddress);
    const { balance } = useWalletBalance(tokenAddress);
    const cosmosWallet = useCosmosWallet();
    const { refreshBalance } = cosmosWallet;
    const { refreshWalletNfts } = useProfileAvatar();

    // USDT approval quirk: must reset allowance to 0 before setting new value
    const [isResettingAllowance, setIsResettingAllowance] = useState(false);

    const [isCountingDown, setIsCountingDown] = useState(false);

    // Crypto payment state
    const [depositMethod, setDepositMethod] = useState<DepositMethod>("crypto");
    const [selectedCurrency, setSelectedCurrency] = useState<string>("btc");
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
    const [creatingPayment, setCreatingPayment] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<string>("waiting");

    const api = usePaymentApi();

    useEffect(() => {
        if (allowance) {
            setWalletAllowance(allowance);
        }
    }, [allowance]);

    useEffect(() => {
        if (isConnected && address) {
            refreshWalletNfts();
        }
    }, [isConnected, address, refreshWalletNfts]);

    useEffect(() => {
        if (isDepositConfirmed) {
            toast.success(`Deposit successful! ${selectedToken} sent to your game wallet.`, { autoClose: 5000 });
            setAmount("0");
            setWalletAllowance(w => w - tmpDepositAmount);
            refreshBalance();
            setIsCountingDown(true);
        }
    }, [isDepositConfirmed, selectedToken, tmpDepositAmount, refreshBalance]);

    const [approvalToastShown, setApprovalToastShown] = React.useState(false);

    useEffect(() => {
        if (isApproveConfirmed && !approvalToastShown) {
            if (isResettingAllowance) {
                // Step 2 of USDT approval: zero-approval confirmed, now set max allowance
                setIsResettingAllowance(false);
                setWalletAllowance(0n);
                approve(tokenAddress, BRIDGE_ADDRESS, maxUint256).then(() => {
                    setTmpWalletAllowance(maxUint256);
                });
            } else if (tmpWalletAllowance > 0n) {
                toast.success(`Account activated! You can now deposit ${selectedToken} anytime.`, { autoClose: 5000 });
                setWalletAllowance(tmpWalletAllowance);
                setApprovalToastShown(true);
            }
        }
    }, [isApproveConfirmed, approvalToastShown, isResettingAllowance, tmpWalletAllowance, selectedToken, approve, tokenAddress, BRIDGE_ADDRESS]);

    useEffect(() => {
        if (isLoading || isApprovePending) {
            setApprovalToastShown(false);
        }
    }, [isLoading, isApprovePending]);

    useEffect(() => {
        if (depositError) {
            toast.error("Failed to deposit", { autoClose: 5000 });
        }
    }, [depositError]);

    useEffect(() => {
        if (approveError) {
            toast.error("Failed to approve", { autoClose: 5000 });
        }
    }, [approveError]);

    // Reset approval state when switching tokens
    useEffect(() => {
        setWalletAllowance(BigInt(0));
        setTmpWalletAllowance(BigInt(0));
        setApprovalToastShown(false);
        setIsResettingAllowance(false);
    }, [selectedToken]);

    const allowed = React.useMemo(() => {
        if (!walletAllowance || !decimals || !+amount) return false;
        const amountInBigInt = convertAmountToBigInt(amount, decimals);
        return walletAllowance >= amountInBigInt;
    }, [amount, walletAllowance, decimals]);

    const handleApprove = async () => {
        if (!address || !decimals) {
            console.error("Missing required information");
            return;
        }

        try {
            // USDT quirk: must reset allowance to 0 before setting new value
            if (selectedToken === "USDT" && walletAllowance > 0n) {
                setIsResettingAllowance(true);
                await approve(tokenAddress, BRIDGE_ADDRESS, 0n);
                return;
            }

            await approve(tokenAddress, BRIDGE_ADDRESS, maxUint256);
            setTmpWalletAllowance(maxUint256);
        } catch (err) {
            console.error("Approval failed:", err);
            setIsResettingAllowance(false);
        }
    };

    const handleDeposit = async () => {
        if (!cosmosWallet.address) {
            console.error("No Cosmos wallet address. Please create or import a wallet first.");
            toast.error("Please create or import a game wallet first.", { autoClose: 5000 });
            return;
        }

        if (allowed) {
            try {
                const amountInBigInt = convertAmountToBigInt(amount, decimals);

                if (selectedToken === "USDC") {
                    await deposit(amountInBigInt, cosmosWallet.address);
                } else {
                    await depositToken(amountInBigInt, cosmosWallet.address, tokenAddress);
                }

                setTmpDepositAmount(amountInBigInt);
            } catch (err) {
                console.error("Deposit failed:", err);
            }
        } else {
            console.error("Insufficient allowance. Please approve deposit first.");
        }
    };

    const handleCreateCryptoPayment = async () => {
        if (!cosmosWallet.address) {
            toast.error("Please create or import a game wallet first.", { autoClose: 5000 });
            return;
        }

        if (!amount || +amount <= 0) {
            toast.error("Please enter a valid amount", { autoClose: 3000 });
            return;
        }

        try {
            setCreatingPayment(true);
            const response = (await api.createCryptoPayment({
                amount: +amount,
                currency: selectedCurrency,
                cosmosAddress: cosmosWallet.address
            })) as PaymentData;

            if (response.success) {
                setPaymentData({
                    payment_id: response.payment_id,
                    pay_address: response.pay_address,
                    pay_amount: response.pay_amount,
                    pay_currency: response.pay_currency,
                    price_amount: response.price_amount,
                    expires_at: response.expires_at
                });
            }
        } catch (err: unknown) {
            console.error("Error creating payment:", err);
            const axiosError = err as { response?: { data?: { error?: string } } };
            toast.error(axiosError.response?.data?.error ?? "Failed to create payment", { autoClose: 5000 });
        } finally {
            setCreatingPayment(false);
        }
    };

    const handlePaymentComplete = useCallback(() => {
        toast.success("Payment complete! USDC deposited to your game wallet.", { autoClose: 5000 });
        cosmosWallet.refreshBalance();
        setTimeout(() => {
            setPaymentData(null);
            setAmount("0");
            if (onSuccess) onSuccess();
        }, 3000);
    }, [cosmosWallet, onSuccess]);

    const handleNewPayment = () => {
        setPaymentData(null);
        setAmount("0");
    };

    return (
        <div className="space-y-4">
            {!paymentData ? (
                <>
                    {/* Deposit Method Selector */}
                    {showMethodSelector && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-400 mb-3">Select a deposit method</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setDepositMethod("crypto")}
                                    className={`p-3 rounded-lg border transition-all ${
                                        depositMethod === "crypto" ? `${styles.methodSelected}` : "border-gray-600 bg-gray-900 hover:border-gray-500"
                                    }`}
                                >
                                    <div className="text-center">
                                        <img src={btcLogo} alt="BTC" className="w-8 h-8 rounded-full mx-auto mb-1" />
                                        <div className="text-sm font-semibold text-white">Pay with Crypto</div>
                                        <div className="text-xs text-gray-400 mt-1">Many currencies supported (fees apply)</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setDepositMethod("usdc")}
                                    className={`p-3 rounded-lg border transition-all ${
                                        depositMethod === "usdc" ? `${styles.methodSelected}` : "border-gray-600 bg-gray-900 hover:border-gray-500"
                                    }`}
                                >
                                    <div className="text-center">
                                        <img src={usdcLogo} alt="USDC" className="w-8 h-8 rounded-full mx-auto mb-1" />
                                        <div className="text-sm font-semibold text-white">Deposit via Web3</div>
                                        <div className="text-xs text-gray-400 mt-1">USDC or USDT (ERC20)</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {depositMethod === "crypto" ? (
                        <>
                            {/* Crypto Payment Flow */}
                            <CurrencySelector selectedCurrency={selectedCurrency} onCurrencySelect={setSelectedCurrency} />

                            {/* Amount Input */}
                            <div className="my-4">
                                <label htmlFor="amount" className="block text-sm font-medium text-gray-400 mb-2">
                                    Amount (USD)
                                </label>
                                <input
                                    id="amount"
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="w-full p-3 border border-gray-600 bg-gray-900 text-white rounded-lg focus:border-blue-500 focus:outline-none"
                                    placeholder="0.00"
                                    min="10"
                                />
                                <p className="text-xs text-gray-400 mt-2">Minimum: $10 USD</p>
                                {+amount >= 10 && (
                                    <div className="mt-3 p-2 rounded bg-gray-800/50 text-xs">
                                        <div className="flex justify-between text-gray-300 font-medium">
                                            <span>You receive</span>
                                            <span className="text-green-400">${(+amount).toFixed(2)} USDC</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Fee Notice */}
                            <div className="mb-3 p-2 rounded-lg bg-yellow-900/20 border border-yellow-500/30 text-yellow-400 text-xs">
                                This method uses a third-party payment processor. A processing fee applies and will be shown before you confirm.
                            </div>

                            {/* Info Box */}
                            <div className="mb-4 p-3 rounded-lg bg-blue-900/20 border border-blue-500/50 text-blue-400 text-xs">
                                <p className="font-semibold mb-1">How it works:</p>
                                <ol className="list-decimal list-inside space-y-1 text-blue-400/80">
                                    <li>Select your cryptocurrency</li>
                                    <li>Enter USD amount to deposit</li>
                                    <li>Send crypto to the payment address</li>
                                    <li>Funds auto-convert to USDC and appear in your wallet</li>
                                </ol>
                            </div>

                            {/* Deposit Button */}
                            <button
                                onClick={handleCreateCryptoPayment}
                                className={`w-full py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-3 ${styles.primaryGradientButton} ${
                                    +amount < 10 || creatingPayment ? "opacity-50 cursor-not-allowed" : ""
                                }`}
                                disabled={+amount < 10 || creatingPayment}
                            >
                                {creatingPayment ? "Processing..." : "Deposit Now"}
                                {creatingPayment && <img src={spinner} className="w-5 h-5" alt="loading" />}
                            </button>
                        </>
                    ) : (
                        <>
                            {/* USDC Direct Deposit Flow */}
                            {!isConnected && (
                                <button
                                    className={`w-full py-3 rounded-lg text-white font-semibold mb-4 transition-all hover:opacity-90 ${styles.primaryGradientButton}`}
                                    onClick={open}
                                >
                                    Connect Your Web3 Wallet
                                </button>
                            )}

                            {address && (
                                <>
                                    <div className="mb-2 p-3 rounded-lg bg-gray-900 border border-gray-700">
                                        <p className="text-gray-400 text-sm mb-1">Connected Address</p>
                                        <p className="text-white font-mono text-sm break-all">{address}</p>
                                    </div>
                                    <button
                                        onClick={disconnect}
                                        className="w-full mb-4 py-2.5 px-3 rounded-lg text-white font-semibold bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 transition duration-300 shadow-md"
                                    >
                                        Disconnect Wallet
                                    </button>
                                </>
                            )}

                            {/* Token Selector */}
                            {isConnected && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Select Token</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setSelectedToken("USDC")}
                                            className={`p-2 rounded-lg border transition-all text-center ${
                                                selectedToken === "USDC"
                                                    ? `${styles.tokenSelected} text-white`
                                                    : "border-gray-600 bg-gray-900 text-gray-400 hover:border-gray-500"
                                            }`}
                                        >
                                            <div className="text-sm font-semibold">USDC</div>
                                            <div className="text-xs text-gray-400">Direct deposit</div>
                                        </button>
                                        <button
                                            onClick={() => setSelectedToken("USDT")}
                                            className={`p-2 rounded-lg border transition-all text-center ${
                                                selectedToken === "USDT"
                                                    ? `${styles.tokenSelected} text-white`
                                                    : "border-gray-600 bg-gray-900 text-gray-400 hover:border-gray-500"
                                            }`}
                                        >
                                            <div className="text-sm font-semibold">USDT</div>
                                            <div className="text-xs text-gray-400">Auto-swaps to USDC</div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {balance !== undefined && balance !== null && (
                                <div className="mb-4 p-3 rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-between">
                                    <span className="text-gray-400 text-sm">Web3 Wallet Balance</span>
                                    <span className="text-white font-semibold">
                                        ${formatUSDCToSimpleDollars(balance)} {selectedToken}
                                    </span>
                                </div>
                            )}

                            {selectedToken === "USDT" && (
                                <div className="mb-4 p-2 rounded-lg bg-blue-900/20 border border-blue-500/30 text-blue-400 text-xs">
                                    USDT will be automatically swapped to USDC via Uniswap on deposit.
                                </div>
                            )}

                            <div className="mb-4">
                                <label htmlFor="usdc-amount" className="block text-sm font-medium text-gray-400 mb-2">
                                    Amount to Deposit ({selectedToken})
                                </label>
                                <div className="relative">
                                    <input
                                        id="usdc-amount"
                                        type="number"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="w-full p-3 pr-16 border border-gray-600 bg-gray-900 text-white rounded-lg focus:border-blue-500 focus:outline-none"
                                        placeholder="0.00"
                                    />
                                    <button
                                        onClick={() => {
                                            if (balance !== undefined && balance !== null && decimals) {
                                                setAmount(formatUSDCToSimpleDollars(balance));
                                            }
                                        }}
                                        className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold transition-colors hover:opacity-80 ${styles.maxButton}`}
                                    >
                                        MAX
                                    </button>
                                </div>
                            </div>

                            {/* Cosmos Address Display */}
                            <div className="mb-4 p-3 rounded-lg bg-gray-900 border border-gray-700">
                                <div className="text-sm text-gray-400">
                                    {cosmosWallet.address ? "b52USDC will be minted to your Block52 address:" : "⚠️ No Block52 wallet found"}
                                </div>
                                <div className="text-xs font-mono text-gray-300 truncate">
                                    {cosmosWallet.address || "Visit /wallet to generate a Block52 wallet first"}
                                </div>
                            </div>

                            {allowed ? (
                                <button
                                    onClick={handleDeposit}
                                    className={`w-full py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-3 ${styles.successGradientButton} ${
                                        +amount === 0 ? "opacity-50 cursor-not-allowed" : ""
                                    }`}
                                    disabled={+amount === 0 || isDepositPending || isPending || isCountingDown}
                                >
                                    {isDepositPending || isPending ? "Depositing..." : "Deposit"}
                                    {(isDepositPending || isPending) && <img src={spinner} className="w-5 h-5" alt="loading" />}
                                </button>
                            ) : (
                                <button
                                    onClick={handleApprove}
                                    className={`w-full py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-3 ${styles.primaryGradientButton} ${
                                        +amount === 0 ? "opacity-50 cursor-not-allowed" : ""
                                    }`}
                                    disabled={+amount === 0 || isApprovePending || isLoading}
                                >
                                    {isLoading || isApprovePending ? "Approving..." : "Approve Deposit"}
                                    {(isLoading || isApprovePending) && <img src={spinner} className="w-5 h-5" alt="loading" />}
                                </button>
                            )}

                            {isCountingDown && (
                                <DepositCountdown
                                    onComplete={() => {
                                        setIsCountingDown(false);
                                        if (onSuccess) onSuccess();
                                    }}
                                />
                            )}
                        </>
                    )}
                </>
            ) : (
                <>
                    {/* Payment Created - Show QR Code and Status */}
                    <PaymentDisplay
                        paymentAddress={paymentData.pay_address}
                        payAmount={paymentData.pay_amount}
                        payCurrency={paymentData.pay_currency}
                        expiresAt={paymentData.expires_at}
                        priceAmount={paymentData.price_amount}
                    />

                    <div className="my-4">
                        <PaymentStatusMonitor paymentId={paymentData.payment_id} onPaymentComplete={handlePaymentComplete} onStatusChange={setPaymentStatus} />
                    </div>

                    {/* New Payment Button - only show when payment is terminal */}
                    {["finished", "failed", "expired", "refunded"].includes(paymentStatus) && (
                        <button
                            onClick={handleNewPayment}
                            className={`w-full py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90 ${styles.primaryGradientButton}`}
                        >
                            Create New Payment
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default DepositCore;
