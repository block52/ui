import React, { useMemo, useState, useSyncExternalStore } from "react";
import { buildHandShareUrl } from "../utils/handReplay";
import { useParams } from "react-router-dom";
import { useGameProgress } from "../hooks/game/useGameProgress";
import { useWinnerInfo } from "../hooks/game/useWinnerInfo";
import { isTournamentFormat } from "../utils/gameFormatUtils";
import { getBeatenHandDescription } from "../utils/showdownSummary";
import { getLastHandResult, subscribeLastHandResult } from "../utils/lastHandResult";
import { ActionDTO } from "@block52/poker-vm-sdk";
import { formatActionAmount, formatActionName, formatRoundName, getActionLine, getWinnerLine, shouldShowWinnerSummary } from "./ActionsLog.utils";
import { FaCopy, FaCheck, FaFileDownload, FaShare } from "react-icons/fa";
import { toast } from "react-toastify";
import { useGameStateContext } from "../context/GameStateContext";
import { isEmpty, hasElements } from "../utils/guards";
import styles from "./ActionsLog.module.css";

const ActionsLog: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { previousActions } = useGameProgress(id);
    const { gameState, gameFormat } = useGameStateContext();
    const { winnerInfo } = useWinnerInfo();
    const showWinnerSummary = shouldShowWinnerSummary(gameState, winnerInfo);

    // The strongest revealed LOSING hand — the "over Pair, Kings" clause on the
    // live winner rows. Evaluated client-side; null when nothing was revealed.
    const beatenDescription = useMemo(
        () => (showWinnerSummary ? getBeatenHandDescription(gameState, winnerInfo) : null),
        [showWinnerSummary, gameState, winnerInfo]
    );

    // The PREVIOUS hand's summary, retained across the hand boundary (and this
    // sidebar's own unmount) so a showdown that flew by — an all-in runout
    // resolves in one engine step — can still be read afterwards. Hidden while
    // the same hand's live winner rows are on screen.
    const lastHandResult = useSyncExternalStore(subscribeLastHandResult, getLastHandResult);
    const showLastHandBlock =
        !!lastHandResult &&
        lastHandResult.tableId === id &&
        !(showWinnerSummary && lastHandResult.handNumber === gameState?.handNumber);

    // Monotonic fingerprint of the action log — changes only when a new action
    // lands, not on every gameState identity flip (same approach as
    // usePlayerChipData). `previousActions` is a fresh array on every WS frame,
    // so without this the rows below were rebuilt several times a second —
    // formatAmount runs ethers formatting PER ROW, across 40-80 rows.
    const lastActionIndex = hasElements(previousActions) ? previousActions[previousActions.length - 1].index : -1;
    const actionsFingerprint = `${previousActions.length}:${lastActionIndex}`;
    const [copied, setCopied] = useState(false);
    const [copiedJSON, setCopiedJSON] = useState(false);
    const [copiedShare, setCopiedShare] = useState(false);

    const copyTextToClipboard = (text: string, onSuccess: () => void, errorMessage: string) => {
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

    const handleCopyLog = () => {
        if (isEmpty(previousActions)) {
            toast.info("No actions to copy");
            return;
        }

        const isTournament = isTournamentFormat(gameFormat);
        const actionLines = previousActions.map((action: ActionDTO) => getActionLine(action, isTournament));

        // Append winner summary rows when the hand has ended
        const winnerLines = showWinnerSummary && winnerInfo
            ? winnerInfo.map(getWinnerLine)
            : [];

        const logText = [...actionLines, ...winnerLines].join("\n");

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

    const handleCopyJSON = () => {
        if (!gameState) {
            toast.info("No game state available to export");
            return;
        }

        try {
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

    const handleShareHand = () => {
        if (!id || !gameState?.handNumber) {
            toast.info("No hand data available to share");
            return;
        }

        // `?hand=N` opens the hand's final state (showdown or last action) read-only,
        // and keeps working after the hand ends.
        const shareUrl = buildHandShareUrl(window.location.origin, id, gameState.handNumber);

        copyTextToClipboard(
            shareUrl,
            () => {
                setCopiedShare(true);
                toast.success("Table replay URL copied to clipboard!");
                setTimeout(() => setCopiedShare(false), 2000);
            },
            "Failed to copy share URL"
        );
    };

    const rowBase = "flex min-h-[44px] items-center justify-between gap-3 border-b border-line px-4 py-2 text-sm transition-colors hover:bg-surface-hover";
    const iconButtonBase =
        "inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-light";

    // previousActions deliberately omitted — actionsFingerprint covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const actionRows = useMemo(
        () =>
            previousActions.map((action: ActionDTO, index: number) => (
                <li
                    key={index}
                    aria-current={index === previousActions.length - 1 ? "step" : undefined}
                    className={`${rowBase} ${index === previousActions.length - 1 ? "bg-brand/10 shadow-[inset_2px_0_0_0] shadow-brand-light" : ""}`}
                >
                    <span className="min-w-0 break-words text-ink tabular-nums">
                        {formatActionName(action.action)}
                        {formatActionAmount(action, isTournamentFormat(gameFormat))}
                    </span>
                    <span className="flex-shrink-0 text-xs text-ink-muted">
                        Seat {action.seat} · {formatRoundName(action.round)}
                    </span>
                </li>
            )),
        [actionsFingerprint, gameFormat]
    );

    // winnerInfo now has a stable identity across frames that do not change the
    // winners (see useWinnerInfo), so this memo actually holds.
    const winnerRows = useMemo(
        () =>
            showWinnerSummary
                ? winnerInfo?.map((w, i) => (
                      <li key={`winner-${i}`} className={`${rowBase} bg-emerald-400/10`}>
                          <span className="min-w-0 break-words font-bold text-emerald-400 tabular-nums">
                              WINS {w.formattedAmount}
                              {w.description && ` — ${w.description}`}
                              {w.description && beatenDescription && ` over ${beatenDescription}`}
                          </span>
                          <span className="flex-shrink-0 text-xs text-ink-muted">
                              Seat {w.seat} · {w.winType === "showdown" ? "Showdown" : "Uncontested"}
                          </span>
                      </li>
                  ))
                : null,
        [showWinnerSummary, winnerInfo, beatenDescription]
    );

    const copiedColor = "text-emerald-400";
    const defaultColor = "text-brand-light";

    return (
        <div className="flex h-full w-full flex-col text-ink">
            <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-line px-4">
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-muted">History</h3>
                <div className="-mr-2 flex items-center gap-1">
                    <button
                        type="button"
                        onClick={handleCopyLog}
                        title="Copy history to clipboard"
                        aria-label="Copy history"
                        className={`${iconButtonBase} ${copied ? copiedColor : defaultColor}`}
                    >
                        {copied ? <FaCheck size={14} /> : <FaCopy size={14} />}
                    </button>
                    <button
                        type="button"
                        onClick={handleCopyJSON}
                        title="Copy hand history as JSON"
                        aria-label="Copy hand history as JSON"
                        className={`${iconButtonBase} ${copiedJSON ? copiedColor : defaultColor}`}
                    >
                        {copiedJSON ? <FaCheck size={14} /> : <FaFileDownload size={14} />}
                    </button>
                    <button
                        type="button"
                        onClick={handleShareHand}
                        title="Share hand replay URL"
                        aria-label="Share hand"
                        className={`${iconButtonBase} ${copiedShare ? copiedColor : defaultColor}`}
                    >
                        {copiedShare ? <FaCheck size={14} /> : <FaShare size={14} />}
                    </button>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto overflow-x-hidden ${styles.scroll}`}>
                {showLastHandBlock && lastHandResult && (
                    <div className="border-b border-line bg-emerald-400/10 px-4 py-3 text-sm">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                            Last hand #{lastHandResult.handNumber}
                        </div>
                        {lastHandResult.lines.map((line, i) => (
                            <div key={`last-hand-${i}`} className="break-words font-bold text-emerald-400">
                                {line}
                            </div>
                        ))}
                    </div>
                )}

                {hasElements(previousActions) ? (
                    <ul>
                        {actionRows}
                        {winnerRows}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center px-6 py-12 text-center">
                        <p className="text-[15px] font-medium text-ink">No actions recorded yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActionsLog; 