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
import { formatUSDCToSimpleDollars } from "../../../utils/numberUtils";
import { useCosmosWallet } from "../../../hooks";
import { microToUsdc } from "../../../constants/currency";
import { useNetwork } from "../../../context/NetworkContext";
import styles from "./VacantPlayer.module.css";

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

        const { dealerSeat } = useDealerPosition();

        // Check if this seat is the dealer
        const isDealer = dealerSeat === index;

        // Memoize seat status checks
        const canJoinThisSeat = useMemo(() => checkCanJoinSeat(index), [checkCanJoinSeat, index]);

        // Memoize handlers
        const handleJoinClick = useCallback(() => {
            if (!canJoinThisSeat) return;
            
            // Initialize buy-in amount with maxBuyIn for Cash games
            const maxBuyInDollars = formatUSDCToSimpleDollars(gameOptions?.maxBuyIn);
            setBuyInAmount(maxBuyInDollars);
            
            // Open buy-in modal directly (skip confirmation modal)
            setShowBuyInModal(true);
            setJoinError(null);
            setJoinSuccess(false);
            setJoinResponse(null);
        }, [canJoinThisSeat, gameOptions?.maxBuyIn]);

        const handleSeatClick = useCallback(() => {
            if (!isUserAlreadyPlaying && canJoinThisSeat) {
                handleJoinClick();
            }
        }, [isUserAlreadyPlaying, canJoinThisSeat, handleJoinClick]);



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

        // Check if buy-in exceeds available balance
        const exceedsBalance = useMemo(() => {
            const buyInValue = parseFloat(buyInAmount) || 0;
            const usdcBalance = cosmosWallet.balance.find(b => b.denom === "usdc");
            if (!usdcBalance) return false;
            const usdcAmount = microToUsdc(usdcBalance.amount);
            return buyInValue > usdcAmount;
        }, [buyInAmount, cosmosWallet.balance]);

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
                    setJoinError(`Buy-in must be at least $${minBuyInDollars.toFixed(2)}`);
                    return;
                }
                if (buyInValue > maxBuyInDollars) {
                    setJoinError(`Buy-in cannot exceed $${maxBuyInDollars.toFixed(2)}`);
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

                // Trigger seat join notification via global window object
                // Small delay to ensure player component is rendered
                setTimeout(() => {
                    if (window.seatJoinNotifications && window.seatJoinNotifications[index]) {
                        window.seatJoinNotifications[index]();
                    }
                }, 100);

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

        return (
            <>
                <div className="absolute cursor-pointer" style={containerStyle} onClick={handleSeatClick}>
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

                    {/* Dealer Button - TODO: Implement framer motion animation in future iteration */}
                    {isDealer && (
                        <div className="absolute top-[-85px] right-[-40px] w-12 h-12 z-20">
                            <img src={CustomDealer} alt="Dealer Button" className="w-full h-full" />
                        </div>
                    )}
                </div>

                {/* Buy-in modal - using portal to render at document body */}
                {showBuyInModal && gameOptions && createPortal(
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => !isJoining && setShowBuyInModal(false)} />

                        {/* Modal */}
                        <div
                            className={`relative p-8 rounded-xl w-96 shadow-2xl ${styles.modalContainer}`}
                        >
                            <h3 className="text-2xl font-bold mb-4 text-white text-center">{isSitAndGo ? "Sit & Go Buy-In" : "Cash Game Buy-In"}</h3>

                            {/* Buy-In Amount - Fixed for Sit & Go, Input for Cash Game */}
                            {isSitAndGo ? (
                                // Sit & Go: Fixed buy-in amount
                                <div
                                    className={`mb-6 p-4 rounded-lg border-2 ${styles.fixedBuyInPanel}`}
                                >
                                    <div className="text-center">
                                        <div className="text-xs text-gray-400 mb-1">Required Buy-In</div>
                                        <div className="text-3xl font-bold text-white">
                                            ${formatUSDCToSimpleDollars(gameOptions.minBuyIn)}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">Fixed amount for this tournament</div>
                                    </div>
                                </div>
                            ) : (
                                // Cash Game: Editable buy-in amount
                                <div className="mb-6">
                                    <label className="block text-xs text-gray-400 mb-2">
                                        Buy-In Amount
                                    </label>
                                    
                                    {/* Slider with min/max labels */}
                                    <div className="mb-3">
                                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                                            <span>${minBuyInNum.toFixed(2)}</span>
                                            <span>${maxBuyInNum.toFixed(2)}</span>
                                        </div>
                                        <input
                                            type="range"
                                            value={sliderValue}
                                            onChange={e => {
                                                const val = parseFloat(e.target.value);
                                                if (!isNaN(val)) {
                                                    // Round to nearest step to align with bigBlindValue increments
                                                    const steppedValue = Math.round(val / bigBlindValue) * bigBlindValue;
                                                    setBuyInAmount(Math.max(minBuyInNum, Math.min(steppedValue, maxBuyInNum)).toFixed(2));
                                                }
                                            }}
                                            min={minBuyInNum.toString()}
                                            max={maxBuyInNum.toString()}
                                            step={bigBlindValue.toString()}
                                            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${styles.buyInSlider}`}
                                        />
                                    </div>
                                    
                                    {/* Manual input below slider */}
                                    <input
                                        type="number"
                                        value={buyInAmount}
                                        onChange={e => setBuyInAmount(e.target.value)}
                                        placeholder="Enter amount"
                                        className={`w-full px-4 py-2 rounded-lg text-white text-center text-lg ${styles.buyInInput}`}
                                        step={bigBlindValue.toString()}
                                        min={minBuyInNum.toString()}
                                        max={maxBuyInNum.toString()}
                                    />
                                </div>
                            )}

                            {/* User Balance */}
                            <div className="mb-6">
                                <div className="text-xs text-gray-400 mb-2">Your USDC Balance:</div>
                                {cosmosWallet.balance.map((balance, idx) => {
                                    if (balance.denom === "usdc") {
                                        const usdcAmount = microToUsdc(balance.amount);
                                        const buyInValue = parseFloat(buyInAmount) || 0;
                                        const exceedsBalance = buyInValue > usdcAmount;
                                        return (
                                            <div
                                                key={idx}
                                                className={`p-3 rounded-lg ${styles.balanceCard}`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white font-semibold">USDC</span>
                                                    <span
                                                        className={`text-lg font-bold ${
                                                            exceedsBalance ? "text-red-400" : "text-white"
                                                        }`}
                                                    >
                                                        ${usdcAmount.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                            </div>

                            {/* Error Message */}
                            {joinError && (
                                <div className={`mb-4 p-3 rounded-lg text-sm ${styles.errorCard}`}>
                                    ⚠️ {joinError}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col space-y-3">
                                <button
                                    onClick={handleBuyInConfirm}
                                    disabled={isJoining || exceedsBalance}
                                    className={`w-full px-6 py-3 text-sm font-semibold rounded-lg transition duration-300 flex items-center justify-center ${styles.confirmButton} ${
                                        exceedsBalance ? styles.confirmButtonDisabled : ""
                                    }`}
                                >
                                    {isJoining ? (
                                        <>
                                            <svg
                                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
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
                                </button>
                                <button
                                    onClick={() => setShowBuyInModal(false)}
                                    className={`w-full px-6 py-3 text-sm font-semibold rounded-lg transition duration-300 ${styles.cancelButton}`}
                                    disabled={isJoining}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Placeholder div for potential future loading animation */}
                {joinSuccess && (
                    <div id="loading-animation-placeholder" className={styles.hiddenPlaceholder}>
                        {/* Future loading animation will go here */}
                    </div>
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
