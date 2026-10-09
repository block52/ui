import React, { useState, useMemo, useCallback } from "react";
import { useMinAndMaxBuyIns } from "../../hooks/game/useMinAndMaxBuyIns";
import { useNavigate } from "react-router-dom";
import { formatUSDCToSimpleDollars } from "../../utils/numberUtils";
import { computeSngEntryBreakdown } from "../../utils/buyInUtils";
import { useVacantSeatData } from "../../hooks/game/useVacantSeatData";
import { Modal } from "../common/Modal";
import { PillButton } from "../ui";
import { ModalFooter } from "./ModalFooter";
import { AmountPresets } from "./AmountPresets";
import { amountInputClass, fieldLabelClass, insetBoxClass, noticeClass } from "./walletFormClasses";
import { joinTable } from "../../hooks/playerActions/joinTable";
import { JoinTableOptions } from "../../hooks/playerActions/types";
import { useCosmosWallet } from "../../hooks";
import { usdcToMicroBigInt, microToUsdc, parseUsdcToMicro } from "../../constants/currency";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useNetwork } from "../../context/NetworkContext";
import { useGameStateContext } from "../../context/GameStateContext";
import { getBlindsForDisplay } from "../../utils/gameFormatUtils";
import { GameFormat } from "@block52/poker-vm-sdk";
import DepositCore from "./DepositCore";
import { isEmpty, hasElements } from "../../utils/guards";
import styles from "./BuyInModal.module.css";

import type { BuyInModalProps } from "./types";

