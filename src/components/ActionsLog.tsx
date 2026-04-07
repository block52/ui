import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useGameProgress } from "../hooks/game/useGameProgress";
import { formatPlayerId, formatAmount } from "../utils/accountUtils";
import { ActionDTO } from "@block52/poker-vm-sdk";
import { FaCopy, FaCheck, FaFileDownload, FaShare } from "react-icons/fa";
import { toast } from "react-toastify";
import { useGameStateContext } from "../context/GameStateContext";
import { useIndexerApi } from "../context/IndexerApiContext";
import styles from "./ActionsLog.module.css";

// Function to format action names with proper capitalization and spacing
const formatActionName = (action: string): string => {
    switch (action.toLowerCase()) {
        case "join":
            return "Join";
        case "post-small-blind":
            return "Post Small Blind";
        case "post-big-blind":
            return "Post Big Blind";
        case "deal":
            return "Deal";
        case "call":
            return "Call";
        case "check":
            return "Check";
        case "bet":
            return "Bet";
        case "raise":
            return "Raise";
        case "fold":
            return "Fold";
        case "show":
            return "Show";
        case "muck":
            return "Muck";
        case "all-in":
            return "All In";
        case "leave":
            return "Leave";
        case "sit-out":
            return "Sit Out";
        case "sit-in":
            return "Sit In";
        case "new-hand":
            return "New Hand";
        default:
            // Fallback: capitalize first letter and replace hyphens with spaces
            return action.charAt(0).toUpperCase() + action.slice(1).replace(/-/g, " ");
    }
};

// Function to format round names with proper poker terminology
const formatRoundName = (round: string): string => {
    switch (round.toLowerCase()) {
        case "ante":
            return "Ante";
        case "preflop":
            return "Pre-flop";
        case "flop":
            return "Flop";
        case "turn":
            return "Turn";
        case "river":
            return "River";
        case "showdown":
            return "Showdown";
        case "end":
            return "End";
        default:
            // Fallback: capitalize first letter
            return round.charAt(0).toUpperCase() + round.slice(1);
    }
};

