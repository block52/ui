/**
 * AMOUNT HANDLING PATTERN (Cosmos SDK):
 * - Components work with numbers (dollars): e.g., amount = 10 means $10
 * - Hooks convert numbers to USDC microunits: amount * USDC_TO_MICRO
 * - SDK receives microunits as strings: "10000000"
 * - Backend expects USDC microunits (6 decimals), not Wei (18 decimals)
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ethers } from "ethers";
import { useGameOptions } from "../../hooks/game/useGameOptions";
import { useVacantSeatData } from "../../hooks/game/useVacantSeatData";
import { useSitAndGoPlayerJoinRandomSeat } from "../../hooks/game/useSitAndGoPlayerJoinRandomSeat";
import { formatUSDCToSimpleDollars, formatForSitAndGo } from "../../utils/numberUtils";
import { getCosmosBalance } from "../../utils/cosmosAccountUtils";
import { useNetwork } from "../../context/NetworkContext";
import { colors as _colors, hexToRgba as _hexToRgba } from "../../utils/colorConfig";
import { microToUsdc } from "../../constants/currency";
import { useGameStateContext } from "../../context/GameStateContext";
import { getGameTypeMnemonic } from "../../utils/gameFormatUtils";
import { isEmpty, hasElements, isBlank } from "../../utils/guards";

import type { SitAndGoAutoJoinModalProps } from "./types";

const SitAndGoAutoJoinModal: React.FC<SitAndGoAutoJoinModalProps> = ({ tableId, onJoinSuccess }) => {
    const [accountBalance, setAccountBalance] = useState<string>("0");
    const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(true);
    const [buyInError, setBuyInError] = useState("");
    const [hasJoined, setHasJoined] = useState(false);
    const { currentNetwork } = useNetwork();

    // Get game options
    const { gameOptions } = useGameOptions();
    const { emptySeatIndexes, isUserAlreadyPlaying } = useVacantSeatData();

    // Use the Sit & Go specific join hook with random seat selection
    const { joinSitAndGo, isJoining } = useSitAndGoPlayerJoinRandomSeat();

    // Get the game state context to force refresh after joining
    const { subscribeToTable, gameState: _gameState } = useGameStateContext();

    // Get Cosmos address once
    const publicKey = useMemo(() => localStorage.getItem("user_cosmos_address") || undefined, []);

    // Calculate formatted values
    const { maxBuyInFormatted, balanceFormatted, smallBlindFormatted, bigBlindFormatted, startingStackFormatted } = useMemo(() => {
        if (!gameOptions) {
            return {
                maxBuyInFormatted: "0",
                balanceFormatted: 0,
                smallBlindFormatted: "0",
                bigBlindFormatted: "0",
                startingStackFormatted: "0"
            };
        }

        // Check if we have valid gameOptions first
        if (!gameOptions.maxBuyIn) {
            return {
                maxBuyInFormatted: "0.00",
                balanceFormatted: 0,
                smallBlindFormatted: "0.00",
                bigBlindFormatted: "0.00",
                startingStackFormatted: "0"
            };
        }

        // Use actual values from gameOptions (Cosmos USDC microunits - 6 decimals)
        const maxBuyInMicrounits = gameOptions.maxBuyIn;
        // Format USDC microunits to dollars
        const maxFormatted = maxBuyInMicrounits === "1" ? "1.00" : formatUSDCToSimpleDollars(maxBuyInMicrounits);

        // Balance is stored as USDC microunits (6 decimals)
        const balance = accountBalance ? parseFloat(ethers.formatUnits(accountBalance, 6)) : 0;

        // For SNG, blinds are stored as chip counts (not microunits)
        // Format them with commas for display
        const smallBlind = gameOptions.smallBlind
            ? formatForSitAndGo(Number(gameOptions.smallBlind))
            : "0";
        const bigBlind = gameOptions.bigBlind
            ? formatForSitAndGo(Number(gameOptions.bigBlind))
            : "0";

        // Starting stack is in chips - format as whole number with commas
        const startingStack = gameOptions.startingStack
            ? formatForSitAndGo(Number(gameOptions.startingStack))
            : "0";

        return {
            maxBuyInFormatted: maxFormatted,
            balanceFormatted: balance,
            smallBlindFormatted: smallBlind,
            bigBlindFormatted: bigBlind,
            startingStackFormatted: startingStack
        };
    }, [gameOptions, accountBalance]);

    // Fetch balance on mount
    useEffect(() => {
        const fetchBalance = async () => {
            try {
                setIsBalanceLoading(true);

                if (!publicKey) {
                    setBuyInError("No Block52 wallet address available");
                    setIsBalanceLoading(false);
                    return;
                }

                const balance = await getCosmosBalance(currentNetwork, "usdc");
                setAccountBalance(balance);
            } catch (err) {
                console.error("Error fetching Cosmos balance:", err);
                setBuyInError("Failed to fetch balance");
            } finally {
                setIsBalanceLoading(false);
            }
        };

        fetchBalance();
    }, [publicKey]);

    // Handle auto-join
    const handleTakeSeat = useCallback(async () => {
        if (!publicKey || !tableId || isUserAlreadyPlaying || hasJoined) return;

        // Check if there are empty seats
        if (isEmpty(emptySeatIndexes)) {
            setBuyInError("No empty seats available");
            return;
        }

        // Check balance
        const maxBuyInNumber = parseFloat(maxBuyInFormatted);
        if (balanceFormatted < maxBuyInNumber) {
            setBuyInError(`Insufficient balance. Need $${maxBuyInFormatted}`);
            return;
        }

        setBuyInError("");

        try {
            // Check if we have valid gameOptions
            if (!gameOptions || !gameOptions.maxBuyIn) {
                setBuyInError("Game options not available");
                return;
            }


            // STEP 1: Convert USDC microunits from gameOptions to dollar amount (number)
            // gameOptions.maxBuyIn is in USDC microunits (e.g., "1000000" for $1)
            const buyInAmountInMicrounits = gameOptions.maxBuyIn;
            const buyInAmountInDollars = microToUsdc(buyInAmountInMicrounits);


            // STEP 2: Pass the dollar amount (number) to the hook
            // The hook will handle the conversion back to USDC microunits internally
            await joinSitAndGo({
                tableId,
                amount: buyInAmountInDollars // Pass as number (dollars), not string (microunits)
                // No need to specify seat - SDK will pick randomly
            });


            // Mark as joined and notify parent
            setHasJoined(true);

            // Store buy-in info in localStorage for the table component
            localStorage.setItem("buy_in_amount", maxBuyInFormatted);
            localStorage.setItem("wait_for_big_blind", JSON.stringify(false));

            // Force a re-subscription to get the latest state
            subscribeToTable(tableId);

            // Small delay to allow backend to process and state to update
            setTimeout(() => {
                onJoinSuccess();

                // COMMENTED OUT: Fallback refresh after 3 seconds
                // This was causing unwanted page refreshes even when join was successful
                // setTimeout(() => {
                //     // Check if we have players in the game state
                //     if (!gameState?.players || gameState.players.length === 0) {
                //         window.location.reload();
                //     }
                // }, 3000);
            }, 1500);
        } catch (error: any) {
            console.error("❌ Failed to join Sit & Go:", error);
            setBuyInError(error.message || "Failed to join table");
        }
    }, [
        publicKey,
        tableId,
        isUserAlreadyPlaying,
        hasJoined,
        emptySeatIndexes.length,
        maxBuyInFormatted,
        balanceFormatted,
        gameOptions,
        joinSitAndGo,
        subscribeToTable,
        onJoinSuccess
    ]);

    // Don't show modal if user is already playing or has joined
    if (isUserAlreadyPlaying || hasJoined) {
        return null;
    }

    const playerCountLabel = getGameTypeMnemonic(gameOptions?.minPlayers);

    // Compact mode for mobile landscape (short viewport)
    const isCompact = typeof window !== "undefined" && window.innerHeight <= 500;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className={`bg-gray-800/90 backdrop-blur-md rounded-xl shadow-2xl border border-blue-400/20 relative max-h-[90dvh] overflow-y-auto ${isCompact ? "p-3 w-80" : "p-8 w-96"}`}>
                {/* Web3 styled background */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-xl"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-pulse"></div>

                <div className="relative z-10">
                    {/* Logo + Icon — hidden on compact */}
                    {!isCompact && (
                        <>
                            <div className="flex items-center justify-center mb-4">
                                <img src="/block52.png" alt="Block52 Logo" className="h-16 w-auto object-contain" />
                            </div>

                            <div className="flex items-center justify-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-400/30">
                                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                                        />
                                    </svg>
                                </div>
                            </div>
                        </>
                    )}

                    <h2 className={`font-bold text-white text-center text-shadow ${isCompact ? "text-base mb-1" : "text-2xl mb-2"}`}>Sit & Go Tournament</h2>
                    {!isCompact && <p className="text-gray-300 text-center mb-6 text-sm">Join this exciting {playerCountLabel} tournament!</p>}

                    {/* Game Options Display */}
                    {isCompact ? (
                        /* Compact: 2-column grid to fit everything without scrolling */
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                            <div className="bg-gray-700/80 rounded p-1.5 border border-blue-500/30">
                                <div className="text-gray-400 text-[10px]">Format</div>
                                <div className="text-white text-xs font-semibold">Hold'em • {playerCountLabel}</div>
                            </div>
                            <div className="bg-gray-700/80 rounded p-1.5 border border-blue-500/30">
                                <div className="text-gray-400 text-[10px]">Buy-in</div>
                                <div className="text-white text-xs font-semibold">${maxBuyInFormatted}</div>
                            </div>
                            <div className="bg-gray-700/80 rounded p-1.5 border border-blue-500/30">
                                <div className="text-gray-400 text-[10px]">Blinds</div>
                                <div className="text-white text-xs font-semibold">{smallBlindFormatted}/{bigBlindFormatted}</div>
                            </div>
                            <div className="bg-gray-700/80 rounded p-1.5 border border-green-500/30">
                                <div className="text-gray-400 text-[10px]">Stack</div>
                                <div className="text-green-400 text-xs font-semibold">{startingStackFormatted}</div>
                            </div>
                            <div className="bg-gray-700/80 rounded p-1.5 border border-blue-500/30">
                                <div className="text-gray-400 text-[10px]">Balance</div>
                                <div className={`text-xs font-semibold ${balanceFormatted >= parseFloat(maxBuyInFormatted) ? "text-green-400" : "text-red-400"}`}>
                                    ${balanceFormatted.toFixed(2)}
                                </div>
                            </div>
                            <div className="bg-blue-500/20 rounded p-1.5 border border-blue-500/30">
                                <div className="text-blue-300 text-[10px]">Players</div>
                                <div className="text-white text-xs font-bold">
                                    {gameOptions ? `${gameOptions.maxPlayers - emptySeatIndexes.length}/${gameOptions.maxPlayers}` : "0/0"}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Desktop: stacked rows */
                        <>
                            <div className="space-y-3 mb-6">
                                <div className="bg-gray-700/80 backdrop-blur-sm rounded-lg p-3 border border-blue-500/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">Format:</span>
                                        <span className="text-white font-semibold">Texas Hold'em • {playerCountLabel}</span>
                                    </div>
                                </div>

                                <div className="bg-gray-700/80 backdrop-blur-sm rounded-lg p-3 border border-blue-500/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">Buy-in:</span>
                                        <span className="text-white font-semibold">${maxBuyInFormatted}</span>
                                    </div>
                                </div>

                                <div className="bg-gray-700/80 backdrop-blur-sm rounded-lg p-3 border border-blue-500/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">Starting Blinds:</span>
                                        <span className="text-white font-semibold">
                                            {smallBlindFormatted} / {bigBlindFormatted}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-700/80 backdrop-blur-sm rounded-lg p-3 border border-green-500/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">Starting Stack:</span>
                                        <span className="text-green-400 font-semibold">{startingStackFormatted} chips</span>
                                    </div>
                                </div>

                                <div className="bg-gray-700/80 backdrop-blur-sm rounded-lg p-3 border border-blue-500/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">Your Balance:</span>
                                        <span className={`font-semibold ${balanceFormatted >= parseFloat(maxBuyInFormatted) ? "text-green-400" : "text-red-400"}`}>
                                            ${balanceFormatted.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Players Joined */}
                            <div className="mb-6 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                                <div className="text-center">
                                    <div className="text-xs text-blue-300 font-semibold mb-1">PLAYERS JOINED</div>
                                    <div className="text-lg text-white font-bold">
                                        {gameOptions ? `${gameOptions.maxPlayers - emptySeatIndexes.length} / ${gameOptions.maxPlayers}` : "0 / 0"} Players
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Error Message */}
                    {buyInError && (
                        <div className={`bg-red-500/20 border border-red-500/30 rounded-lg ${isCompact ? "mb-1.5 p-1.5" : "mb-4 p-3"}`}>
                            <p className="text-red-400 text-sm text-center">{buyInError}</p>
                        </div>
                    )}

                    {/* Take Seat Button */}
                    <button
                        onClick={handleTakeSeat}
                        disabled={isJoining || isBalanceLoading || balanceFormatted < parseFloat(maxBuyInFormatted) || isEmpty(emptySeatIndexes)}
                        className={`w-full px-4 rounded-lg font-semibold text-white transition-all duration-300 ${isCompact ? "py-2 text-sm" : "py-3"} ${
                            isJoining || isBalanceLoading || balanceFormatted < parseFloat(maxBuyInFormatted) || isEmpty(emptySeatIndexes)
                                ? "bg-gray-600 cursor-not-allowed"
                                : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transform hover:scale-105"
                        }`}
                    >
                        {isJoining ? (
                            <div className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                                Joining...
                            </div>
                        ) : isBalanceLoading ? (
                            "Loading..."
                        ) : balanceFormatted < parseFloat(maxBuyInFormatted) ? (
                            "Insufficient Balance"
                        ) : isEmpty(emptySeatIndexes) ? (
                            "Table Full"
                        ) : (
                            "Take My Seat"
                        )}
                    </button>

                    {!isCompact && (
                        <div className="mt-6 text-center">
                            <p className="text-xs text-gray-400">Tournament starts when all players are seated</p>
                            <div className="flex items-center justify-center gap-1 mt-2">
                                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                                <span className="text-xs text-gray-400">Powered by Block52</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SitAndGoAutoJoinModal;