const BuyInModal: React.FC<BuyInModalProps> = React.memo(({ onClose, onJoin, tableId, minBuyIn, maxBuyIn }) => {
    const [buyInError, setBuyInError] = useState("");
    const [waitForBigBlind, setWaitForBigBlind] = useState(true);
    const [isJoiningRandomSeat, setIsJoiningRandomSeat] = useState(false);

    // Get Cosmos wallet hook and network context
    const cosmosWallet = useCosmosWallet();
    const { currentNetwork } = useNetwork();
    const { gameState } = useGameStateContext();

    // Use props if provided, otherwise fall back to hook
    const hookBuyIns = useMinAndMaxBuyIns();
    const minBuyInValue = minBuyIn || hookBuyIns.minBuyIn;
    const maxBuyInValue = maxBuyIn || hookBuyIns.maxBuyIn;

    // Per Commandment 7: NO defaults - if buy-in values missing, show error
    const hasBuyInValues = minBuyInValue !== undefined && maxBuyInValue !== undefined;

    const { emptySeatIndexes, isUserAlreadyPlaying } = useVacantSeatData();
    const navigate = useNavigate();

    // Detect if this is a Sit & Go game (fixed buy-in where min = max)
    const isSitAndGo = useMemo(() => {
        return minBuyInValue === maxBuyInValue;
    }, [minBuyInValue, maxBuyInValue]);

    // Memoize formatted values and calculations
    const {
        minBuyInFormatted,
        maxBuyInFormatted,
        balanceFormatted,
        stakeLabel,
        minBuyInNumber,
        maxBuyInNumber: _maxBuyInNumber,
        bigBlindValue
    } = useMemo(() => {
        // Format USDC microunits (6 decimals) from Cosmos
        const minFormatted = formatUSDCToSimpleDollars(minBuyInValue);
        const maxFormatted = formatUSDCToSimpleDollars(maxBuyInValue);

        // Get USDC balance from cosmosWallet hook (which shows all token balances)
        const usdcBalance = cosmosWallet.balance.find(b => b.denom === "usdc");
        const balance = usdcBalance ? microToUsdc(usdcBalance.amount) : 0;

        // Get blinds for display using utility function
        // Determines format based on isSitAndGo flag (fixed buy-in = tournament-style)
        const format = isSitAndGo ? GameFormat.SIT_AND_GO : GameFormat.CASH;
        const { smallBlind, bigBlind, stakeLabel: stake } = getBlindsForDisplay(
            format,
            gameState?.gameOptions?.smallBlind,
            gameState?.gameOptions?.bigBlind
        );

        return {
            minBuyInFormatted: minFormatted,
            maxBuyInFormatted: maxFormatted,
            balanceFormatted: balance,
            stakeLabel: stake,
            minBuyInNumber: parseFloat(minFormatted),
            maxBuyInNumber: parseFloat(maxFormatted),
            bigBlindValue: bigBlind
        };
    }, [minBuyInValue, maxBuyInValue, cosmosWallet.balance, isSitAndGo, gameState?.gameOptions?.bigBlind, gameState?.gameOptions?.smallBlind]);

    // Protocol-fee breakdown for Sit & Go (poker-vm#2592). The protocol fee is
    // skimmed OUT OF the fixed buy-in (prize-pool portion = buyIn - protocolCut);
    // the owner fee (entryFee) is charged on top. Hidden unless a protocol fee is
    // configured (bps absent/0). Computed in micro-USDC bigint via the shared util.
    const feeBreakdown = useMemo(() => {
        const breakdown = computeSngEntryBreakdown(
            maxBuyInValue,
            gameState?.gameOptions?.entryFee,
            gameState?.gameOptions?.protocolFeeBps
        );

        return {
            show: isSitAndGo && breakdown.hasProtocolFee,
            prizePoolPortionFormatted: formatUSDCToSimpleDollars(breakdown.prizePoolPortion),
            protocolCutFormatted: formatUSDCToSimpleDollars(breakdown.protocolCut),
            ownerFeeFormatted: formatUSDCToSimpleDollars(breakdown.ownerFee),
            totalFormatted: formatUSDCToSimpleDollars(breakdown.total)
        };
    }, [isSitAndGo, maxBuyInValue, gameState?.gameOptions?.entryFee, gameState?.gameOptions?.protocolFeeBps]);

    // Initialize buyInAmount with maxBuyInFormatted
    const [buyInAmount, setBuyInAmount] = useState(() => maxBuyInFormatted);

    // Memoize isDisabled calculation
    const isDisabled = useMemo(() => {
        return balanceFormatted < minBuyInNumber;
    }, [balanceFormatted, minBuyInNumber]);

    // Check if buy-in exceeds balance
    const exceedsBalance = useMemo(() => {
        const buyInValue = parseFloat(buyInAmount) || 0;
        return buyInValue > balanceFormatted;
    }, [buyInAmount, balanceFormatted]);

    // Check if random seat join is available
    const canJoinRandomSeat = useMemo(() => {
        return !isUserAlreadyPlaying && hasElements(emptySeatIndexes) && !isDisabled && !isJoiningRandomSeat && !exceedsBalance;
    }, [isUserAlreadyPlaying, emptySeatIndexes.length, isDisabled, isJoiningRandomSeat, exceedsBalance]);

    const viewTableDisabled = exceedsBalance;
    const takeSeatDisabled = !canJoinRandomSeat || exceedsBalance;

    // When balance is below the minimum buy-in, the modal swaps the
    // buy-in form for the deposit flow inline. balance refreshes after
    // a successful deposit (DepositCore calls refreshBalance), so this
    // flips back automatically once the user has funded enough.
    // block52/ui#378
    const needsDeposit = balanceFormatted < minBuyInNumber;

    // Memoized event handlers
    const handleBuyInChange = useCallback((amount: string) => {
        setBuyInAmount(amount);
        setBuyInError("");
        localStorage.setItem(STORAGE_KEYS.buyInAmount, amount);
    }, []);

    const handleJoinClick = useCallback(() => {
        try {
            // Convert dollar amount to USDC microunits (6 decimals)
            const buyInMicrounits = parseUsdcToMicro(buyInAmount);

            if (buyInMicrounits < BigInt(minBuyInValue!)) {
                setBuyInError(`Minimum buy-in is $${minBuyInFormatted}`);
                return;
            }

            if (buyInMicrounits > BigInt(maxBuyInValue!)) {
                setBuyInError(`Maximum buy-in is $${maxBuyInFormatted}`);
                return;
            }

            if (balanceFormatted < minBuyInNumber) {
                setBuyInError("Your available balance does not reach the minimum buy-in amount for this game. Please deposit to continue.");
                return;
            }

            localStorage.setItem(STORAGE_KEYS.buyInAmount, buyInAmount);
            localStorage.setItem(STORAGE_KEYS.waitForBigBlind, JSON.stringify(waitForBigBlind));

            onJoin(buyInAmount, waitForBigBlind);
        } catch (_error) {
            setBuyInError("Invalid input amount.");
        }
    }, [buyInAmount, minBuyInValue, maxBuyInValue, minBuyInFormatted, maxBuyInFormatted, balanceFormatted, minBuyInNumber, waitForBigBlind, onJoin]);

    const handleRandomSeatJoin = useCallback(async () => {
        try {
            setBuyInError("");
            setIsJoiningRandomSeat(true);

            // Validate buy-in amount first - convert to USDC microunits (6 decimals)
            const buyInMicrounits = parseUsdcToMicro(buyInAmount);

            if (buyInMicrounits < BigInt(minBuyInValue!)) {
                setBuyInError(`Minimum buy-in is ${minBuyInFormatted}`);
                return;
            }

            if (buyInMicrounits > BigInt(maxBuyInValue!)) {
                setBuyInError(`Maximum buy-in is ${maxBuyInFormatted}`);
                return;
            }

            if (balanceFormatted < minBuyInNumber) {
                setBuyInError("Your available balance does not reach the minimum buy-in amount for this game. Please deposit to continue.");
                return;
            }

            // Get a random empty seat
            if (isEmpty(emptySeatIndexes)) {
                setBuyInError("No empty seats available.");
                return;
            }

            const joinOptions: JoinTableOptions = {
                amount: buyInMicrounits.toString(),
                seatNumber: undefined // Let the server handle random seat assignment
            };

            await joinTable(tableId || "default-game-id", joinOptions, currentNetwork);

            // Navigate to table after successful join
            navigate(`/table/${tableId}`);
        } catch (_error) {
            setBuyInError("Failed to join table. Please try again.");
        } finally {
            setIsJoiningRandomSeat(false);
        }
    }, [
        buyInAmount,
        minBuyInValue,
        maxBuyInValue,
        balanceFormatted,
        minBuyInNumber,
        emptySeatIndexes.length,
        navigate,
        tableId,
        minBuyInFormatted,
        maxBuyInFormatted,
        currentNetwork
    ]);

    // Quick-amount stops, derived only from the existing min/max, big blind and
    // balance. Never outside [min, max] and never above the player's balance.
    const presets = useMemo(() => {
        if (isSitAndGo) return [];
        const cap = Math.min(_maxBuyInNumber, Math.floor(balanceFormatted * 100) / 100);
        const candidates = [{ label: "Min", amount: minBuyInNumber }];
        if (bigBlindValue > 0) {
            candidates.push({ label: "50 BB", amount: bigBlindValue * 50 }, { label: "100 BB", amount: bigBlindValue * 100 });
        }
        candidates.push({ label: "Max", amount: cap });
        const seen = new Set<string>();
        // Walk from the end so "Max" / "Min" win over a duplicate "100 BB".
        return candidates
            .filter(c => c.amount >= minBuyInNumber && c.amount <= cap)
            .map(c => ({ label: c.label, value: c.amount.toFixed(2) }))
            .reverse()
            .filter(c => {
                if (seen.has(c.value)) return false;
                seen.add(c.value);
                return true;
            })
            .reverse();
    }, [isSitAndGo, _maxBuyInNumber, balanceFormatted, minBuyInNumber, bigBlindValue]);

    // Why the primary action is unavailable (view only; mirrors the existing disabled flags).
    const disabledReason = useMemo(() => {
        if (isJoiningRandomSeat) return "";
        if (exceedsBalance) return "Buy-in is more than your balance. Lower the amount or deposit.";
        if (isUserAlreadyPlaying) return "You are already seated at this table.";
        if (isEmpty(emptySeatIndexes)) return "No empty seats available.";
        return "";
    }, [isJoiningRandomSeat, exceedsBalance, isUserAlreadyPlaying, emptySeatIndexes.length]);

    const modalSubtitle = `${isSitAndGo ? "Sit & Go" : "Cash game"}${stakeLabel ? ` · ${stakeLabel} blinds` : ""}`;

    // Per Commandment 7: Show error if buy-in values are missing from chain
    if (!hasBuyInValues) {
        return (
            <Modal isOpen onClose={onClose} title="Buy In" widthClass="w-[26rem]">
                <p role="alert" className="m-0 mb-4 text-sm text-red-400">
                    Unable to load buy-in limits from the game. Please try again.
                </p>
                <PillButton variant="outline" size="lg" className="w-full" onClick={onClose}>
                    Close
                </PillButton>
            </Modal>
        );
    }

    const balanceRows = (
        <div className={`${insetBoxClass} divide-y divide-line py-1`} aria-label="Cosmos balances">
            {cosmosWallet.isLoading ? (
                <div className="py-2 text-sm text-ink-muted">Loading balances...</div>
            ) : cosmosWallet.error ? (
                <div className="py-2 text-sm text-red-400">Error loading balances</div>
            ) : !cosmosWallet.address ? (
                <div className="py-2 text-sm text-ink-muted">No wallet connected</div>
            ) : isEmpty(cosmosWallet.balance) ? (
                <div className="py-2 text-sm text-amber-300">No tokens found - You need tokens to play!</div>
            ) : (
                cosmosWallet.balance.map((balance, idx) => {
                    // Format balance with proper decimals (6 for micro-denominated tokens)
                    const isMicroDenom = balance.denom === "b52Token" || balance.denom === "usdc";
                    const numericAmount = isMicroDenom ? microToUsdc(balance.amount) : Number(balance.amount);

                    const displayAmount = numericAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6
                    });

                    // For usdc, show USD equivalent
                    const isUSDC = balance.denom === "usdc";
                    const usdValue = isUSDC
                        ? numericAmount.toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                          })
                        : null;

                    // Show red when the buy-in exceeds the USDC balance
                    const shouldShowRed = isUSDC && exceedsBalance;

                    return (
                        <div
                            key={idx}
                            className="flex items-center justify-between gap-3 py-2"
                            title={`${Number(balance.amount).toLocaleString("en-US")} micro-units`}
                        >
                            <span className="text-sm text-ink-muted">{balance.denom} balance</span>
                            <span className="text-right">
                                <span className={`text-sm font-semibold tabular-nums ${shouldShowRed ? "text-red-400" : "text-ink"}`}>{displayAmount}</span>
                                {usdValue && (
                                    <span className={`block text-xs tabular-nums ${shouldShowRed ? "text-red-400" : "text-ink-muted"}`}>≈ {usdValue}</span>
                                )}
                            </span>
                        </div>
                    );
                })
            )}
        </div>
    );

    const factRow = (label: string, value: string) => (
        <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm text-ink-muted">{label}</span>
            <span className="text-sm font-semibold tabular-nums text-ink">{value}</span>
        </div>
    );

    return (
        <Modal isOpen onClose={onClose} title={isSitAndGo ? "Sit & Go Buy-In" : "Cash Game Buy-In"} subtitle={modalSubtitle} isProcessing={isJoiningRandomSeat} widthClass="w-[26rem]">
            <div className="space-y-5">
                {/* Cosmos wallet balances */}
                {balanceRows}

                {needsDeposit ? (
                    /* Inline deposit flow when balance is below minimum buy-in.
                       DepositCore refreshes the wallet on success, which causes
                       `needsDeposit` to flip false and the buy-in form to
                       replace this block automatically. block52/ui#378 */
                    <div className="space-y-4">
                        <div className={noticeClass.warning}>You need at least ${minBuyInFormatted} to join this table. Deposit to continue.</div>
                        <DepositCore showMethodSelector />
                        <PillButton variant="ghost" size="lg" className="w-full" onClick={onClose}>
                            Cancel
                        </PillButton>
                    </div>
                ) : (
                    <>
                        {/* Table facts */}
                        <div className={`${insetBoxClass} divide-y divide-line py-1`}>
                            {factRow("Stakes", stakeLabel)}
                            {factRow(isSitAndGo ? "Buy-in" : "Min buy-in", `$${minBuyInFormatted}`)}
                            {!isSitAndGo && factRow("Max buy-in", `$${maxBuyInFormatted}`)}
                        </div>

                        {/* Buy-In Amount Selection */}
                        <div>
                            {isSitAndGo ? (
                                // Sit & Go: Show fixed buy-in amount (non-editable)
                                <>
                                    <span className={fieldLabelClass}>Fixed Buy-In (Sit & Go)</span>
                                    <div className="px-4 py-4 rounded-xl border border-brand/40 bg-brand/10 text-center">
                                        <div className="text-xs text-ink-muted mb-1">Required Buy-In</div>
                                        <div className="text-3xl font-semibold tabular-nums text-ink">${maxBuyInFormatted}</div>
                                        <div className="text-xs text-ink-muted mt-1">This is a fixed buy-in tournament</div>
                                    </div>

                                    {/* Protocol-fee breakdown (poker-vm#2592). The protocol fee comes
                                        OUT OF the buy-in, so prize pool = buyIn - protocolCut, and the
                                        total entry = buyIn + owner fee. Hidden when no protocol fee. */}
                                    {feeBreakdown.show && (
                                        <div className={`${insetBoxClass} mt-3 divide-y divide-line py-1`} data-testid="sng-fee-breakdown">
                                            <div className="flex justify-between py-2 text-sm">
                                                <span className="text-ink-muted">Buy-in (to prize pool)</span>
                                                <span className="text-ink font-medium tabular-nums">${feeBreakdown.prizePoolPortionFormatted}</span>
                                            </div>
                                            <div className="flex justify-between py-2 text-sm">
                                                <span className="text-ink-muted">Protocol fee</span>
                                                <span className="text-brand-light font-medium tabular-nums">${feeBreakdown.protocolCutFormatted}</span>
                                            </div>
                                            <div className="flex justify-between py-2 text-sm">
                                                <span className="text-ink-muted">Owner fee</span>
                                                <span className="text-ink font-medium tabular-nums">${feeBreakdown.ownerFeeFormatted}</span>
                                            </div>
                                            <div className="flex justify-between py-2 text-sm">
                                                <span className="text-ink-soft font-semibold">Total</span>
                                                <span className="text-emerald-400 font-semibold tabular-nums">${feeBreakdown.totalFormatted}</span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                // Cash Game: Allow user to choose buy-in amount with slider
                                <>
                                    <label htmlFor="buyin-amount" className={fieldLabelClass}>
                                        Buy-In Amount
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-ink-muted pointer-events-none" aria-hidden="true">
                                            $
                                        </span>
                                        <input
                                            id="buyin-amount"
                                            type="number"
                                            inputMode="decimal"
                                            autoFocus
                                            value={buyInAmount}
                                            onChange={e => handleBuyInChange(e.target.value)}
                                            placeholder="Enter amount"
                                            className={`${amountInputClass} pl-9 ${buyInError || exceedsBalance ? "border-red-500/60" : ""}`}
                                            step={bigBlindValue.toString()}
                                            min={minBuyInNumber.toString()}
                                            max={_maxBuyInNumber.toString()}
                                            aria-invalid={Boolean(buyInError) || exceedsBalance}
                                            aria-describedby="buyin-help"
                                        />
                                    </div>

                                    {/* Slider with min/max labels */}
                                    <div className="mt-2">
                                        <input
                                            type="range"
                                            aria-label="Buy-in amount slider"
                                            value={Math.min(Math.max(parseFloat(buyInAmount) || 0, minBuyInNumber), _maxBuyInNumber)}
                                            onChange={e => {
                                                const val = parseFloat(e.target.value);
                                                if (!isNaN(val)) {
                                                    // Round to nearest step to align with bigBlindValue increments
                                                    const steppedValue = Math.round(val / bigBlindValue) * bigBlindValue;
                                                    handleBuyInChange(Math.max(minBuyInNumber, Math.min(steppedValue, _maxBuyInNumber)).toFixed(2));
                                                }
                                            }}
                                            min={minBuyInNumber.toString()}
                                            max={_maxBuyInNumber.toString()}
                                            step={bigBlindValue.toString()}
                                            className={`block w-full h-11 ${styles.buyInSlider}`}
                                        />
                                        <div className="flex justify-between text-xs tabular-nums text-ink-muted">
                                            <span>${minBuyInFormatted}</span>
                                            <span>${maxBuyInFormatted}</span>
                                        </div>
                                    </div>

                                    {hasElements(presets) && (
                                        <div className="mt-3">
                                            <AmountPresets presets={presets} current={buyInAmount} onPick={handleBuyInChange} />
                                        </div>
                                    )}
                                </>
                            )}
                            <p id="buyin-help" role={buyInError ? "alert" : undefined} className={`m-0 mt-2 text-xs ${buyInError || exceedsBalance ? "text-red-400" : "text-ink-muted"}`}>
                                {buyInError || (exceedsBalance ? "Buy-in is more than your balance." : isSitAndGo ? "" : `Between $${minBuyInFormatted} and $${maxBuyInFormatted}.`)}
                            </p>
                        </div>

                        {/* Wait for Big Blind */}
                        <label htmlFor="buyin-wait-bb" className="flex items-center gap-3 min-h-11 cursor-pointer select-none">
                            <input
                                id="buyin-wait-bb"
                                type="checkbox"
                                className="w-5 h-5 rounded accent-brand cursor-pointer"
                                checked={waitForBigBlind}
                                onChange={() => setWaitForBigBlind(!waitForBigBlind)}
                            />
                            <span className="text-sm text-ink-soft">Wait for Big Blind</span>
                        </label>
                    </>
                )}

                <div className={noticeClass.warning}>
                    <strong>Please Note:</strong> This table has no all-in protection.
                </div>
            </div>

            {!needsDeposit && (
                <ModalFooter>
                    {disabledReason && (
                        <p className="m-0 text-xs text-center text-ink-muted" role="status">
                            {disabledReason}
                        </p>
                    )}
                    <PillButton size="lg" className="w-full h-12" onClick={handleRandomSeatJoin} disabled={takeSeatDisabled}>
                        {isJoiningRandomSeat ? "Joining..." : "Take My Seat"}
                    </PillButton>
                    <PillButton variant="outline" size="lg" className="w-full" onClick={handleJoinClick} disabled={viewTableDisabled}>
                        View Table
                    </PillButton>
                    <PillButton variant="ghost" size="lg" className="w-full" onClick={onClose}>
                        Cancel
                    </PillButton>
                </ModalFooter>
            )}
        </Modal>
    );
});

export default BuyInModal;
