import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { NonPlayerActionType, PlayerActionType, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { hasContent, hasElements, isNullish } from "../../utils/guards";
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
import { useActionHaptics } from "../../hooks/notifications/useActionHaptics";
import { usePlayerLegalActions } from "../../hooks/playerActions/usePlayerLegalActions";
import { useActionAck } from "../../hooks/playerActions/useActionAck";
import { nextActionIndex } from "../../hooks/playerActions/transportAction";
import { useGameStateContext } from "../../context/GameStateContext";
import { useGameSettings } from "../../context/GameSettingsContext";
import { dealCardsWithEntropy } from "../../hooks/playerActions/dealCards";
import { useAutoDeal } from "../../hooks/playerActions/useAutoDeal";
import { useAutoPostBlinds } from "../../hooks/playerActions/useAutoPostBlinds";
import { useAutoNewHand } from "../../hooks/playerActions/useAutoNewHand";
import { useAutoFold } from "../../hooks/playerActions/useAutoFold";
import { usePlayerTimer } from "../../hooks/player/usePlayerTimer";
import { useAutoShowCards } from "../../hooks/playerActions/useAutoShowCards";
import { useAutoMuck } from "../../hooks/playerActions/useAutoMuck";

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
import { ActionAckPill } from "./ActionAckPill";

// Import types
import type { PokerActionPanelProps } from "./types";

export const PokerActionPanel: React.FC<PokerActionPanelProps> = ({ tableId, network, onTransactionSubmitted }) => {
    // Loading state for actions
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    // "Dirty" tracker for the gap between SDK SYNC return (~50ms) and the
    // WS push delivering the committed state (~5s). We capture the chain's
    // actionCount at submit time and keep loadingAction set until the chain
    // says "I processed your action" by advancing past that number. Without
    // this, the button stops spinning ~50ms after click but the panel sits
    // with stale legalActions for the rest of the block budget, letting the
    // player re-click the same action. See block52/ui#364.
    //
    // pendingHandNumber is the safety net for actions that complete the hand
    // (last action on the river, fold that ends a heads-up hand, etc). On
    // those, actionCount may reset for the new hand so `current > pending`
    // never becomes true and the spinner was stuck until the 8s timeout
    // escape hatch — visible as "previous round's spinner still spinning
    // in the next round". A handNumber bump is the canonical "new hand
    // started" signal and implies our action was committed (otherwise the
    // new hand wouldn't exist).
    const [pendingActionCount, setPendingActionCount] = useState<number | null>(null);
    const [pendingHandNumber, setPendingHandNumber] = useState<number | null>(null);

    // Gateway transport: the engine's actionCount does NOT advance in
    // gateway states (stays 0), so the actionCount watcher never fires and
    // every action rode the timeout (ui#440 live-testing). The table's
    // shared next-action index (any player's legalActions[].index) advances
    // on every applied action on BOTH transports — watch it too.
    const [pendingActionIndex, setPendingActionIndex] = useState<number | null>(null);

    // How long to wait for the chain to confirm before re-enabling the
    // button anyway. Generous enough to survive a slow WS / 5s commit
    // window, tight enough that a genuinely stuck state recovers within
    // the player's per-turn timeout budget.
    const DIRTY_STATE_TIMEOUT_MS = 8000;

    // Action sounds
    const { playActionSound } = useActionSounds();
    // Press-time haptic tick (Approach A) — gated on the actionHaptics setting.
    const { vibrate } = useActionHaptics();
    // Action-acknowledgement pill phase machine (Approach A). begin() at submit,
    // confirm() from the same watcher that clears the dirty state, fail() from
    // the catch / timeout.
    const {
        phase: ackPhase,
        label: ackLabel,
        variant: ackVariant,
        begin: beginAck,
        confirm: confirmAck,
        fail: failAck,
        clear: clearAck
    } = useActionAck();

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
        autoMuck: autoMuckEnabled,
        playerActionSounds,
        actionHaptics
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
        () => setLoadingAction("deal"), // onDealStarted
        txHash => {
            setLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onDealComplete
        () => setLoadingAction(null), // onDealError
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
        blindType => setLoadingAction(blindType === "small" ? "small-blind" : "big-blind"), // onBlindStarted
        (blindType, txHash) => {
            setLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onBlindComplete
        () => setLoadingAction(null), // onBlindError
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
        action => setLoadingAction(action), // onAutoActionStarted
        (action, txHash) => {
            setLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onAutoActionComplete
        () => setLoadingAction(null), // onAutoActionError
        autoFoldEnabled
    );

    // Auto-show-cards hook - automatically shows cards when the action timer expires
    useAutoShowCards(
        tableId,
        network,
        hasShowAction,
        isUsersTurn,
        timeRemaining,
        () => setLoadingAction("show"), // onAutoShowStarted
        txHash => {
            setLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onAutoShowComplete
        () => setLoadingAction(null) // onAutoShowError
    );

    // Auto-muck hook - automatically mucks cards at showdown when enabled in settings
    useAutoMuck(
        tableId,
        network,
        hasMuckAction,
        isUsersTurn,
        () => setLoadingAction("muck"), // onAutoMuckStarted
        txHash => {
            setLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onAutoMuckComplete
        () => setLoadingAction(null), // onAutoMuckError
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
        () => setLoadingAction("new-hand"), // onNewHandStarted
        txHash => {
            setLoadingAction(null);
            if (onTransactionSubmitted) {
                onTransactionSubmitted(txHash);
            }
        }, // onNewHandComplete
        () => setLoadingAction(null), // onNewHandError
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

    // Helper function to wrap action handlers with loading state.
    // The spinner stays on until ONE of:
    //   - chain advances actionCount past the value captured at submit
    //     (see the watcher useEffect below — canonical confirmation)
    //   - DIRTY_STATE_TIMEOUT_MS elapses (escape hatch useEffect below)
    //   - actionFn() throws (CheckTx rejected — clear immediately so the
    //     user can retry)
    // We intentionally do NOT clear in a `finally` after a successful
    // SDK return: with SYNC broadcast that fires ~50ms after click,
    // which used to be ~5s under BLOCK broadcast — leaving the button
    // re-enabled while the panel still showed stale legalActions.
    // block52/ui#364.
    const handleActionWithTransaction = useCallback(
        async (actionName: string, actionFn: () => Promise<string | null>, skipActionSound = false, ackAmountText?: string) => {
            const submittedAt = gameState?.actionCount ?? 0;
            const submittedAtHand = gameState?.handNumber ?? null;
            try {
                setLoadingAction(actionName);
                setPendingActionCount(submittedAt);
                setPendingHandNumber(submittedAtHand);
                setPendingActionIndex(nextActionIndex(gameState));
                // Acknowledgement pill: the receipt starts at click and is
                // confirmed by the same watcher that clears loadingAction, so
                // the fast path can't flash-and-vanish. No-op for actions
                // without ack copy (deal/new-hand).
                beginAck(actionName, ackAmountText);
                if (!skipActionSound && playerActionSounds) {
                    playActionSound(actionName);
                }
                if (actionHaptics) {
                    vibrate(10);
                }
                const txHash = await actionFn();
                if (txHash && onTransactionSubmitted) {
                    onTransactionSubmitted(txHash);
                }
                // Success path: let the watcher useEffect clear when the
                // chain confirms via actionCount, or the timeout fires.
            } catch (error) {
                console.error(`Error executing ${actionName}:`, error);
                setLoadingAction(null);
                setPendingActionCount(null);
                setPendingHandNumber(null);
                setPendingActionIndex(null);
                // §2: the handler factories now rethrow instead of swallowing to
                // null, so this catch finally fires for real transport failures
                // (gateway 422, CheckTx reject, network error). Flip the pill to
                // "failed" and tell the player why, instead of an 8s dead spinner.
                failAck();
                toast.error(error instanceof Error ? error.message : "Action failed — please try again");
                throw error;
            }
        },
        [gameState?.actionCount, gameState?.handNumber, onTransactionSubmitted, playActionSound, playerActionSounds, actionHaptics, vibrate, beginAck, failAck]
    );

    // Canonical clear: the backend advanced past the point at which we
    // submitted. Three composable signals — ANY one suffices:
    //   - actionCount advanced (chain, mid-hand — #364)
    //   - shared next-action index advanced (gateway, where actionCount
    //     never moves — ui#440)
    //   - handNumber advanced (hand-boundary actions, where actionCount
    //     resets so `>` never fires — this PR)
    useEffect(() => {
        if (isNullish(pendingActionCount) && isNullish(pendingActionIndex) && isNullish(pendingHandNumber)) return;
        const currentCount = gameState?.actionCount;
        const currentHand = gameState?.handNumber;
        const countAdvanced = !isNullish(pendingActionCount) && !isNullish(currentCount) && currentCount > pendingActionCount;
        const indexAdvanced = !isNullish(pendingActionIndex) && nextActionIndex(gameState) > pendingActionIndex;
        const handAdvanced = !isNullish(pendingHandNumber) && !isNullish(currentHand) && currentHand > pendingHandNumber;
        if (countAdvanced || indexAdvanced || handAdvanced) {
            setLoadingAction(null);
            setPendingActionCount(null);
            setPendingActionIndex(null);
            setPendingHandNumber(null);
            // Drive the pill's "confirmed" flash off the exact signal that
            // ends the dirty state — no separate reconciliation. No-op if the
            // pill isn't in its "sending" phase (e.g. deal/new-hand).
            confirmAck();
        }
    }, [gameState, pendingActionCount, pendingActionIndex, pendingHandNumber, confirmAck]);

    // Escape hatch: WS push never arrived (chain stalled, WS disconnect,
    // or — rare — CheckTx passed but DeliverTx rejected so actionCount
    // never advanced). After DIRTY_STATE_TIMEOUT_MS, re-enable the button
    // so the user can try again.
    useEffect(() => {
        if (isNullish(pendingActionCount)) return;
        const t = setTimeout(() => {
            console.warn(
                `[action] no confirmation within ${DIRTY_STATE_TIMEOUT_MS}ms ` +
                    `for actionCount=${pendingActionCount}; clearing dirty state.`,
            );
            setLoadingAction(null);
            setPendingActionCount(null);
            setPendingHandNumber(null);
            setPendingActionIndex(null);
            // No confirmation ever arrived — turn the pill red so the player
            // knows to retry (the buttons return with the dirty-state clear).
            failAck();
        }, DIRTY_STATE_TIMEOUT_MS);
        return () => clearTimeout(t);
    }, [pendingActionCount, failAck]);

    // Heads-up back-to-back turns: if the player is facing a fresh betting
    // decision while the confirmed receipt is still holding, drop it immediately
    // so the pill never delays the next street's buttons out of the footer slot.
    // Gated on an actual actionable legal action (not the end-of-hand / new-hand
    // pseudo-turn) so the "✓" payoff still shows after a hand-ending fold.
    const facingActionDecision = isUsersTurn && (hasFoldAction || hasCheckAction || hasCallAction || hasBetAction || hasRaiseAction);
    useEffect(() => {
        if (ackPhase === "confirmed" && facingActionDecision) {
            clearAck();
        }
    }, [ackPhase, facingActionDecision, clearAck]);

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
        const amountMicro = fromDisplay(raiseAmount);
        const betText = formatDisplayAmount(raiseAmount, isTournament);

        await handleActionWithTransaction(
            "bet",
            async () => {
                return await handleBet(amountMicro, tableId, network);
            },
            false,
            betText
        );
    };

    const handleRaiseAction = async () => {
        if (!tableId) return;
        const amountMicro = fromDisplay(raiseAmount);
        // Match the "RAISE TO $X" figure shown on the button (blinds posted in
        // ANTE fold into the preflop total), so the pill reads the same number.
        const raiseToDisplay = getRaiseToAmount(
            raiseAmount,
            gameState?.previousActions || [],
            gameState?.round || TexasHoldemRound.ANTE,
            userAddress || "",
            isTournament
        );
        const raiseToText = formatDisplayAmount(raiseToDisplay, isTournament);

        await handleActionWithTransaction(
            "raise",
            async () => {
                return await handleRaise(tableId, amountMicro, network);
            },
            false,
            raiseToText
        );
    };

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

    const handleAllInAction = async () => {
        const maxAmount = hasBetAction ? maxBet : maxRaise;
        setRaiseAmount(maxAmount);

        if (import.meta.env.VITE_ALL_IN_INSTANT_EXECUTE !== "true") return;

        if (!hasContent(tableId)) return;
        const amountMicro = fromDisplay(maxAmount);
        if (playerActionSounds) {
            playActionSound("all-in");
        }
        await handleActionWithTransaction(
            hasRaiseAction ? "raise" : "bet",
            async () => (hasRaiseAction ? await handleRaise(tableId, amountMicro, network) : await handleBet(amountMicro, tableId, network)),
            true,
            formatDisplayAmount(maxAmount, isTournament)
        );
    };

    // Short-shove ALL-IN: dispatch the all-in-only RAISE for the whole stack (the
    // real legal action — no ALL_IN dispatch). Commits immediately; there is no
    // amount to stage. (poker-vm#2353, ui#457)
    const handleShortShoveAllInAction = async () => {
        if (!hasContent(tableId)) return;
        if (playerActionSounds) {
            playActionSound("all-in");
        }
        await handleActionWithTransaction("raise", () => handleRaise(tableId, stackMicro, network), true, formattedAllInAmount);
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
                            onClick={() => handleActionWithTransaction("new-hand", () => handleStartNewHand(tableId, network))}
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

                {/* Acknowledgement pill (Approach A): takes the footer slot the
                    button row occupied while an action is in flight/confirming.
                    It renders no legalActions, so it survives the state flip that
                    unmounts the buttons on confirm. Mutually exclusive with them. */}
                {!hideOtherButtons && ackPhase !== null && (
                    <ActionAckPill phase={ackPhase} label={ackLabel} variant={ackVariant} isMobileLandscape={isMobileLandscape} />
                )}

                {/* Only show other buttons if the deal button and ack pill are not showing */}
                {!hideOtherButtons && ackPhase === null && (
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
                                isTournament={isTournament}
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
                                    onFold={() => handleActionWithTransaction("fold", () => handleFold(tableId, network))}
                                    onCheck={() => handleActionWithTransaction("check", () => handleCheck(tableId, network))}
                                    onCall={() => handleActionWithTransaction("call", () => handleCall(callAmountMicro, tableId, network), false, formattedCallAmount)}
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
