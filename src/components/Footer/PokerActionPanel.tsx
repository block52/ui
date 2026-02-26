import React, { useState, useEffect, useMemo, useCallback } from "react";
import { NonPlayerActionType, PlayerActionType, PlayerDTO, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { parseMicroToBigInt, microBigIntToUsdc, usdcToMicroBigInt } from "../../constants/currency";

// Import hooks
import { useTableState, useNextToActInfo } from "../../hooks";
import { usePlayerLegalActions } from "../../hooks/playerActions/usePlayerLegalActions";
import { useGameStateContext } from "../../context/GameStateContext";
import { dealCardsWithEntropy } from "../../hooks/playerActions/dealCards";
import { useAutoDeal } from "../../hooks/playerActions/useAutoDeal";
import { useAutoPostBlinds } from "../../hooks/playerActions/useAutoPostBlinds";

// Import action handlers
import {
    handleCall,
    handleCheck,
    handleFold,
    handleMuck,
    handleShow,
    handleStartNewHand,
    handlePostSmallBlind,
    handlePostBigBlind,
    handleBet,
    handleRaise
} from "../common/actionHandlers";

// Import utils
import { getActionByType, hasAction } from "../../utils/actionUtils";
import { getAutoDealEnabled, getAutoPostBlindsEnabled } from "../../utils/urlParams";
import { getRaiseToAmount } from "../../utils/raiseUtils";

// Import sub-components
import { ActionButton } from "./ActionButton";
import { DealButtonGroup } from "./DealButtonGroup";
import { ShowdownButtons } from "./ShowdownButtons";
import { BlindButtonGroup } from "./BlindButtonGroup";
import { MainActionButtons } from "./MainActionButtons";
import { RaiseBetControls } from "./RaiseBetControls";

// Import types
import type { PokerActionPanelProps } from "./types";

export const PokerActionPanel: React.FC<PokerActionPanelProps> = ({
    tableId,
    network,
    onTransactionSubmitted
}) => {
    // Loading state for actions
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    // Detect mobile landscape orientation
    const [isMobileLandscape, setIsMobileLandscape] = useState(
        window.innerWidth <= 926 && window.innerWidth > window.innerHeight
    );

    useEffect(() => {
        const checkOrientation = () => {
            setIsMobileLandscape(window.innerWidth <= 926 && window.innerWidth > window.innerHeight);
        };

        window.addEventListener("resize", checkOrientation);
        window.addEventListener("orientationchange", checkOrientation);

        return () => {
            window.removeEventListener("resize", checkOrientation);
            window.removeEventListener("orientationchange", checkOrientation);
        };
    }, []);

    // Get game state and player data
    const { gameState } = useGameStateContext();
    const players = gameState?.players || null;
    const { legalActions, isPlayerTurn, playerStatus } = usePlayerLegalActions();
    const { isCurrentUserTurn } = useNextToActInfo(tableId);
    const { formattedTotalPot } = useTableState();

    // Get user address
    const userAddress = useMemo(() => localStorage.getItem("user_cosmos_address")?.toLowerCase(), []);

    // Determine if user is in the table
    const isUserInTable = useMemo(
        () => !!players?.some((player: PlayerDTO) => player.address?.toLowerCase() === userAddress),
        [players, userAddress]
    );

    // Get user player
    const userPlayer = players?.find((player: PlayerDTO) => player.address?.toLowerCase() === userAddress);

    // Determine if it's user's turn
    const isUsersTurn = isCurrentUserTurn || isPlayerTurn;

    // Check available actions
    const hasSmallBlindAction = hasAction(legalActions, PlayerActionType.SMALL_BLIND);
    const hasBigBlindAction = hasAction(legalActions, PlayerActionType.BIG_BLIND);
    const hasFoldAction = hasAction(legalActions, PlayerActionType.FOLD);
    const hasCheckAction = hasAction(legalActions, PlayerActionType.CHECK);
    const hasCallAction = hasAction(legalActions, PlayerActionType.CALL);
    const hasBetAction = hasAction(legalActions, PlayerActionType.BET);
    const hasRaiseAction = hasAction(legalActions, PlayerActionType.RAISE);
    const hasMuckAction = hasAction(legalActions, PlayerActionType.MUCK);
    const hasShowAction = hasAction(legalActions, PlayerActionType.SHOW);
    const hasDealAction = hasAction(legalActions, NonPlayerActionType.DEAL);

    // Blind amounts - single source of truth from gameState.gameOptions (per Commandment 7)
    // Defined early so they can be used in useAutoPostBlinds hook
    const smallBlindMicro = useMemo(
        () => parseMicroToBigInt(gameState?.gameOptions?.smallBlind),
        [gameState?.gameOptions?.smallBlind]
    );

    const bigBlindMicro = useMemo(
        () => parseMicroToBigInt(gameState?.gameOptions?.bigBlind),
        [gameState?.gameOptions?.bigBlind]
    );

    // Auto-deal hook - automatically triggers deal when conditions are met
    // Can be disabled via URL query param: ?autodeal=false
    useAutoDeal(
        tableId,
        network,
        hasDealAction,
        isUsersTurn,
        () => setLoadingAction("deal"), // onDealStarted
        (txHash) => {
            setLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onDealComplete
        () => setLoadingAction(null) // onDealError
    );

    // Auto-post blinds hook - automatically posts small/big blind when conditions are met
    // Can be disabled via URL query param: ?autoblinds=false
    useAutoPostBlinds(
        tableId,
        network,
        hasSmallBlindAction,
        hasBigBlindAction,
        smallBlindMicro,
        bigBlindMicro,
        isUsersTurn,
        (blindType) => setLoadingAction(blindType === "small" ? "small-blind" : "big-blind"), // onBlindStarted
        (blindType, txHash) => {
            setLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onBlindComplete
        () => setLoadingAction(null) // onBlindError
    );

    // Check if auto-deal is enabled (cached on mount) - used for DealButtonGroup
    const autoDealEnabled = useMemo(() => getAutoDealEnabled(), []);
    // Check if auto-post blinds is enabled (cached on mount) - for conditional UI if needed
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const autoPostBlindsEnabled = useMemo(() => getAutoPostBlindsEnabled(), []);

    // Show deal button if player has the deal action
    const shouldShowDealButton = hasDealAction && isUsersTurn;
    const hideOtherButtons = shouldShowDealButton;

    // Get action details
    const callAction = getActionByType(legalActions, PlayerActionType.CALL);
    const betAction = getActionByType(legalActions, PlayerActionType.BET);
    const raiseAction = getActionByType(legalActions, PlayerActionType.RAISE);

    // Store amounts as bigint internally (in micro-units, 10^6 precision)
    const minBetMicro = useMemo(() => parseMicroToBigInt(betAction?.min), [betAction]);
    const maxBetMicro = useMemo(() => parseMicroToBigInt(betAction?.max), [betAction]);
    const minRaiseMicro = useMemo(() => parseMicroToBigInt(raiseAction?.min), [raiseAction]);
    const maxRaiseMicro = useMemo(() => parseMicroToBigInt(raiseAction?.max), [raiseAction]);
    const callAmountMicro = useMemo(() => parseMicroToBigInt(callAction?.min), [callAction]);

    // Convert to USDC (number) for display and slider
    const minBet = useMemo(() => microBigIntToUsdc(minBetMicro), [minBetMicro]);
    const maxBet = useMemo(() => microBigIntToUsdc(maxBetMicro), [maxBetMicro]);
    const minRaise = useMemo(() => microBigIntToUsdc(minRaiseMicro), [minRaiseMicro]);
    const maxRaise = useMemo(() => microBigIntToUsdc(maxRaiseMicro), [maxRaiseMicro]);
    const callAmount = useMemo(() => microBigIntToUsdc(callAmountMicro), [callAmountMicro]);

    // Get total pot for percentage calculations
    const totalPot = Number(formattedTotalPot) || 0;
    const totalPotMicro = useMemo(() => usdcToMicroBigInt(totalPot), [totalPot]);

    // Formatted blind amounts for display (blind amounts defined earlier for use in hooks)
    const formattedSmallBlindAmount = useMemo(() => microBigIntToUsdc(smallBlindMicro).toFixed(2), [smallBlindMicro]);
    const formattedBigBlindAmount = useMemo(() => microBigIntToUsdc(bigBlindMicro).toFixed(2), [bigBlindMicro]);
    const bigBlindUsdc = useMemo(() => microBigIntToUsdc(bigBlindMicro), [bigBlindMicro]);
    const formattedCallAmount = useMemo(() => callAmount.toFixed(2), [callAmount]);
    const formattedMaxBetAmount = useMemo(
        () => (hasBetAction ? maxBet.toFixed(2) : maxRaise.toFixed(2)),
        [hasBetAction, maxBet, maxRaise]
    );

    // Raise amount state
    const initialAmount = hasBetAction ? (minBet > 0 ? minBet : 0) : minRaise > 0 ? minRaise : 0;
    const [raiseAmount, setRaiseAmount] = useState<number>(initialAmount);

    // Validation
    const isRaiseAmountInvalid = hasRaiseAction
        ? raiseAmount < minRaise || raiseAmount > maxRaise
        : hasBetAction
        ? raiseAmount < minBet || raiseAmount > maxBet
        : false;

    // Update raise amount when actions become available
    useEffect(() => {
        if (hasRaiseAction && minRaise > 0) {
            setRaiseAmount(minRaise);
        } else if (hasBetAction && minBet > 0) {
            setRaiseAmount(minBet);
        }
    }, [hasRaiseAction, hasBetAction, minRaise, minBet]);

    // Helper function to wrap action handlers with loading state
    const handleActionWithTransaction = useCallback(
        async (actionName: string, actionFn: () => Promise<string | null>) => {
            try {
                setLoadingAction(actionName);
                const txHash = await actionFn();
                if (txHash && onTransactionSubmitted) {
                    onTransactionSubmitted(txHash);
                }
            } catch (error) {
                console.error(`Error executing ${actionName}:`, error);
                throw error;
            } finally {
                setLoadingAction(null);
            }
        },
        [onTransactionSubmitted]
    );

    // Handler for dealing cards with entropy
    const handleDealWithEntropy = useCallback(
        async (entropy: string) => {
            if (!tableId) return;

            await handleActionWithTransaction("deal", async () => {
                try {
                    const result = await dealCardsWithEntropy(tableId, network, entropy);
                    return result?.hash || null;
                } catch (error: any) {
                    console.error("Failed to deal:", error);
                    throw error;
                }
            });
        },
        [tableId, network, handleActionWithTransaction]
    );

    // Action handlers - use blind amounts directly from gameState (per Commandment 7: NO fallbacks)
    const handlePostSmallBlindAction = async () => {
        if (!tableId || smallBlindMicro === 0n) return;

        await handleActionWithTransaction("small-blind", async () => {
            return await handlePostSmallBlind(tableId, smallBlindMicro, network);
        });
    };

    const handlePostBigBlindAction = async () => {
        if (!tableId || bigBlindMicro === 0n) return;

        await handleActionWithTransaction("big-blind", async () => {
            return await handlePostBigBlind(tableId, bigBlindMicro, network);
        });
    };

    const handleBetAction = async () => {
        if (!tableId) return;
        const amountMicro = usdcToMicroBigInt(raiseAmount);

        await handleActionWithTransaction("bet", async () => {
            return await handleBet(amountMicro, tableId, network);
        });
    };

    const handleRaiseAction = async () => {
        if (!tableId) return;
        const amountMicro = usdcToMicroBigInt(raiseAmount);

        await handleActionWithTransaction("raise", async () => {
            return await handleRaise(tableId, amountMicro, network);
        });
    };

    // Calculate button visibility flags
    const { canFoldAnytime, showActionButtons, showSmallBlindButton, showBigBlindButton } = useMemo(() => {
        const showButtons = isUserInTable;
        const shouldShowSmallBlindButton = hasSmallBlindAction && isUsersTurn;
        const shouldShowBigBlindButton = hasBigBlindAction && isUsersTurn;

        return {
            canFoldAnytime: hasFoldAction && playerStatus !== PlayerStatus.FOLDED && showButtons,
            showActionButtons: isUsersTurn && legalActions && legalActions.length > 0 && showButtons,
            showSmallBlindButton: shouldShowSmallBlindButton && showButtons,
            showBigBlindButton: shouldShowBigBlindButton && showButtons
        };
    }, [hasSmallBlindAction, hasBigBlindAction, isUsersTurn, isUserInTable, hasFoldAction, playerStatus, legalActions]);

    // Increment/decrement handlers - always step by big blind amount
    const getStep = (): number => {
        return bigBlindUsdc > 0 ? bigBlindUsdc : (hasBetAction ? minBet : hasRaiseAction ? minRaise : 0);
    };

    const handleRaiseIncrement = () => {
        const step = getStep();
        const maxAmount = hasBetAction ? maxBet : maxRaise;
        setRaiseAmount((prev) => Math.min(prev + step, maxAmount));
    };

    const handleRaiseDecrement = () => {
        const step = getStep();
        const minAmount = hasBetAction ? minBet : minRaise;
        setRaiseAmount((prev) => Math.max(prev - step, minAmount));
    };

    const handleAllInAction = async () => {
        if (!tableId) return;
        const maxAmount = hasBetAction ? maxBet : maxRaise;
        const amountMicro = usdcToMicroBigInt(maxAmount);

        setRaiseAmount(maxAmount);
        await handleActionWithTransaction(
            hasRaiseAction ? "raise" : "bet",
            async () => hasRaiseAction
                ? await handleRaise(tableId, amountMicro, network)
                : await handleBet(amountMicro, tableId, network)
        );
    };

    return (
        <div
            className={`fixed left-0 right-0 text-white flex justify-center items-center relative ${
                isMobileLandscape ? "bottom-0 p-0.5" : "bottom-12 lg:bottom-1 p-2 lg:p-1 pb-4 lg:pb-1"
            }`}
        >
            <div
                className={`flex flex-col w-full justify-center rounded-lg relative z-10 ${
                    isMobileLandscape ? "mx-1 space-y-0.5 max-w-full" : "lg:w-[850px] mx-4 lg:mx-0 space-y-2 lg:space-y-3 max-w-full"
                }`}
            >
                {/* Deal Button Group */}
                {shouldShowDealButton && (
                    <DealButtonGroup
                        tableId={tableId}
                        onDeal={handleDealWithEntropy}
                        loading={loadingAction === "deal"}
                        disabled={!isUsersTurn}
                        autoDealEnabled={autoDealEnabled}
                    />
                )}

                {/* New Hand Button */}
                {gameState?.round === TexasHoldemRound.END && (
                    <div className="flex justify-center mb-2 lg:mb-3">
                        <ActionButton
                            action="new-hand"
                            label="START NEW HAND"
                            loading={loadingAction === "new-hand"}
                            onClick={() =>
                                handleActionWithTransaction("new-hand", () => handleStartNewHand(tableId, network))
                            }
                            variant="primary"
                            className="px-6 lg:px-8 py-2 lg:py-3 text-sm lg:text-base font-bold"
                        />
                    </div>
                )}

                {/* Only show other buttons if deal button is not showing */}
                {!hideOtherButtons && (
                    <>
                        {/* Showdown Buttons */}
                        {(hasMuckAction || hasShowAction) && (
                            <ShowdownButtons
                                canMuck={hasMuckAction}
                                canShow={hasShowAction}
                                loading={loadingAction}
                                onMuck={() => handleActionWithTransaction("muck", () => handleMuck(tableId, network))}
                                onShow={() => handleActionWithTransaction("show", () => handleShow(tableId, network))}
                            />
                        )}

                        {/* Blind Buttons */}
                        {(showSmallBlindButton || showBigBlindButton) && (
                            <BlindButtonGroup
                                showSmallBlind={showSmallBlindButton}
                                showBigBlind={showBigBlindButton}
                                smallBlindAmount={formattedSmallBlindAmount}
                                bigBlindAmount={formattedBigBlindAmount}
                                canFold={canFoldAnytime && (!showActionButtons || showSmallBlindButton || showBigBlindButton)}
                                playerStatus={userPlayer?.status || PlayerStatus.SEATED}
                                loading={loadingAction}
                                isMobileLandscape={isMobileLandscape}
                                onPostSmallBlind={handlePostSmallBlindAction}
                                onPostBigBlind={handlePostBigBlindAction}
                                onFold={() => handleActionWithTransaction("fold", () => handleFold(tableId, network))}
                            />
                        )}

                        {/* Main Action Buttons */}
                        {showActionButtons && !showSmallBlindButton && !showBigBlindButton && (
                            <>
                                <MainActionButtons
                                    canFold={canFoldAnytime}
                                    canCheck={hasCheckAction}
                                    canCall={hasCallAction}
                                    callAmount={formattedCallAmount}
                                    canBet={hasBetAction}
                                    canRaise={hasRaiseAction}
                                    raiseAmount={raiseAmount}
                                    isRaiseAmountInvalid={isRaiseAmountInvalid}
                                    playerStatus={userPlayer?.status || PlayerStatus.SEATED}
                                    loading={loadingAction}
                                    isAllIn={raiseAmount >= (hasBetAction ? maxBet : maxRaise)}
                                    isMobileLandscape={isMobileLandscape}
                                    currentRound={gameState?.round || TexasHoldemRound.ANTE}
                                    previousActions={gameState?.previousActions || []}
                                    userAddress={userAddress || ""}
                                    onFold={() => handleActionWithTransaction("fold", () => handleFold(tableId, network))}
                                    onCheck={() => handleActionWithTransaction("check", () => handleCheck(tableId, network))}
                                    onCall={() =>
                                        handleActionWithTransaction("call", () => handleCall(callAmountMicro, tableId, network))
                                    }
                                    onBetOrRaise={hasRaiseAction ? handleRaiseAction : handleBetAction}
                                />

                                {/* Raise/Bet Controls */}
                                {(hasBetAction || hasRaiseAction) && (
                                    <RaiseBetControls
                                        amount={raiseAmount}
                                        minAmount={hasBetAction ? minBet : minRaise}
                                        maxAmount={hasBetAction ? maxBet : maxRaise}
                                        formattedMaxAmount={formattedMaxBetAmount}
                                        step={getStep()}
                                        displayOffset={
                                            hasRaiseAction
                                                ? getRaiseToAmount(raiseAmount, gameState?.previousActions || [], gameState?.round || TexasHoldemRound.ANTE, userAddress || "") - raiseAmount
                                                : 0
                                        }
                                        totalPotMicro={totalPotMicro}
                                        callAmountMicro={callAmountMicro}
                                        isInvalid={isRaiseAmountInvalid}
                                        isMobileLandscape={isMobileLandscape}
                                        currentRound={gameState?.round || TexasHoldemRound.ANTE}
                                        previousActions={gameState?.previousActions || []}
                                        disabled={!isUsersTurn}
                                        onAmountChange={setRaiseAmount}
                                        onIncrement={handleRaiseIncrement}
                                        onDecrement={handleRaiseDecrement}
                                        onAllIn={handleAllInAction}
                                    />
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
