import { useState, useEffect, useCallback } from "react";
import { hasValue } from "../../utils/guards";
import * as React from "react";
import useUserWalletConnect from "../../hooks/wallet/useUserWalletConnect";
import useDepositUSDC from "../../hooks/wallet/useDepositUSDC";
import useAllowance from "../../hooks/wallet/useAllowance";
import useDecimal from "../../hooks/wallet/useDecimals";
import useApprove from "../../hooks/wallet/useApprove";
import spinner from "../../assets/spinning-circles.svg";
import useWalletBalance from "../../hooks/wallet/useWalletBalance";
import { toast } from "react-toastify";
import { COSMOS_BRIDGE_ADDRESS } from "../../config/constants";
import { maxUint256 } from "viem";
import { getTokenAddress } from "../../utils/tokenUtils";
import type { DepositToken } from "../../utils/tokenUtils";
import { useCosmosWallet } from "../../hooks";
import { formatUSDCToSimpleDollars, convertAmountToBigInt } from "../../utils/numberUtils";
import CurrencySelector from "./CryptoPayment/CurrencySelector";
import { DEFAULT_DEPOSIT_CURRENCY } from "../../config/depositCurrencies";
import PaymentDisplay from "./CryptoPayment/PaymentDisplay";
import PaymentStatusMonitor from "./CryptoPayment/PaymentStatusMonitor";
import { useProfileAvatar } from "../../context/profile/ProfileAvatarContext";
import { PillButton, SegmentedControl } from "../ui";
import { ModalFooter } from "./ModalFooter";
import { AmountPresets } from "./AmountPresets";
import { amountInputClass, fieldLabelClass, inlinePillClass, insetBoxClass, noticeClass, optionCardClass } from "./walletFormClasses";
import { DepositCountdown } from "../common";

type DepositMethod = "crypto" | "usdc";

import type { PaymentData } from "../../types/payment";
import type { DepositCoreProps } from "./types";
import { usePaymentApi } from "../../context/PaymentApiContext";

const AMOUNT_PRESETS = [
    { label: "$10", value: "10" },
    { label: "$25", value: "25" },
    { label: "$50", value: "50" },
    { label: "$100", value: "100" }
] as const;

const METHOD_OPTIONS = [
    { value: "crypto", label: "Pay with crypto" },
    { value: "usdc", label: "Web3 wallet" }
] as const;

const METHOD_NOTES: Record<DepositMethod, string> = {
    crypto: "BTC, ETH, USDT or USDC (fees apply)",
    usdc: "USDC or USDT (ERC20)"
};