// Simple component to display only the action log
const ActionsLog: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { previousActions } = useGameProgress(id);
    const { gameState } = useGameStateContext();
    const indexerApi = useIndexerApi();
    const [copied, setCopied] = useState(false);
    const [copiedJSON, setCopiedJSON] = useState(false);
    const [copiedShare, setCopiedShare] = useState(false);

    // Reusable utility function for copying text to clipboard
    const copyTextToClipboard = (text: string, onSuccess: () => void, errorMessage: string) => {
        // Copy to clipboard with fallback for older browsers
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard
                .writeText(text)
                .then(() => {
                    onSuccess();
                })
                .catch((err) => {
                    console.error("Failed to copy:", err);
                    toast.error(errorMessage);
                });
        } else {
            // Fallback for older browsers or non-HTTPS contexts using deprecated execCommand
            // This is intentionally used as a legacy fallback for browsers without Clipboard API
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px"; // Hide off-screen
                document.body.appendChild(textArea);
                textArea.select();
                const success = document.execCommand("copy"); // Deprecated but needed for legacy browsers
                document.body.removeChild(textArea);
                if (success) {
                    onSuccess();
                } else {
                    console.error("execCommand copy failed");
                    toast.error(errorMessage);
                }
            } catch (err) {
                console.error("Failed to copy:", err);
                toast.error(errorMessage);
            }
        }
    };

    // Function to copy action log to clipboard
    const handleCopyLog = () => {
        if (!previousActions || previousActions.length === 0) {
            toast.info("No actions to copy");
            return;
        }

        // Format actions for clipboard
        const logText = previousActions
            .map((action: ActionDTO) => {
                const player = formatPlayerId(action.playerId);
                const actionName = formatActionName(action.action);
                const amount = action.amount ? ` ${formatAmount(action.amount)}` : "";
                const round = formatRoundName(action.round);
                const seat = action.seat;
                return `${player} (Seat ${seat}): ${actionName}${amount} - ${round}`;
            })
            .join("\n");

        copyTextToClipboard(
            logText,
            () => {
                setCopied(true);
                toast.success("Action log copied to clipboard!");
                setTimeout(() => setCopied(false), 2000);
            },
            "Failed to copy log"
        );
    };

    // Function to copy hand history as JSON
    const handleCopyJSON = () => {
        if (!gameState) {
            toast.info("No game state available to export");
            return;
        }

        try {
            // Create comprehensive hand history JSON with error handling for serialization
            const handHistoryJSON = JSON.stringify(gameState, null, 2);
            
            copyTextToClipboard(
                handHistoryJSON,
                () => {
                    setCopiedJSON(true);
                    toast.success("Hand history JSON copied to clipboard!");
                    setTimeout(() => setCopiedJSON(false), 2000);
                },
                "Failed to copy JSON"
            );
        } catch (err) {
            console.error("Failed to serialize game state:", err);
            toast.error("Failed to serialize game state to JSON");
        }
    };

    const handleShareHand = async () => {
        if (!id || !gameState?.handNumber) {
            toast.info("No hand data available to share");
            return;
        }
        try {
            // Look up block height for current hand from indexer
            const handData = await indexerApi.getHand(id, String(gameState.handNumber)) as { block_height?: number } | null;
            const actionIndex = gameState.previousActions?.length || 0;

            if (handData?.block_height) {
                const shareUrl = `${window.location.origin}/table/${id}?blocknumber=${handData.block_height}&actionindex=${actionIndex}`;
                copyTextToClipboard(
                    shareUrl,
                    () => {
                        setCopiedShare(true);
                        toast.success("Table replay URL copied to clipboard!");
                        setTimeout(() => setCopiedShare(false), 2000);
                    },
                    "Failed to copy share URL"
                );
            } else {
                // Fallback to explorer URL if block height not available
                const shareUrl = `${window.location.origin}/explorer/hand/${id}/${gameState.handNumber}`;
                copyTextToClipboard(
                    shareUrl,
                    () => {
                        setCopiedShare(true);
                        toast.success("Hand replay URL copied to clipboard!");
                        setTimeout(() => setCopiedShare(false), 2000);
                    },
                    "Failed to copy share URL"
                );
            }
        } catch {
            // Fallback to explorer URL on error
            const shareUrl = `${window.location.origin}/explorer/hand/${id}/${gameState.handNumber}`;
            copyTextToClipboard(
                shareUrl,
                () => {
                    setCopiedShare(true);
                    toast.success("Hand replay URL copied to clipboard!");
                    setTimeout(() => setCopiedShare(false), 2000);
                },
                "Failed to copy share URL"
            );
        }
    };

    return (
        <div
            className={`rounded w-full h-full overflow-y-auto scrollbar-hide backdrop-blur-sm ${styles.container}`}
        >
            <div 
                className={`flex justify-between items-center p-2 border-b ${styles.header}`}
            >
                <h3 className="text-sm font-semibold">History</h3>
                <div className="flex gap-2">
                    <button
                        onClick={handleCopyLog}
                        title="Copy history to clipboard"
                        className={`p-1.5 rounded hover:bg-white/10 transition-colors duration-200 ${copied ? styles.copyButtonCopied : styles.copyButtonDefault}`}
                    >
                        {copied ? <FaCheck size={12} /> : <FaCopy size={12} />}
                    </button>
                    <button
                        onClick={handleCopyJSON}
                        title="Copy hand history as JSON"
                        className={`p-1.5 rounded hover:bg-white/10 transition-colors duration-200 ${copiedJSON ? styles.copyButtonCopied : styles.copyButtonDefault}`}
                    >
                        {copiedJSON ? <FaCheck size={12} /> : <FaFileDownload size={12} />}
                    </button>
                    <button
                        onClick={handleShareHand}
                        title="Share hand replay URL"
                        className={`p-1.5 rounded hover:bg-white/10 transition-colors duration-200 ${copiedShare ? styles.copyButtonCopied : styles.copyButtonDefault}`}
                    >
                        {copiedShare ? <FaCheck size={12} /> : <FaShare size={12} />}
                    </button>
                </div>
            </div>
            
            {previousActions && previousActions.length > 0 ? (
                <div className="space-y-0.5 p-2">
                    {previousActions.map((action: ActionDTO, index: number) => (
                        <div 
                            key={index} 
                            className={`text-xs py-1 border-b ${styles.actionRow}`}
                        >
                            <div className="flex justify-between">
                                <span 
                                    className={`font-mono ${styles.playerId}`}
                                >
                                    {formatPlayerId(action.playerId)}
                                </span>
                                <span 
                                    className={`text-[10px] ${styles.secondaryText}`}
                                >
                                    Seat {action.seat}
                                </span>
                            </div>
                            <div className="flex justify-between mt-0.5">
                                <span className={styles.actionText}>
                                    {formatActionName(action.action)}
                                    {action.amount && ` ${formatAmount(action.amount)}`}
                                </span>
                                <span 
                                    className={`text-[10px] ${styles.secondaryText}`}
                                >
                                    {formatRoundName(action.round)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p 
                    className={`text-xs p-3 ${styles.secondaryText}`}
                >
                    No actions recorded yet.
                </p>
            )}
        </div>
    );
};

export default ActionsLog; 