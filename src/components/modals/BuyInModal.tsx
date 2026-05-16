import React, { useState, useMemo, useCallback } from "react";
import { useMinAndMaxBuyIns } from "../../hooks/game/useMinAndMaxBuyIns";
import { useNavigate } from "react-router-dom";
import { formatUSDCToSimpleDollars } from "../../utils/numberUtils";
import { useVacantSeatData } from "../../hooks/game/useVacantSeatData";
import { HexagonPattern } from "../common/Modal";
import { joinTable } from "../../hooks/playerActions/joinTable";
import { JoinTableOptions } from "../../hooks/playerActions/types";
import { useCosmosWallet } from "../../hooks";
import { usdcToMicroBigInt, microToUsdc } from "../../constants/currency";
import { useNetwork } from "../../context/NetworkContext";
import { useGameStateContext } from "../../context/GameStateContext";
import { getBlindsForDisplay } from "../../utils/gameFormatUtils";
import { GameFormat } from "@block52/poker-vm-sdk";
import DepositCore from "./DepositCore";
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
        return !isUserAlreadyPlaying && emptySeatIndexes.length > 0 && !isDisabled && !isJoiningRandomSeat && !exceedsBalance;
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
        localStorage.setItem("buy_in_amount", amount);
    }, []);

    const handleJoinClick = useCallback(() => {
        try {
            // Convert dollar amount to USDC microunits (6 decimals)
            const buyInMicrounits = usdcToMicroBigInt(parseFloat(buyInAmount));

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

            localStorage.setItem("buy_in_amount", buyInAmount);
            localStorage.setItem("wait_for_big_blind", JSON.stringify(waitForBigBlind));

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
            const buyInMicrounits = usdcToMicroBigInt(parseFloat(buyInAmount));

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
            if (emptySeatIndexes.length === 0) {
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

    // Per Commandment 7: Show error if buy-in values are missing from chain
    if (!hasBuyInValues) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose} />
                <div className={`relative p-8 rounded-xl shadow-2xl w-96 ${styles.modalContainer}`}>
                    <h2 className="text-xl font-bold mb-4 text-white">Buy In</h2>
                    <div className="text-red-400 mb-4">
                        Unable to load buy-in limits from the game. Please try again.
                    </div>
                    <button
                        onClick={onClose}
                        className={`w-full py-3 rounded-lg text-white font-semibold ${styles.closeButton}`}
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className={`relative p-8 rounded-xl shadow-2xl w-96 overflow-hidden ${styles.modalContainer}`}>
                {/* Hexagon pattern background */}
                <HexagonPattern patternId="hexagons-buyin" />

                <div className="absolute -right-8 -top-8 text-6xl opacity-10 rotate-12">♠</div>
                <div className="absolute -left-8 -bottom-8 text-6xl opacity-10 -rotate-12">♥</div>

                <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                    <span className={`mr-2 ${styles.suitClub}`}>
                        ♣
                    </span>
                    Buy In
                    <span className={`ml-2 ${styles.suitDiamond}`}>
                        ♦
                    </span>
                </h2>
                <div className={`w-full h-0.5 mb-4 opacity-50 ${styles.dividerPrimary}`}></div>

                {/* Cosmos Wallet Balances Section */}
                <div className="mb-5 space-y-2">
                    <p className="text-white text-xs font-semibold mb-2">Cosmos Balances:</p>
                    {cosmosWallet.isLoading ? (
                        <div className="text-gray-400 text-sm text-center py-2">Loading balances...</div>
                    ) : cosmosWallet.error ? (
                        <div className="text-red-400 text-sm text-center py-2">Error loading balances</div>
                    ) : !cosmosWallet.address ? (
                        <div className="text-gray-400 text-sm text-center py-2">No wallet connected</div>
                    ) : cosmosWallet.balance.length === 0 ? (
                        <div className="text-yellow-400 text-sm text-center py-2">⚠️ No tokens found - You need tokens to play!</div>
                    ) : (
                        <div className="space-y-2">
                            {cosmosWallet.balance.map((balance, idx) => {
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

                                // Determine if this USDC balance should show red (when buy-in exceeds balance)
                                const shouldShowRed = isUSDC && exceedsBalance;

                                return (
                                    <div
                                        key={idx}
                                        className={`flex items-center justify-between p-3 rounded-lg ${styles.balanceCard}`}
                                    >
                                        <div>
                                            <p className="text-white text-sm font-bold">{balance.denom}</p>
                                            <p className="text-gray-400 text-xs">Cosmos Chain</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-baseline gap-2">
                                                <span className={`font-bold text-lg ${shouldShowRed ? "text-red-500" : "text-white"}`}>{displayAmount}</span>
                                                <span className="text-gray-400 text-xs">{balance.denom}</span>
                                            </div>
                                            {usdValue && <div className={`text-xs ${shouldShowRed ? "text-red-400" : "text-gray-400"}`}>≈ {usdValue}</div>}
                                            <div className="text-xs text-gray-500">{Number(balance.amount).toLocaleString("en-US")} micro-units</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {needsDeposit ? (
                    /* Inline deposit flow when balance is below minimum buy-in.
                       DepositCore refreshes the wallet on success, which causes
                       `needsDeposit` to flip false and the buy-in form to
                       replace this block automatically. block52/ui#378 */
                    <div className="mb-6">
                        <div className={`mb-4 p-3 rounded-lg text-sm ${styles.depositLink}`}>
                            You need at least ${minBuyInFormatted} to join this table. Deposit to continue.
                        </div>
                        <DepositCore showMethodSelector />
                    </div>
                ) : (
                <>
                {/* Stake Dropdown */}
                <div className="mb-6">
                    <label className="block text-gray-300 mb-1 font-medium text-sm">Select Stake</label>
                    <select disabled value={stakeLabel} className={`w-full p-2 rounded text-white focus:outline-none text-sm ${styles.selectField}`}>
                        <option>{stakeLabel}</option>
                    </select>
                </div>

                {/* Buy-In Amount Selection */}
                <div className="mb-6">
                    <label className="block text-gray-300 mb-2 font-medium text-sm">{isSitAndGo ? "Fixed Buy-In (Sit & Go)" : "Buy-In Amount"}</label>
                    {isSitAndGo ? (
                        // Sit & Go: Show fixed buy-in amount (non-editable)
                        <div className={`p-4 rounded-lg border-2 ${styles.fixedBuyInPanel}`}>
                            <div className="text-center">
                                <div className="text-xs text-gray-400 mb-1">Required Buy-In</div>
                                <div className="text-3xl font-bold text-white">${maxBuyInFormatted}</div>
                                <div className="text-xs text-gray-400 mt-1">This is a fixed buy-in tournament</div>
                            </div>
                        </div>
                    ) : (
                        // Cash Game: Allow user to choose buy-in amount with slider
                        <div>
                            {/* Slider with min/max labels */}
                            <div className="mb-3">
                                <div className="flex justify-between text-xs text-gray-400 mb-2">
                                    <span>${minBuyInFormatted}</span>
                                    <span>${maxBuyInFormatted}</span>
                                </div>
                                <input
                                    type="range"
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
                                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${styles.buyInSlider}`}
                                />
                            </div>
                            
                            {/* Manual input below slider */}
                            <input
                                type="number"
                                value={buyInAmount}
                                onChange={e => handleBuyInChange(e.target.value)}
                                placeholder="Enter amount"
                                className={`w-full px-4 py-2 rounded-lg text-white text-center text-lg focus:outline-none ${styles.buyInInput}`}
                                step={bigBlindValue.toString()}
                                min={minBuyInNumber.toString()}
                                max={_maxBuyInNumber.toString()}
                            />
                        </div>
                    )}
                    {buyInError && (
                        <p className={`mt-2 text-sm ${styles.errorText}`}>
                            ⚠️ {buyInError}
                        </p>
                    )}
                </div>

                {/* Wait for Big Blind */}
                <div className="flex items-center mb-6">
                    <input
                        type="checkbox"
                        className={`w-4 h-4 rounded mr-2 ${styles.waitCheckbox}`}
                        checked={waitForBigBlind}
                        onChange={() => setWaitForBigBlind(!waitForBigBlind)}
                    />
                    <label className="text-gray-300 text-sm">Wait for Big Blind</label>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between space-x-4 mb-4">
                    <button
                        onClick={onClose}
                        className={`px-5 py-3 rounded-lg text-white font-medium flex-1 transition-all duration-200 ${styles.cancelButton}`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleJoinClick}
                        disabled={viewTableDisabled}
                        className={`px-4 py-3 rounded-lg font-medium flex-1 text-white shadow-md text-sm ${styles.viewTableButton}`}
                    >
                        View Table
                    </button>
                    <button
                        onClick={handleRandomSeatJoin}
                        disabled={takeSeatDisabled}
                        className={`px-4 py-3 rounded-lg font-medium flex-1 text-white shadow-md text-sm ${styles.takeSeatButton} ${takeSeatDisabled ? styles.takeSeatButtonDisabled : ""}`}
                    >
                        {isJoiningRandomSeat ? "Joining..." : "Take My Seat"}
                    </button>
                </div>
                </>
                )}

                {needsDeposit && (
                    <button
                        onClick={onClose}
                        className={`w-full mb-4 px-5 py-3 rounded-lg text-white font-medium transition-all duration-200 ${styles.cancelButton}`}
                    >
                        Cancel
                    </button>
                )}

                <div className={`text-xs ${styles.noteText}`}>
                    <strong>Please Note:</strong> This table has no all-in protection.
                </div>
            </div>
        </div>
    );
});

export default BuyInModal;