const DepositCore: React.FC<DepositCoreProps & { onCancel?: () => void }> = ({ onSuccess, onCancel, showMethodSelector = true }) => {
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
    const [selectedCurrency, setSelectedCurrency] = useState<string>(DEFAULT_DEPOSIT_CURRENCY);
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

    const isDepositing = isDepositPending || isPending;
    const isApproving = isLoading || isApprovePending;


    const numberInputClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
    const cryptoBelowMin = +amount > 0 && +amount < 10;
    const isPaymentTerminal = ["finished", "failed", "expired", "refunded"].includes(paymentStatus);

    const cancelButton = onCancel ? (
        <PillButton variant="ghost" size="lg" onClick={onCancel} className="w-full">
            Cancel
        </PillButton>
    ) : null;

    return (
        <div className="flex flex-col gap-4">
            {!paymentData ? (
                <>
                    {/* Deposit Method Selector */}
                    {showMethodSelector && (
                        <div>
                            <SegmentedControl options={METHOD_OPTIONS} value={depositMethod} onChange={setDepositMethod} ariaLabel="Deposit method" fullWidth />
                            <p className="text-xs text-ink-muted mt-2">{METHOD_NOTES[depositMethod]}</p>
                        </div>
                    )}

                    {depositMethod === "crypto" ? (
                        <>
                            {/* Crypto Payment Flow */}
                            <CurrencySelector selectedCurrency={selectedCurrency} onCurrencySelect={setSelectedCurrency} />

                            {/* Amount Input */}
                            <div>
                                <label htmlFor="amount" className={fieldLabelClass}>
                                    Amount (USD)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-ink-muted pointer-events-none" aria-hidden="true">
                                        $
                                    </span>
                                    <input
                                        id="amount"
                                        type="number"
                                        inputMode="decimal"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        onFocus={e => e.target.select()}
                                        className={`${amountInputClass} pl-9 pr-16 ${numberInputClass}`}
                                        placeholder="0.00"
                                        min="10"
                                        autoFocus
                                        aria-describedby="amount-help"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-muted pointer-events-none">USD</span>
                                </div>
                                <div className="mt-3">
                                    <AmountPresets presets={AMOUNT_PRESETS} current={amount} onPick={setAmount} />
                                </div>
                                <p id="amount-help" className={`text-xs mt-2 ${cryptoBelowMin ? "text-red-400" : "text-ink-muted"}`}>
                                    Minimum: $10 USD
                                </p>
                                {+amount >= 10 && (
                                    <div className={`mt-3 flex items-center justify-between gap-3 ${insetBoxClass}`}>
                                        <span className="text-xs uppercase tracking-[0.08em] text-ink-muted">You receive</span>
                                        <span className="font-semibold tabular-nums text-emerald-400">${(+amount).toFixed(2)} USDC</span>
                                    </div>
                                )}
                            </div>

                            {/* Fee Notice */}
                            <div className={noticeClass.warning}>
                                This method uses a third-party payment processor. A processing fee applies and will be shown before you confirm.
                            </div>

                            {/* Info Box */}
                            <details className="group rounded-xl border border-line bg-surface-raised">
                                <summary className="flex items-center justify-between min-h-11 px-4 cursor-pointer list-none text-sm font-medium text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
                                    How crypto deposits work
                                    <svg className="w-4 h-4 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" />
                                    </svg>
                                </summary>
                                <ol className="list-decimal list-inside space-y-1 px-4 pb-3 text-xs leading-relaxed text-ink-soft">
                                    <li>Select your cryptocurrency</li>
                                    <li>Enter USD amount to deposit</li>
                                    <li>Send crypto to the payment address</li>
                                    <li>Funds auto-convert to USDC and appear in your wallet</li>
                                </ol>
                            </details>

                            {/* Deposit Button */}
                            <ModalFooter>
                                <PillButton size="lg" className="w-full" onClick={handleCreateCryptoPayment} disabled={+amount < 10 || creatingPayment}>
                                    {creatingPayment ? "Processing..." : "Deposit Now"}
                                    {creatingPayment && <img src={spinner} className="w-5 h-5" alt="loading" />}
                                </PillButton>
                                {cancelButton}
                            </ModalFooter>
                        </>
                    ) : (
                        <>
                            {/* USDC Direct Deposit Flow */}
                            {address && (
                                <div className={`flex items-center gap-3 ${insetBoxClass}`}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs uppercase tracking-[0.08em] text-ink-muted mb-1">Connected address</p>
                                        <p className="text-ink font-mono text-sm break-all">{address}</p>
                                    </div>
                                    <PillButton variant="outline" size="sm" onClick={disconnect} className="shrink-0 hover:!bg-red-500/10 hover:!text-red-400 hover:!border-red-500/40">
                                        Disconnect
                                    </PillButton>
                                </div>
                            )}

                            {/* Token Selector */}
                            {isConnected && (
                                <div>
                                    <span className={fieldLabelClass}>Token</span>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button type="button" aria-pressed={selectedToken === "USDC"} onClick={() => setSelectedToken("USDC")} className={optionCardClass(selectedToken === "USDC")}>
                                            <div className="text-sm font-semibold text-ink">USDC</div>
                                            <div className="text-xs text-ink-muted">Direct deposit</div>
                                        </button>
                                        <button type="button" aria-pressed={selectedToken === "USDT"} onClick={() => setSelectedToken("USDT")} className={optionCardClass(selectedToken === "USDT")}>
                                            <div className="text-sm font-semibold text-ink">USDT</div>
                                            <div className="text-xs text-ink-muted">Auto-swaps to USDC</div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedToken === "USDT" && <div className={noticeClass.info}>USDT will be automatically swapped to USDC via Uniswap on deposit.</div>}

                            <div>
                                <div className="flex items-baseline justify-between gap-3 mb-2">
                                    <label htmlFor="usdc-amount" className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
                                        Amount to deposit ({selectedToken})
                                    </label>
                                    {hasValue(balance) && (
                                        <span className="text-xs text-ink-muted tabular-nums">
                                            Available ${formatUSDCToSimpleDollars(balance)} {selectedToken}
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-ink-muted pointer-events-none" aria-hidden="true">
                                        $
                                    </span>
                                    <input
                                        id="usdc-amount"
                                        type="number"
                                        inputMode="decimal"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        onFocus={e => e.target.select()}
                                        className={`${amountInputClass} pl-9 pr-28 ${numberInputClass}`}
                                        placeholder="0.00"
                                        aria-describedby="usdc-amount-help"
                                    />
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        <span className="text-sm font-medium text-ink-muted pointer-events-none">{selectedToken}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (hasValue(balance) && decimals) {
                                                    setAmount(formatUSDCToSimpleDollars(balance));
                                                }
                                            }}
                                            className={inlinePillClass}
                                        >
                                            MAX
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <AmountPresets presets={AMOUNT_PRESETS} current={amount} onPick={setAmount} />
                                </div>
                                {isConnected && +amount === 0 && (
                                    <p id="usdc-amount-help" className="text-xs mt-2 text-ink-muted">
                                        Enter an amount to continue.
                                    </p>
                                )}
                            </div>

                            {/* Cosmos Address Display */}
                            <div className={cosmosWallet.address ? insetBoxClass : noticeClass.warning}>
                                <div className={cosmosWallet.address ? "text-xs uppercase tracking-[0.08em] text-ink-muted mb-1" : "font-semibold mb-1"}>
                                    {cosmosWallet.address ? "b52USDC will be minted to your Block52 address" : "No Block52 wallet found"}
                                </div>
                                <div className={`text-xs font-mono truncate ${cosmosWallet.address ? "text-ink-soft" : ""}`}>
                                    {cosmosWallet.address || "Visit /wallet to generate a Block52 wallet first"}
                                </div>
                            </div>

                            {isCountingDown && (
                                <DepositCountdown
                                    onComplete={() => {
                                        setIsCountingDown(false);
                                        if (onSuccess) onSuccess();
                                    }}
                                />
                            )}

                            <ModalFooter>
                                {!isConnected ? (
                                    <PillButton size="lg" className="w-full" onClick={open}>
                                        Connect Your Web3 Wallet
                                    </PillButton>
                                ) : allowed ? (
                                    <PillButton
                                        size="lg"
                                        className="w-full"
                                        onClick={handleDeposit}
                                        disabled={+amount === 0 || isDepositPending || isPending || isCountingDown}
                                    >
                                        {isDepositing ? "Depositing..." : "Deposit"}
                                        {isDepositing && <img src={spinner} className="w-5 h-5" alt="loading" />}
                                    </PillButton>
                                ) : (
                                    <PillButton size="lg" className="w-full" onClick={handleApprove} disabled={+amount === 0 || isApprovePending || isLoading}>
                                        {isApproving ? "Approving..." : "Approve Deposit"}
                                        {isApproving && <img src={spinner} className="w-5 h-5" alt="loading" />}
                                    </PillButton>
                                )}
                                {cancelButton}
                            </ModalFooter>
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

                    <PaymentStatusMonitor paymentId={paymentData.payment_id} onPaymentComplete={handlePaymentComplete} onStatusChange={setPaymentStatus} />

                    <ModalFooter>
                        {/* New Payment Button - only show when payment is terminal */}
                        {isPaymentTerminal && (
                            <PillButton size="lg" className="w-full" onClick={handleNewPayment}>
                                Create New Payment
                            </PillButton>
                        )}
                        {cancelButton}
                    </ModalFooter>
                </>
            )}
        </div>
    );
};

export default DepositCore;
