import React, { useState, useEffect, useMemo, useCallback } from "react";
import { NonPlayerActionType, PlayerActionType, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { hasContent, hasElements } from "../../utils/guards";
import { parseMicroToBigInt, microBigIntToUsdc, usdcToMicroBigInt } from "../../constants/currency";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { isTournamentFormat } from "../../utils/gameFormatUtils";
import {
    getActionFlags,
    getFormattedMaxBetAmount,
    getInitialRaiseAmount,
    getTotalPotMicro,
    getUserPlayer,
    isCappedAllInCall,
    isShortShoveRaise,
    validRaiseAmount
} from "../../utils/pockerActionUtils";
import { formatDisplayAmount } from "../../utils/numberUtils";

// Import hooks
import { useTableState, useNextToActInfo } from "../../hooks";
import { useActionSounds } from "../../hooks/notifications/useActionSounds";
import { usePlayerLegalActions } from "../../hooks/playerActions/usePlayerLegalActions";
import { useGameStateContext } from "../../context/GameStateContext";
import { useActionSubmit } from "../../context/ActionSubmitContext";
import { useGameSettings } from "../../context/GameSettingsContext";
import { dealCardsWithEntropy } from "../../hooks/playerActions/dealCards";
import { useAutoDeal } from "../../hooks/playerActions/useAutoDeal";
import { useAutoPostBlinds } from "../../hooks/playerActions/useAutoPostBlinds";
import { useAutoNewHand } from "../../hooks/playerActions/useAutoNewHand";
import { useAutoFold } from "../../hooks/playerActions/useAutoFold";
import { usePreCheck } from "../../hooks/playerActions/usePreCheck";
import { usePlayerTimer } from "../../hooks/player/usePlayerTimer";
import { useAutoShowCards } from "../../hooks/playerActions/useAutoShowCards";
import { useAutoMuck } from "../../hooks/playerActions/useAutoMuck";

// Import raw action hooks — these THROW on failure (unlike the handle* wrappers
// in actionHandlers, which swallow errors). Submission goes through the
// ActionSubmitController, which owns dedupe / serialize / retry / error toasts.
import { betHand } from "../../hooks/playerActions/betHand";
import { callHand } from "../../hooks/playerActions/callHand";
import { checkHand } from "../../hooks/playerActions/checkHand";
import { foldHand } from "../../hooks/playerActions/foldHand";
import { muckCards } from "../../hooks/playerActions/muckCards";
import { showCards } from "../../hooks/playerActions/showCards";
import { raiseHand } from "../../hooks/playerActions/raiseHand";
import { postSmallBlind } from "../../hooks/playerActions/postSmallBlind";
import { postBigBlind } from "../../hooks/playerActions/postBigBlind";
import { startNewHand } from "../../hooks/playerActions/startNewHand";
import type { PlayerActionResult } from "../../types";

// Import utils
import { getActionByType } from "../../utils/actionUtils";
import { getRaiseToAmount } from "../../utils/raiseUtils";
import { getViewportMode } from "../../config/stageGeometry";

// Import sub-components
import { ActionButton } from "./ActionButton";
import { DealButtonGroup } from "./DealButtonGroup";
import { ShowdownButtons } from "./ShowdownButtons";
import { BlindButtonGroup } from "./BlindButtonGroup";
import { MainActionButtons } from "./MainActionButtons";
import { RaiseBetControls } from "./RaiseBetControls";
import { PreCheckControl } from "./PreCheckControl";
import { isCheckFreeForPlayer } from "../../utils/chipUtils";

// Import types
import type { PokerActionPanelProps } from "./types";

export const PokerActionPanel: React.FC<PokerActionPanelProps> = ({ tableId, network, onTransactionSubmitted }) => {
    // Manual button submission goes through the ActionSubmitController, which
    // owns dedupe, serialization, the safe transport retry, the confirmation
    // gate (busy stays until the chain advances a signal — ui#364/#440), the
    // 8s escape-hatch, and centralized error toasts. `submitLoadingAction` is
    // the in-flight manual action's label.
    const { submit, loadingAction: submitLoadingAction } = useActionSubmit();

    // Auto-action hooks (auto-fold/deal/blinds/new-hand/show/muck) still manage
    // their own submission + self-clear via their callbacks; we merge their
    // loading label with the controller's so buttons show a single spinner.
    const [autoLoadingAction, setAutoLoadingAction] = useState<string | null>(null);
    const loadingAction = submitLoadingAction ?? autoLoadingAction;

    // Action sounds
    const { playActionSound } = useActionSounds();

    // Detect mobile landscape orientation
    const [isMobileLandscape, setIsMobileLandscape] = useState(getViewportMode() === "mobile-landscape");

    useEffect(() => {
        const checkOrientation = () => {
            setIsMobileLandscape(getViewportMode() === "mobile-landscape");
        };

        window.addEventListener("resize", checkOrientation);
        window.addEventListener("orientationchange", checkOrientation);

        return () => {
            window.removeEventListener("resize", checkOrientation);
            window.removeEventListener("orientationchange", checkOrientation);
        };
    }, []);

    // Get game state and player data
    const { gameState, gameFormat } = useGameStateContext();
    const isTournament = isTournamentFormat(gameFormat);
    const players = gameState?.players || null;
    const { legalActions, isPlayerTurn, playerStatus } = usePlayerLegalActions();
    const { totalPot } = useTableState();
    const totalPotMicro = useMemo(() => getTotalPotMicro(totalPot), [totalPot]);

    // Read reactive game settings from context
    const {
        autoDeal: autoDealEnabled,
        autoPostBlinds: autoPostBlindsEnabled,
        autoNewHand: autoNewHandEnabled,
        autoFold: autoFoldEnabled,
        preCheck: preCheckEnabled,
        autoMuck: autoMuckEnabled,
        playerActionSounds
    } = useGameSettings();

    // Get user address
    const userAddress = useMemo(() => localStorage.getItem(STORAGE_KEYS.cosmosAddress)?.toLowerCase(), []);

    // Get user player
    const userPlayer = useMemo(() => getUserPlayer(players, userAddress), [players, userAddress]);

    // Determine if it's user's turn
    const isUsersTurn = isPlayerTurn;

    // Check available actions
    const {
        hasSmallBlindAction,
        hasBigBlindAction,
        hasFoldAction,
        hasCheckAction,
        hasCallAction,
        hasBetAction,
        hasRaiseAction,
        hasMuckAction,
        hasShowAction,
        hasDealAction
    } = getActionFlags(legalActions);

    // Blind amounts - single source of truth from gameState.gameOptions (per Commandment 7)
    // Defined early so they can be used in useAutoPostBlinds hook
    const smallBlindMicro = useMemo(() => parseMicroToBigInt(gameState?.gameOptions?.smallBlind), [gameState?.gameOptions?.smallBlind]);

    const bigBlindMicro = useMemo(() => parseMicroToBigInt(gameState?.gameOptions?.bigBlind), [gameState?.gameOptions?.bigBlind]);

    // Auto-deal hook - automatically triggers deal when conditions are met
    // Can be disabled via URL query param: ?autodeal=false or via settings panel
    useAutoDeal(
        tableId,
        network,
        hasDealAction,
        isUsersTurn,
        () => setAutoLoadingAction("deal"), // onDealStarted
        txHash => {
            setAutoLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onDealComplete
        () => setAutoLoadingAction(null), // onDealError
        autoDealEnabled
    );

    // Auto-post blinds hook - automatically posts small/big blind when conditions are met
    // Can be disabled via URL query param: ?autoblinds=false or via settings panel
    useAutoPostBlinds(
        tableId,
        network,
        hasSmallBlindAction,
        hasBigBlindAction,
        smallBlindMicro,
        bigBlindMicro,
        isUsersTurn,
        blindType => setAutoLoadingAction(blindType === "small" ? "small-blind" : "big-blind"), // onBlindStarted
        (blindType, txHash) => {
            setAutoLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onBlindComplete
        () => setAutoLoadingAction(null), // onBlindError
        autoPostBlindsEnabled
    );

    // Get timer data for the current user's seat (used by auto-fold)
    const { timeRemaining } = usePlayerTimer(tableId, userPlayer?.seat);

    // Auto-fold hook - automatically folds (or checks) when the action timer expires
    // Can be disabled via URL query param: ?autofold=false or via settings panel
    useAutoFold(
        tableId,
        network,
        hasFoldAction,
        hasCheckAction,
        isUsersTurn,
        timeRemaining,
        action => setAutoLoadingAction(action), // onAutoActionStarted
        (action, txHash) => {
            setAutoLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onAutoActionComplete
        () => setAutoLoadingAction(null), // onAutoActionError
        autoFoldEnabled
    );

    // Pre-select "Check" (ui#388): before it's the player's turn, if checking
    // would be free, offer a box that auto-checks the instant action reaches them.
    // Ephemeral per-round intent — NOT a persisted setting.
    const [preCheckQueued, setPreCheckQueued] = useState(false);

    // "Checking is free for me right now": no one has out-committed me this round
    // (blind-aware — the preflop BB stays check-free until a raise).
    const facingNoBet = useMemo(
        () => isCheckFreeForPlayer(players, userAddress, gameState?.round, gameState?.previousActions ?? []),
        [players, userAddress, gameState?.round, gameState?.previousActions]
    );

    // Offer the control only while the feature is enabled (URL/settings toggle,
    // default on), seated in the hand, not to act, and check-free.
    const showPreCheck = preCheckEnabled && !isUsersTurn && playerStatus === PlayerStatus.ACTIVE && facingNoBet;

    // Clear the queued intent only when the player genuinely leaves the hand
    // (folded / busted / sat out). We deliberately do NOT clear on a transient
    // `facingNoBet` dip: the paced rendered track churns between snapshots as the
    // opponent acts, and clearing on those transients was unticking the box
    // mid-street before the player's turn arrived (heads-up #388 flicker). If a
    // real bet lands, `showPreCheck` already hides the box (facingNoBet=false) and
    // usePreCheck re-checks CHECK legality at fire time, so it can never fold — no
    // clear needed here for the bet case.
    useEffect(() => {
        if (preCheckQueued && playerStatus !== PlayerStatus.ACTIVE) {
            setPreCheckQueued(false);
        }
    }, [preCheckQueued, playerStatus]);

    // A queued pre-check is scoped to the current betting round only: it resets at
    // the start of each street (the user re-ticks per street — the agreed UX).
    useEffect(() => {
        setPreCheckQueued(false);
    }, [gameState?.round]);

    usePreCheck(
        tableId,
        network,
        preCheckQueued && preCheckEnabled,
        hasCheckAction,
        isUsersTurn,
        () => setAutoLoadingAction("check"), // onStarted
        txHash => {
            setAutoLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onComplete
        () => setAutoLoadingAction(null), // onError
        () => setPreCheckQueued(false) // onResolved
    );

    // Auto-show-cards hook - automatically shows cards when the action timer expires
    useAutoShowCards(
        tableId,
        network,
        hasShowAction,
        isUsersTurn,
        timeRemaining,
        () => setAutoLoadingAction("show"), // onAutoShowStarted
        txHash => {
            setAutoLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onAutoShowComplete
        () => setAutoLoadingAction(null) // onAutoShowError
    );

    // Auto-muck hook - automatically mucks cards at showdown when enabled in settings
    useAutoMuck(
        tableId,
        network,
        hasMuckAction,
        isUsersTurn,
        () => setAutoLoadingAction("muck"), // onAutoMuckStarted
        txHash => {
            setAutoLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onAutoMuckComplete
        () => setAutoLoadingAction(null), // onAutoMuckError
        autoMuckEnabled
    );

    // Auto-new-hand hook - automatically triggers new hand when conditions are met
    // Can be disabled via URL query param: ?autonewhand=false or via settings panel.
    // Its trigger inputs (hasNewHandAction / isUsersTurn) are derived internally
    // from the LOGICAL track so the deal is never delayed by the rendered
    // showdown hold (see useAutoNewHand).
    const { isDealingNewHand } = useAutoNewHand(
        tableId,
        network,
        () => setAutoLoadingAction("new-hand"), // onNewHandStarted
        txHash => {
            setAutoLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onNewHandComplete
        () => setAutoLoadingAction(null), // onNewHandError
        autoNewHandEnabled
    );

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

    // Convert to display values — USDC conversion for cash, raw chips for tournaments
    const toDisplay = useCallback((micro: bigint) => (isTournament ? Number(micro) : microBigIntToUsdc(micro)), [isTournament]);
    // Convert display values back to chain units — raw bigint for tournaments, ×10^6 for cash
    const fromDisplay = useCallback((display: number) => (isTournament ? BigInt(Math.floor(display)) : usdcToMicroBigInt(display)), [isTournament]);
    const minBet = useMemo(() => toDisplay(minBetMicro), [toDisplay, minBetMicro]);
    const maxBet = useMemo(() => toDisplay(maxBetMicro), [toDisplay, maxBetMicro]);
    const minRaise = useMemo(() => toDisplay(minRaiseMicro), [toDisplay, minRaiseMicro]);
    const maxRaise = useMemo(() => toDisplay(maxRaiseMicro), [toDisplay, maxRaiseMicro]);
    const callAmount = useMemo(() => toDisplay(callAmountMicro), [toDisplay, callAmountMicro]);

    // Formatted amounts for display (blind amounts defined earlier for use in hooks)
    const formattedSmallBlindAmount = useMemo(() => formatDisplayAmount(toDisplay(smallBlindMicro), isTournament), [toDisplay, smallBlindMicro, isTournament]);
    const formattedBigBlindAmount = useMemo(() => formatDisplayAmount(toDisplay(bigBlindMicro), isTournament), [toDisplay, bigBlindMicro, isTournament]);
    const bigBlindUsdc = useMemo(() => toDisplay(bigBlindMicro), [toDisplay, bigBlindMicro]);
    const formattedCallAmount = useMemo(() => formatDisplayAmount(callAmount, isTournament), [callAmount, isTournament]);

    // All-in as a FE label (poker-vm#2351/#2353). The engine never advertises an
    // ALL_IN action; a whole-stack commit arrives as a normal legal action whose
    // `max` equals the stack. Two shapes need FE handling:
    //   - Short-shove RAISE {min:stack,max:stack}: a min===max range breaks the
    //     bet slider, so render a dedicated ALL-IN button that dispatches
    //     RAISE(stack) and suppress the normal raise button + slider.
    //   - Capped all-in CALL (facing a bet >= stack, no raise): the normal CALL
    //     button already commits the whole stack — just relabel it "Call (All-In)".
    const stackMicro = useMemo(() => parseMicroToBigInt(userPlayer?.stack), [userPlayer?.stack]);
    const shortShoveRaise = useMemo(() => isShortShoveRaise(legalActions, stackMicro), [legalActions, stackMicro]);
    const callIsAllIn = useMemo(() => isCappedAllInCall(legalActions, stackMicro), [legalActions, stackMicro]);
    const formattedAllInAmount = useMemo(() => formatDisplayAmount(toDisplay(stackMicro), isTournament), [toDisplay, stackMicro, isTournament]);
    const formattedMaxBetAmount = useMemo(
        () => getFormattedMaxBetAmount(hasBetAction, maxBet, maxRaise, isTournament),
        [hasBetAction, maxBet, maxRaise, isTournament]
    );

    // Raise amount state
    const initialAmount = getInitialRaiseAmount(hasBetAction, minBet, minRaise);
    const [raiseAmount, setRaiseAmount] = useState<number>(initialAmount);

    // Validation
    const isRaiseAmountInvalid = validRaiseAmount(raiseAmount, hasRaiseAction, hasBetAction, minRaise, maxRaise, minBet, maxBet);

    // Update raise amount when actions become available
    useEffect(() => {
        if (hasRaiseAction && minRaise > 0) {
            setRaiseAmount(minRaise);
        } else if (hasBetAction && minBet > 0) {
            setRaiseAmount(minBet);
        }
    }, [hasRaiseAction, hasBetAction, minRaise, minBet]);

    // Submit a manual action through the controller. It plays the action sound,
    // then hands off: the controller dedupes double-clicks, serializes, retries
    // transport errors safely, holds the spinner until the chain confirms a
    // signal (ui#364/#440), runs the 8s escape-hatch, and toasts any failure.
    // Callers just describe the action and how to run it (the raw hook throws
    // on failure, so the controller can classify it).
    const submitAction = useCallback(
        (actionName: string, run: () => Promise<PlayerActionResult>, playSound = true) => {
            if (playSound && playerActionSounds) {
                playActionSound(actionName);
            }
            submit({ actionName, run, onSuccess: onTransactionSubmitted });
        },
        [submit, onTransactionSubmitted, playActionSound, playerActionSounds]
    );

    // Handler for dealing cards with entropy. Async to satisfy DealButtonGroup's
    // onDeal signature, though submission itself is fire-and-forget.
    const handleDealWithEntropy = useCallback(
        async (entropy: string): Promise<void> => {
            submitAction("deal", () => dealCardsWithEntropy(tableId, network, entropy));
        },
        [tableId, network, submitAction]
    );

    // Action handlers - use blind amounts directly from gameState (per Commandment 7: NO fallbacks)
    const handlePostSmallBlindAction = () => {
        if (smallBlindMicro === 0n) return;
        submitAction("small-blind", () => postSmallBlind(tableId, smallBlindMicro, network));
    };

    const handlePostBigBlindAction = () => {
        if (bigBlindMicro === 0n) return;
        submitAction("big-blind", () => postBigBlind(tableId, bigBlindMicro, network));
    };

    const handleBetAction = () => {
        const amountMicro = fromDisplay(raiseAmount);
        submitAction("bet", () => betHand(tableId, amountMicro, network));
    };

    const handleRaiseAction = () => {
        const amountMicro = fromDisplay(raiseAmount);
        submitAction("raise", () => raiseHand(tableId, amountMicro, network));
    };

    const handleFoldAction = () => submitAction("fold", () => foldHand(tableId, network));
    const handleCheckAction = () => submitAction("check", () => checkHand(tableId, network));
    const handleCallAction = () => submitAction("call", () => callHand(tableId, callAmountMicro, network));
    const handleMuckAction = () => submitAction("muck", () => muckCards(tableId, network));
    const handleShowAction = () => submitAction("show", () => showCards(tableId, network));
    const handleNewHandAction = () => submitAction("new-hand", () => startNewHand(tableId, network));

    // Calculate button visibility flags
    const { canFoldAnytime, showActionButtons, showSmallBlindButton, showBigBlindButton } = useMemo(() => {
        const showButtons = !!userPlayer;
        const shouldShowSmallBlindButton = hasSmallBlindAction && isUsersTurn;
        const shouldShowBigBlindButton = hasBigBlindAction && isUsersTurn;

        return {
            canFoldAnytime: hasFoldAction && playerStatus !== PlayerStatus.FOLDED && showButtons,
            showActionButtons: isUsersTurn && hasElements(legalActions) && showButtons,
            showSmallBlindButton: shouldShowSmallBlindButton && showButtons,
            showBigBlindButton: shouldShowBigBlindButton && showButtons
        };
    }, [hasSmallBlindAction, hasBigBlindAction, isUsersTurn, userPlayer, hasFoldAction, playerStatus, legalActions]);

    // Increment/decrement handlers - always step by big blind amount
    const getStep = (): number => {
        return bigBlindUsdc > 0 ? bigBlindUsdc : hasBetAction ? minBet : hasRaiseAction ? minRaise : 0;
    };

    const handleRaiseIncrement = () => {
        const step = getStep();
        const maxAmount = hasBetAction ? maxBet : maxRaise;
        setRaiseAmount(prev => Math.min(prev + step, maxAmount));
    };

    const handleRaiseDecrement = () => {
        const step = getStep();
        const minAmount = hasBetAction ? minBet : minRaise;
        setRaiseAmount(prev => Math.max(prev - step, minAmount));
    };

    const handleAllInAction = () => {
        const maxAmount = hasBetAction ? maxBet : maxRaise;
        setRaiseAmount(maxAmount);

        if (import.meta.env.VITE_ALL_IN_INSTANT_EXECUTE !== "true") return;

        if (!hasContent(tableId)) return;
        const amountMicro = fromDisplay(maxAmount);
        if (playerActionSounds) {
            playActionSound("all-in");
        }
        // Sound already played above; skip the controller's default sound.
        submitAction(
            hasRaiseAction ? "raise" : "bet",
            () => (hasRaiseAction ? raiseHand(tableId, amountMicro, network) : betHand(tableId, amountMicro, network)),
            false
        );
    };

    // Short-shove ALL-IN: dispatch the all-in-only RAISE for the whole stack (the
    // real legal action — no ALL_IN dispatch). Commits immediately; there is no
    // amount to stage. (poker-vm#2353, ui#457)
    const handleShortShoveAllInAction = () => {
        if (!hasContent(tableId)) return;
        if (playerActionSounds) {
            playActionSound("all-in");
        }
        submitAction("raise", () => raiseHand(tableId, stackMicro, network), false);
    };

    return (
        <div
            className={`fixed left-0 right-0 text-white flex justify-center items-center relative ${
                isMobileLandscape ? "bottom-0 p-0.5" : "bottom-12 lg:bottom-1 p-2 lg:p-1 pb-4 lg:pb-1"
            }`}
        >
            <div
                className={`flex flex-col w-full justify-center rounded-lg relative z-10 ${
                    isMobileLandscape ? "mx-1 space-y-0.5 max-w-full" : "lg:w-[570px] mx-4 lg:mx-0 space-y-2 lg:space-y-3 max-w-full"
                }`}
            >
                {/* Pre-select "Check" (ui#388) — offered when it's not your turn
                    and checking is currently free; auto-checks on your turn, and
                    clears itself the moment a bet lands. */}
                {showPreCheck && (
                    <PreCheckControl
                        checked={preCheckQueued}
                        onChange={setPreCheckQueued}
                        isMobileLandscape={isMobileLandscape}
                    />
                )}

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

                {/* New Hand Button - hidden when auto-new-hand is enabled */}
                {gameState?.round === TexasHoldemRound.END && !autoNewHandEnabled && (
                    <div className="flex justify-center mb-2 lg:mb-3">
                        <ActionButton
                            action="new-hand"
                            label="START NEW HAND"
                            loading={loadingAction === "new-hand"}
                            onClick={handleNewHandAction}
                            variant="primary"
                            className="px-6 lg:px-8 py-2 lg:py-3 text-sm lg:text-base font-bold"
                        />
                    </div>
                )}

                {/* Auto-new-hand: hold on the showdown for a beat, showing a
                    "Dealing hand #X…" indicator before the next hand deals (ui#443) */}
                {autoNewHandEnabled && isDealingNewHand && (
                    <div className="flex justify-center mb-2 lg:mb-3">
                        <ActionButton
                            action="new-hand"
                            label={`Dealing hand #${(gameState?.handNumber ?? 0) + 1}`}
                            loading={true}
                            disabled={true}
                            onClick={() => {}}
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
                                onMuck={handleMuckAction}
                                onShow={handleShowAction}
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
                                isTournament={isTournament}
                                onPostSmallBlind={handlePostSmallBlindAction}
                                onPostBigBlind={handlePostBigBlindAction}
                                onFold={handleFoldAction}
                            />
                        )}

                        {/* Main Action Buttons */}
                        {showActionButtons && !showSmallBlindButton && !showBigBlindButton && (
                            <>
                                <MainActionButtons
                                    canFold={canFoldAnytime}
                                    canCheck={hasCheckAction}
                                    // Defensive guard for #2152: never offer CALL to an ALL_IN
                                    // player. The engine doesn't emit CALL in this case, but a
                                    // stale legalActions render (optimistic-update desync, mid-
                                    // tx flicker) could otherwise paint a "CALL $0.00" button.
                                    canCall={hasCallAction && userPlayer?.status !== PlayerStatus.ALL_IN}
                                    callAmount={formattedCallAmount}
                                    // Capped all-in call: the CALL commits the whole stack — relabel it.
                                    callIsAllIn={callIsAllIn}
                                    canBet={hasBetAction}
                                    // Short-shove RAISE is an all-in-only range; the dedicated ALL-IN
                                    // button handles it, so suppress the normal (slider-driven) raise.
                                    canRaise={hasRaiseAction && !shortShoveRaise}
                                    raiseAmount={raiseAmount}
                                    isRaiseAmountInvalid={isRaiseAmountInvalid}
                                    playerStatus={userPlayer?.status || PlayerStatus.SEATED}
                                    loading={loadingAction}
                                    isAllIn={raiseAmount >= (hasBetAction ? maxBet : maxRaise)}
                                    isMobileLandscape={isMobileLandscape}
                                    currentRound={gameState?.round || TexasHoldemRound.ANTE}
                                    previousActions={gameState?.previousActions || []}
                                    userAddress={userAddress || ""}
                                    isTournament={isTournament}
                                    canAllIn={shortShoveRaise}
                                    allInAmount={formattedAllInAmount}
                                    onFold={handleFoldAction}
                                    onCheck={handleCheckAction}
                                    onCall={handleCallAction}
                                    onBetOrRaise={hasRaiseAction ? handleRaiseAction : handleBetAction}
                                    onAllIn={handleShortShoveAllInAction}
                                />

                                {/* Raise/Bet Controls — hidden for a short-shove RAISE, whose
                                    all-in-only (min===max) range would render a degenerate slider;
                                    the dedicated ALL-IN button drives that shove instead. */}
                                {(hasBetAction || hasRaiseAction) && !shortShoveRaise && (
                                    <RaiseBetControls
                                        amount={raiseAmount}
                                        minAmount={hasBetAction ? minBet : minRaise}
                                        maxAmount={hasBetAction ? maxBet : maxRaise}
                                        formattedMaxAmount={formattedMaxBetAmount}
                                        step={getStep()}
                                        displayOffset={
                                            hasRaiseAction
                                                ? getRaiseToAmount(
                                                      raiseAmount,
                                                      gameState?.previousActions || [],
                                                      gameState?.round || TexasHoldemRound.ANTE,
                                                      userAddress || "",
                                                      isTournament
                                                  ) - raiseAmount
                                                : 0
                                        }
                                        totalPotMicro={totalPotMicro}
                                        callAmountMicro={callAmountMicro}
                                        isInvalid={isRaiseAmountInvalid}
                                        isMobileLandscape={isMobileLandscape}
                                        isTournament={isTournament}
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
