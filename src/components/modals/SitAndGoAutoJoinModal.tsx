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
import { joinTable } from "../../hooks/playerActions/joinTable";
import { formatUSDCToSimpleDollars, formatForSitAndGo } from "../../utils/numberUtils";
import { computeSngEntryBreakdown } from "../../utils/buyInUtils";
import { getCosmosBalance } from "../../utils/cosmosAccountUtils";
import { useNetwork } from "../../context/NetworkContext";
import { colors as _colors, hexToRgba as _hexToRgba } from "../../utils/colorConfig";
import { microToUsdc } from "../../constants/currency";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useGameStateContext } from "../../context/GameStateContext";
import { getGameTypeMnemonic } from "../../utils/gameFormatUtils";
import { isEmpty, hasElements, isBlank } from "../../utils/guards";

import { Modal } from "../common";
import { ModalFooter } from "./ModalFooter";
import { PillButton } from "../ui/PillButton";
import { insetBoxClass, noticeClass } from "./walletFormClasses";
import type { SitAndGoAutoJoinModalProps } from "./types";

const SitAndGoAutoJoinModal: React.FC<SitAndGoAutoJoinModalProps> = ({ tableId, onJoinSuccess }) => {
    const [accountBalance, setAccountBalance] = useState<string>("0");
    const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(true);
    const [buyInError, setBuyInError] = useState("");
    const [hasJoined, setHasJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const { currentNetwork } = useNetwork();

    // Get game options
    const { gameOptions } = useGameOptions();
    const { emptySeatIndexes, isUserAlreadyPlaying } = useVacantSeatData();

    // Get the game state context to force refresh after joining
    const { subscribeToTable, gameState } = useGameStateContext();

    // Get Cosmos address once
    const publicKey = useMemo(() => localStorage.getItem(STORAGE_KEYS.cosmosAddress) || undefined, []);

    // Calculate formatted values
    const { maxBuyInFormatted, balanceFormatted, smallBlindFormatted, bigBlindFormatted, startingStackFormatted, entryFeeFormatted } = useMemo(() => {
        if (!gameOptions) {
            return {
                maxBuyInFormatted: "0",
                balanceFormatted: 0,
                smallBlindFormatted: "0",
                bigBlindFormatted: "0",
                startingStackFormatted: "0",
                entryFeeFormatted: "0.00"
            };
        }

        // Check if we have valid gameOptions first
        if (!gameOptions.maxBuyIn) {
            return {
                maxBuyInFormatted: "0.00",
                balanceFormatted: 0,
                smallBlindFormatted: "0.00",
                bigBlindFormatted: "0.00",
                startingStackFormatted: "0",
                entryFeeFormatted: "0.00"
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

        // Entry fee is USDC microunits (like the buy-in); "0"/absent = no fee
        const entryFee = gameOptions.entryFee && gameOptions.entryFee !== "0"
            ? formatUSDCToSimpleDollars(gameOptions.entryFee)
            : "0.00";

        return {
            maxBuyInFormatted: maxFormatted,
            balanceFormatted: balance,
            smallBlindFormatted: smallBlind,
            bigBlindFormatted: bigBlind,
            startingStackFormatted: startingStack,
            entryFeeFormatted: entryFee
        };
    }, [gameOptions, accountBalance]);

    // Protocol-fee breakdown (poker-vm#2592). The fee is skimmed OUT OF the
    // buy-in, so the prize-pool portion is buyIn - protocolCut. When no protocol
    // fee is configured (bps absent/0) the breakdown is hidden and behaviour is
    // unchanged. Computed in micro-USDC bigint via the shared, tested util.
    const feeBreakdown = useMemo(() => {
        const buyIn = gameOptions?.maxBuyIn;
        const entryFee = gameOptions?.entryFee;
        // protocolFeeBps is optional and not surfaced by useGameOptions' Required<>
        // mapping — read it from the raw DTO (single source: the chain).
        const protocolFeeBps = gameState?.gameOptions?.protocolFeeBps;
        const breakdown = computeSngEntryBreakdown(buyIn, entryFee, protocolFeeBps);

        return {
            show: breakdown.hasProtocolFee,
            prizePoolPortionFormatted: formatUSDCToSimpleDollars(breakdown.prizePoolPortion),
            protocolCutFormatted: formatUSDCToSimpleDollars(breakdown.protocolCut),
            ownerFeeFormatted: formatUSDCToSimpleDollars(breakdown.ownerFee),
            totalFormatted: formatUSDCToSimpleDollars(breakdown.total)
        };
    }, [gameOptions?.maxBuyIn, gameOptions?.entryFee, gameState?.gameOptions?.protocolFeeBps]);

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

            setIsJoining(true);

            // Convert the fixed SNG buy-in from USDC microunits to a dollar
            // string — joinTable converts back to microunits internally.
            const buyInAmountInDollars = microToUsdc(gameOptions.maxBuyIn);

            // Route the join through joinTable so it uses the active transport
            // (gateway by default, ui#440). The previous path
            // (useSitAndGoPlayerJoinRandomSeat) submitted chain-direct with
            // seat 0 — invisible to the gateway the UI reads from, and
            // mis-seated by the SNG engine. Claim a concrete empty seat.
            await joinTable(
                tableId,
                {
                    amount: String(buyInAmountInDollars),
                    seatNumber: emptySeatIndexes[0]
                },
                currentNetwork
            );


            // Mark as joined and notify parent
            setHasJoined(true);

            // Store buy-in info in localStorage for the table component
            localStorage.setItem(STORAGE_KEYS.buyInAmount, maxBuyInFormatted);
            localStorage.setItem(STORAGE_KEYS.waitForBigBlind, JSON.stringify(false));

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
        } catch (error) {
            console.error("❌ Failed to join Sit & Go:", error);
            setBuyInError(error instanceof Error ? error.message : "Failed to join table");
        } finally {
            setIsJoining(false);
        }
    }, [publicKey, tableId, isUserAlreadyPlaying, hasJoined, emptySeatIndexes, maxBuyInFormatted, balanceFormatted, gameOptions, currentNetwork, subscribeToTable, onJoinSuccess]);

    // Don't show modal if user is already playing or has joined
    if (isUserAlreadyPlaying || hasJoined) {
        return null;
    }

    const playerCountLabel = getGameTypeMnemonic(gameOptions?.maxPlayers);

    const playersJoined = gameOptions ? gameOptions.maxPlayers - emptySeatIndexes.length : 0;
    const playersMax = gameOptions ? gameOptions.maxPlayers : 0;
    const hasEnoughBalance = balanceFormatted >= parseFloat(maxBuyInFormatted);
    const isTakeSeatDisabled = isJoining || isBalanceLoading || !hasEnoughBalance || isEmpty(emptySeatIndexes);

    return (
        <Modal
            isOpen
            onClose={noop}
            closeOnEscape={false}
            closeOnBackdropClick={false}
            widthClass="w-[420px]"
        >
            <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-brand/10 border border-brand/30 grid place-items-center text-brand-light">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                        />
                    </svg>
                </div>
                <h2 className="m-0 mt-4 text-xl font-semibold text-ink">Sit & Go Tournament</h2>
                <p className="m-0 mt-1 text-sm text-ink-muted">Join this {playerCountLabel} tournament.</p>
            </div>

            {/* Game options */}
            <div className="mt-5 flex flex-col gap-2">
                <FactRow label="Format" value={`Texas Hold'em • ${playerCountLabel}`} />
                <FactRow label="Buy-in" value={`$${maxBuyInFormatted}`} />

                {entryFeeFormatted !== "0.00" && !feeBreakdown.show && <FactRow label="Entry fee" value={`$${entryFeeFormatted}`} />}

                {/* Protocol-fee breakdown (poker-vm#2592). Shown only when a
                    protocol fee is configured; the fee comes OUT OF the buy-in,
                    so prize pool = buyIn - protocolCut, and total = buyIn + owner fee. */}
                {feeBreakdown.show && (
                    <div className={`${insetBoxClass} !border-brand/30 flex flex-col gap-1.5`} data-testid="sng-fee-breakdown">
                        <FactLine label="Buy-in (to prize pool)" value={`$${feeBreakdown.prizePoolPortionFormatted}`} />
                        <FactLine label="Protocol fee" value={`$${feeBreakdown.protocolCutFormatted}`} valueClass="text-brand-light" />
                        <FactLine label="Owner fee" value={`$${feeBreakdown.ownerFeeFormatted}`} />
                        <div className="border-t border-line pt-1.5">
                            <FactLine label="Total" value={`$${feeBreakdown.totalFormatted}`} valueClass="text-emerald-400 font-bold" labelClass="text-ink-soft font-semibold" />
                        </div>
                    </div>
                )}

                <FactRow label="Starting blinds" value={`${smallBlindFormatted} / ${bigBlindFormatted}`} />
                <FactRow label="Starting stack" value={`${startingStackFormatted} chips`} valueClass="text-emerald-400" />
                <FactRow label="Your balance" value={`$${balanceFormatted.toFixed(2)}`} valueClass={hasEnoughBalance ? "text-emerald-400" : "text-red-400"} />
            </div>

            {/* Players joined */}
            <div className={`${insetBoxClass} mt-2`}>
                <FactLine label="Players joined" value={`${playersJoined} / ${playersMax}`} valueClass="text-brand-light" />
                <div className="mt-2 h-2 rounded-full bg-line-strong overflow-hidden" role="presentation">
                    <div
                        className="h-full rounded-full bg-brand transition-all duration-500"
                        style={{ width: `${playersMax > 0 ? (playersJoined / playersMax) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Error Message */}
            {buyInError && (
                <p role="alert" className={`m-0 mt-3 ${noticeClass.error}`}>
                    {buyInError}
                </p>
            )}

            <ModalFooter>
                {/* Take Seat Button */}
                <PillButton onClick={handleTakeSeat} disabled={isTakeSeatDisabled} size="lg" className="w-full">
                    {isJoining ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                            </svg>
                            Joining...
                        </>
                    ) : isBalanceLoading ? (
                        "Loading..."
                    ) : !hasEnoughBalance ? (
                        "Insufficient Balance"
                    ) : isEmpty(emptySeatIndexes) ? (
                        "Table Full"
                    ) : (
                        "Take My Seat"
                    )}
                </PillButton>
                <p className="m-0 text-center text-xs text-ink-muted">Tournament starts when all players are seated</p>
            </ModalFooter>
        </Modal>
    );
};

// Not dismissable by backdrop/Escape; satisfies Modal's required onClose.
function noop(): void {
    return undefined;
}

const FactLine: React.FC<{ label: string; value: string; valueClass?: string; labelClass?: string }> = ({
    label,
    value,
    valueClass = "text-ink",
    labelClass = "text-ink-muted"
}) => (
    <div className="flex items-center justify-between gap-3 text-sm">
        <span className={labelClass}>{label}</span>
        <span className={`font-semibold tabular-nums text-right ${valueClass}`}>{value}</span>
    </div>
);

const FactRow: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
    <div className={insetBoxClass}>
        <FactLine label={label} value={value} valueClass={valueClass} />
    </div>
);

export default SitAndGoAutoJoinModal;
