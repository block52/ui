/**
 * VacantPlayer Component
 *
 * Represents an empty seat at the poker table.
 *
 * Behavior:
 * - For users not yet seated: clicking opens the buy-in modal to join
 * - For users already seated: vacant seats are non-interactive (just visual)
 *
 * Props:
 * - left/top: Position on the table
 * - index: Seat number
 */

import * as React from "react";
import { memo, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import PokerProfile from "../../../assets/PokerProfile.svg";

import { useVacantSeatData } from "../../../hooks/game/useVacantSeatData";
import type { VacantPlayerProps } from "../../../types/index";
import { useDealerPosition } from "../../../hooks/game/useDealerPosition";
import { joinTable } from "../../../hooks/playerActions/joinTable";
import { useGameOptions } from "../../../hooks/game/useGameOptions";
import CustomDealer from "../../../assets/CustomDealer.svg";
import { formatDollars, formatUSDCToSimpleDollars, parseDollars } from "../../../utils/numberUtils";
import { useCosmosWallet } from "../../../hooks";
import { formatMicroAsUsdc, microToUsdc, parseMicroToBigInt } from "../../../constants/currency";
import { buildBuyInPresets } from "../../../utils/buyInPresets";
import { hasElements } from "../../../utils/guards";
import { useNetwork } from "../../../context/NetworkContext";
import styles from "./VacantPlayer.module.css";
import { USDCDepositModal } from "../../modals";
import { ModalFooter } from "../../modals/ModalFooter";
import { AmountPresets } from "../../modals/AmountPresets";
import { amountInputClass, fieldLabelClass, insetBoxClass, noticeClass } from "../../modals/walletFormClasses";
import { Modal } from "../../common/Modal";
import { PillButton } from "../../ui";
import { getBlindsForDisplay } from "../../../utils/gameFormatUtils";
import { GameFormat } from "@block52/poker-vm-sdk";

const VacantPlayer: React.FC<VacantPlayerProps & { uiPosition?: number }> = memo(
    ({ left, top, index, onJoin, uiPosition }) => {
        const { isUserAlreadyPlaying, canJoinSeat: checkCanJoinSeat } = useVacantSeatData();
        const { id: tableId } = useParams<{ id: string }>();
        const { gameOptions } = useGameOptions();
        const cosmosWallet = useCosmosWallet();
        const { currentNetwork } = useNetwork();

        const [showBuyInModal, setShowBuyInModal] = useState(false);
        const [isJoining, setIsJoining] = useState(false);
        const [joinError, setJoinError] = useState<string | null>(null);
        const [joinSuccess, setJoinSuccess] = useState(false);
        const [, setJoinResponse] = useState<any>(null);
        const [buyInAmount, setBuyInAmount] = useState<string>("");
        const [buyInAmountDisplay, setBuyInAmountDisplay] = useState<string>("");
        const { dealerSeat } = useDealerPosition();
        // USDC Deposit Modal
        const [showUSDCDepositModal, setShowUSDCDepositModal] = useState(false);

        // Check if this seat is the dealer
        const isDealer = dealerSeat === index;

        // Memoize seat status checks
        const canJoinThisSeat = useMemo(() => checkCanJoinSeat(index), [checkCanJoinSeat, index]);

        // Memoize handlers
        const handleJoinClick = useCallback(() => {
            if (!canJoinThisSeat) return;

            // Initialize buy-in amount with maxBuyIn for Cash games
            const maxBuyInDollars = formatUSDCToSimpleDollars(gameOptions?.maxBuyIn);
            // Get user's USDC balance to determine default buy-in (use lesser of maxBuyIn or user's balance)
            const usdcBalance = cosmosWallet.balance.find(b => b.denom === "usdc");
            let defaultBuyIn = maxBuyInDollars;
            if (usdcBalance) {
                const usdcAmount = microToUsdc(usdcBalance.amount);
                defaultBuyIn = Math.min(parseFloat(maxBuyInDollars), usdcAmount).toString();
            }
            setBuyInAmount(defaultBuyIn);
            setBuyInAmountDisplay(formatDollars(parseFloat(defaultBuyIn)));
            // Open buy-in modal directly (skip confirmation modal)
            setShowBuyInModal(true);
            setJoinError(null);
            setJoinSuccess(false);
            setJoinResponse(null);
        }, [canJoinThisSeat, gameOptions?.maxBuyIn, cosmosWallet.balance]);

        const handleSeatClick = useCallback(() => {
            if (!isUserAlreadyPlaying && canJoinThisSeat) {
                handleJoinClick();
                return;
            }
            // Say why the click did nothing rather than failing silently.
            console.error(
                `[VacantPlayer] seat ${index} click ignored:`,
                isUserAlreadyPlaying
                    ? "this wallet is already seated at the table"
                    : gameOptions?.maxPlayers === undefined
                      ? "game state not loaded yet (no gameOptions — stale/pre-fix table or WS not connected)"
                      : "seat not joinable (taken or not in availableSeats)"
            );
        }, [isUserAlreadyPlaying, canJoinThisSeat, handleJoinClick, index, gameOptions?.maxPlayers]);

        // Detect if this is Sit & Go (fixed buy-in) or Cash game (variable buy-in)
        const isSitAndGo = useMemo(() => {
            return gameOptions?.minBuyIn === gameOptions?.maxBuyIn;
        }, [gameOptions?.minBuyIn, gameOptions?.maxBuyIn]);

        // Memoize min/max buy-in values for slider and big blind (per Commandment 7: NO fallbacks)
        const { minBuyInNum, maxBuyInNum, bigBlindValue } = useMemo(() => {
            return {
                minBuyInNum: parseFloat(formatUSDCToSimpleDollars(gameOptions?.minBuyIn)),
                maxBuyInNum: parseFloat(formatUSDCToSimpleDollars(gameOptions?.maxBuyIn)),
                bigBlindValue: parseFloat(formatUSDCToSimpleDollars(gameOptions?.bigBlind))
            };
        }, [gameOptions?.minBuyIn, gameOptions?.maxBuyIn, gameOptions?.bigBlind]);

        // Memoize slider value to avoid inline function recreation
        const sliderValue = useMemo(() => {
            const val = parseFloat(buyInAmount);
            return isNaN(val) ? minBuyInNum : val;
        }, [buyInAmount, minBuyInNum]);

        // A join escrows from the on-chain USDC balance, so an unfunded player must not be able to attempt a buy-in.
        const exceedsBalance = useMemo(() => {
            const buyInValue = parseFloat(buyInAmount) || 0;
            const usdcBalance = cosmosWallet.balance.find(b => b.denom === "usdc");
            if (!usdcBalance) return true; // If user has no USDC balance, treat as exceeding balance
            const usdcAmount = microToUsdc(usdcBalance.amount);
            if (usdcAmount < minBuyInNum) return true; // If user balance is less than minimum buy-in, always show as exceeding balance
            return buyInValue > usdcAmount;
        }, [buyInAmount, cosmosWallet.balance, minBuyInNum]);

        // Handle buy-in confirmation and join
        const handleBuyInConfirm = useCallback(async () => {
            if (!tableId) {
                setJoinError("Missing table ID");
                return;
            }

            // For Sit & Go: use minBuyIn (fixed amount)
            // For Cash Game: use user-selected buyInAmount
            let buyInDollars: string;

            if (isSitAndGo) {
                // Sit & Go: Fixed buy-in
                const buyInMicrounits = gameOptions?.minBuyIn || gameOptions?.maxBuyIn;
                if (!buyInMicrounits) {
                    setJoinError("Unable to determine buy-in amount");
                    return;
                }
                buyInDollars = formatUSDCToSimpleDollars(buyInMicrounits);
            } else {
                // Cash Game: User-selected amount
                buyInDollars = buyInAmount;

                // Validate buy-in range
                const minBuyInDollars = parseFloat(formatUSDCToSimpleDollars(gameOptions?.minBuyIn));
                const maxBuyInDollars = parseFloat(formatUSDCToSimpleDollars(gameOptions?.maxBuyIn));
                const buyInValue = parseFloat(buyInDollars);

                if (buyInValue < minBuyInDollars) {
                    setJoinError(`Buy-in must be at least $${formatDollars(minBuyInDollars)}`);
                    return;
                }
                if (buyInValue > maxBuyInDollars) {
                    setJoinError(`Buy-in cannot exceed $${formatDollars(maxBuyInDollars)}`);
                    return;
                }
            }

            setIsJoining(true);
            setJoinError(null);
            setJoinSuccess(false);

            try {
                // joinTable expects amount in USDC dollar format (e.g., "5.00")
                // The hook will convert it to microunits internally
                const response = await joinTable(
                    tableId,
                    {
                        amount: buyInDollars,
                        seatNumber: index
                    },
                    currentNetwork
                );

                setJoinResponse(response);
                setJoinSuccess(true);
                setShowBuyInModal(false);
                setIsJoining(false);

                // The "YOUR SEAT" banner now fires from the derived `playerJoined`
                // bus event (useSeatJoinNotification), which arrives on the commit
                // that seats the player — no imperative trigger or mount-delay hack.

                // Call onJoin after successful join
                if (onJoin) {
                    onJoin();
                }
            } catch (err) {
                console.error("Failed to join table:", err);
                setJoinError(err instanceof Error ? err.message : "Unknown error joining table");
                setIsJoining(false);
            }
        }, [tableId, index, onJoin, gameOptions?.minBuyIn, gameOptions?.maxBuyIn, buyInAmount, isSitAndGo, currentNetwork]);

        // Memoize container styles
        const containerStyle = useMemo(
            () => ({
                left,
                top
            }),
            [left, top]
        );

        // Memoize seat text
        const seatText = useMemo(
            () => ({
                title: isUserAlreadyPlaying ? "Vacant Seat" : `Seat ${index}`,
                subtitle: !isUserAlreadyPlaying ? (canJoinThisSeat ? "Click to Join" : "Seat Taken") : null
            }),
            [isUserAlreadyPlaying, canJoinThisSeat, index]
        );

        const closeBuyInModal = useCallback(() => setShowBuyInModal(false), []);

        const modalSubtitle = useMemo(() => {
            const { stakeLabel } = getBlindsForDisplay(isSitAndGo ? GameFormat.SIT_AND_GO : GameFormat.CASH, gameOptions?.smallBlind, gameOptions?.bigBlind);
            return `${isSitAndGo ? "Sit & Go" : "Cash game"}${stakeLabel ? ` · ${stakeLabel} blinds` : ""}`;
        }, [isSitAndGo, gameOptions?.smallBlind, gameOptions?.bigBlind]);

        const presets = useMemo(() => {
            if (isSitAndGo) return [];
            const usdcBalance = cosmosWallet.balance.find(b => b.denom === "usdc");
            return buildBuyInPresets({
                minMicro: parseMicroToBigInt(gameOptions?.minBuyIn),
                maxMicro: parseMicroToBigInt(gameOptions?.maxBuyIn),
                bigBlindMicro: parseMicroToBigInt(gameOptions?.bigBlind),
                balanceMicro: parseMicroToBigInt(usdcBalance?.amount)
            }).map(p => ({ label: p.label, value: formatMicroAsUsdc(p.micro) }));
        }, [isSitAndGo, cosmosWallet.balance, gameOptions?.minBuyIn, gameOptions?.maxBuyIn, gameOptions?.bigBlind]);

        const pickPreset = useCallback((value: string) => {
            setBuyInAmount(value);
            setBuyInAmountDisplay(value);
        }, []);

        // Memoized Deposit callback - always open modal; crypto payments don't need Web3 wallet
        const handleDepositClick = useCallback(() => {
            setShowBuyInModal(false); // Ensure buy-in modal is closed
            setShowUSDCDepositModal(true);
        }, []);
        return (
            <>
                <div className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2" style={containerStyle} onClick={handleSeatClick}>
                    {/* Development Mode Debug Info */}
                    {import.meta.env.VITE_NODE_ENV === "development" && (
                        <div className="absolute top-[-50px] left-1/2 transform -translate-x-1/2 bg-gray-600 bg-opacity-80 text-white px-2 py-1 rounded text-[10px] whitespace-nowrap z-50 border border-gray-400">
                            <div className="text-gray-300">UI Pos: {uiPosition ?? "N/A"}</div>
                            <div className="text-yellow-300">Vacant Seat: {index}</div>
                            <div className="text-gray-300">
                                XY: {left}, {top}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-center mb-2">
                        <img src={PokerProfile} className="w-12 h-12" alt="Vacant Seat" />
                    </div>
                    <div className={`text-center ${styles.seatText}`}>
                        <div className="text-lg sm:text-sm mb-1 whitespace-nowrap font-medium">{seatText.title}</div>
                        {seatText.subtitle && <div className="text-base sm:text-xs whitespace-nowrap">{seatText.subtitle}</div>}
                    </div>

                </div>

                {/* Buy-in modal - using portal to render at document body */}
                {showBuyInModal &&
                    gameOptions &&
                    createPortal(
                        <Modal
                            isOpen
                            onClose={closeBuyInModal}
                            title={isSitAndGo ? "Sit & Go Buy-In" : "Cash Game Buy-In"}
                            subtitle={modalSubtitle}
                            isProcessing={isJoining}
                            widthClass="w-[26rem]"
                        >
                            <div className="space-y-4">
                                {/* Buy-In Amount - Fixed for Sit & Go, Input for Cash Game */}
                                {isSitAndGo ? (
                                    // Sit & Go: Fixed buy-in amount
                                    <div className="px-4 py-4 rounded-xl border border-brand/40 bg-brand/10 text-center">
                                        <div className="text-xs text-ink-muted mb-1">Required Buy-In</div>
                                        <div className="text-3xl font-semibold tabular-nums text-ink">${formatUSDCToSimpleDollars(gameOptions.minBuyIn)}</div>
                                        <div className="text-xs text-ink-muted mt-1">Fixed amount for this tournament</div>
                                    </div>
                                ) : (
                                    // Cash Game: Editable buy-in amount
                                    <div>
                                        <label htmlFor="vacant-buyin-amount" className={fieldLabelClass}>
                                            Buy-In Amount
                                        </label>
                                        <div className="relative">
                                            <span
                                                className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-ink-muted pointer-events-none"
                                                aria-hidden="true"
                                            >
                                                $
                                            </span>
                                            <input
                                                id="vacant-buyin-amount"
                                                type="number"
                                                inputMode="decimal"
                                                autoFocus
                                                value={parseFloat(buyInAmountDisplay) ? buyInAmountDisplay : "0"}
                                                onChange={e => {
                                                    setBuyInAmount(e.target.value);
                                                    setBuyInAmountDisplay(e.target.value);
                                                }}
                                                placeholder="Enter amount"
                                                className={`${amountInputClass} pl-9 ${joinError || exceedsBalance ? "border-red-500/60" : ""}`}
                                                step={bigBlindValue.toString()}
                                                min={minBuyInNum.toString()}
                                                max={maxBuyInNum.toString()}
                                                aria-invalid={Boolean(joinError) || exceedsBalance}
                                            />
                                        </div>

                                        {/* Slider with min/max labels */}
                                        <div className="mt-2">
                                            <input
                                                type="range"
                                                aria-label="Buy-in amount slider"
                                                value={sliderValue}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value);
                                                    if (!isNaN(val)) {
                                                        // Round to nearest step to align with bigBlindValue increments
                                                        const steppedValue = Math.round(val / bigBlindValue) * bigBlindValue;
                                                        setBuyInAmount(formatDollars(Math.max(minBuyInNum, Math.min(steppedValue, maxBuyInNum))));
                                                        setBuyInAmountDisplay(formatDollars(Math.max(minBuyInNum, Math.min(steppedValue, maxBuyInNum))));
                                                    }
                                                }}
                                                min={minBuyInNum.toString()}
                                                max={maxBuyInNum.toString()}
                                                step={bigBlindValue.toString()}
                                                className={`block w-full h-11 ${styles.buyInSlider}`}
                                            />
                                            <div className="flex justify-between text-xs tabular-nums text-ink-muted">
                                                <span>${formatDollars(minBuyInNum)}</span>
                                                <span>${formatDollars(maxBuyInNum)}</span>
                                            </div>
                                        </div>

                                        {hasElements(presets) && (
                                            <div className="mt-3">
                                                <AmountPresets presets={presets} current={buyInAmountDisplay} onPick={pickPreset} disabled={isJoining} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* User Balance */}
                                {/* Require update here when cosmos client return array of usdc = 0 instead of returning an empty array */}
                                <div className={`${insetBoxClass} divide-y divide-line py-1`} aria-label="Wallet balance">
                                    {hasElements(cosmosWallet.balance) ? (
                                        cosmosWallet.balance.map((balance, idx) => {
                                            if (balance.denom === "usdc") {
                                                const usdcAmount = microToUsdc(balance.amount);
                                                const buyInValue = parseDollars(buyInAmount) || 0;
                                                const exceedsBalance = buyInValue > usdcAmount;
                                                return (
                                                    <div key={idx} className="flex items-center justify-between gap-3 py-1.5">
                                                        <span className="text-sm text-ink-muted">Your USDC balance</span>
                                                        <span className={`text-sm font-semibold tabular-nums ${exceedsBalance ? "text-red-400" : "text-ink"}`}>
                                                            ${formatDollars(usdcAmount)}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })
                                    ) : (
                                        <div className="flex items-center justify-between gap-3 py-1.5">
                                            <span className="text-sm text-ink-muted">Your USDC balance</span>
                                            <span className={`text-sm font-semibold tabular-nums ${exceedsBalance ? "text-red-400" : "text-ink"}`}>$0.00</span>
                                        </div>
                                    )}
                                    {!isSitAndGo && (
                                        <>
                                            <div className="flex items-center justify-between gap-3 py-1.5">
                                                <span className="text-sm text-ink-muted">Min / max buy-in</span>
                                                <span className="text-sm font-semibold tabular-nums text-ink">
                                                    ${formatDollars(minBuyInNum)} / ${formatDollars(maxBuyInNum)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 py-1.5">
                                                <span className="text-sm text-ink-muted">Big blind</span>
                                                <span className="text-sm font-semibold tabular-nums text-ink">${formatDollars(bigBlindValue)}</span>
                                            </div>
                                        </>
                                    )}
                                    <div className="flex items-center justify-between gap-3 py-1.5">
                                        <span className="text-sm text-ink-muted">Seat</span>
                                        <span className="text-sm font-semibold tabular-nums text-ink">{index}</span>
                                    </div>
                                </div>

                                {/* Insufficient funds: keeps the existing Top Up handler */}
                                {exceedsBalance && (
                                    <div className={`${noticeClass.warning} flex flex-col gap-3`} role="status">
                                        <span>Your game wallet balance is below this buy-in. Top up to continue.</span>
                                        <PillButton variant="outline" size="md" className="w-full" onClick={handleDepositClick}>
                                            Top Up Game Wallet
                                        </PillButton>
                                    </div>
                                )}

                                {/* Error Message */}
                                {joinError && (
                                    <div role="alert" className={noticeClass.error}>
                                        {joinError}
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <ModalFooter>
                                <PillButton size="lg" className="w-full" onClick={handleBuyInConfirm} disabled={isJoining || exceedsBalance}>
                                    {isJoining ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                ></path>
                                            </svg>
                                            Joining...
                                        </>
                                    ) : (
                                        `Confirm & Join Seat ${index}`
                                    )}
                                </PillButton>
                                {!exceedsBalance && (
                                    <PillButton variant="outline" size="lg" className="w-full" onClick={handleDepositClick}>
                                        Top Up Game Wallet
                                    </PillButton>
                                )}
                                <PillButton variant="ghost" size="lg" className="w-full" onClick={closeBuyInModal} disabled={isJoining}>
                                    Cancel
                                </PillButton>
                            </ModalFooter>
                        </Modal>,
                        document.body
                    )}

                {/* Placeholder div for potential future loading animation */}
                {joinSuccess && (
                    <div id="loading-animation-placeholder" className={styles.hiddenPlaceholder}>
                        {/* Future loading animation will go here */}
                    </div>
                )}
                {showUSDCDepositModal &&
                    createPortal(
                        <>
                            <USDCDepositModal
                                isOpen={showUSDCDepositModal}
                                onClose={() => setShowUSDCDepositModal(false)}
                                onSuccess={() => {
                                    // Balance will auto-refresh on next page interaction
                                    setShowUSDCDepositModal(false);
                                    setShowBuyInModal(true);
                                }}
                            />
                        </>,
                        document.body
                    )}
            </>
        );
    },
    (prevProps, nextProps) => {
        // Custom comparison function for memo
        return prevProps.left === nextProps.left && prevProps.top === nextProps.top && prevProps.index === nextProps.index;
    }
);

VacantPlayer.displayName = "VacantPlayer";

export default VacantPlayer;
