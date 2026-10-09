/**
 * SitAndGoWaitingModal Component
 *
 * Displays a modal for players who have joined a Sit & Go tournament
 * and are waiting for more players to fill the table before the game starts.
 */
import React, { useCallback, useMemo, useState } from "react";
import { hasValue, isNullish } from "../../utils/guards";
import { useGameOptions } from "../../hooks/game/useGameOptions";
import { useVacantSeatData } from "../../hooks/game/useVacantSeatData";
import { getGameTypeMnemonic } from "../../utils/gameFormatUtils";
import { formatSitAndGoStackString } from "../../utils/numberUtils";
import { Modal } from "../common";
import { ModalFooter } from "../modals/ModalFooter";
import { PillButton } from "../ui/PillButton";
import { fieldLabelClass, insetBoxClass, noticeClass } from "../modals/walletFormClasses";
import styles from "./SitAndGoWaitingModal.module.css";

interface SitAndGoWaitingModalProps {
    onLeaveConfirm?: () => Promise<void>;
    playerStack?: string;
}

// Not dismissable by backdrop/Escape; satisfies Modal's required onClose.
const noop = (): void => undefined;

const SitAndGoWaitingModal: React.FC<SitAndGoWaitingModalProps> = ({ onLeaveConfirm, playerStack }) => {
    const { gameOptions } = useGameOptions();
    const { emptySeatIndexes } = useVacantSeatData();

    const [isConfirming, setIsConfirming] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [leaveError, setLeaveError] = useState<string | null>(null);

    const handleLeaveClick = useCallback(() => {
        setLeaveError(null);
        setIsConfirming(true);
    }, []);

    const handleCancel = useCallback(() => {
        setIsConfirming(false);
        setLeaveError(null);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!onLeaveConfirm) return;
        setIsLeaving(true);
        setLeaveError(null);
        try {
            await onLeaveConfirm();
        } catch (err) {
            console.error("Error leaving SNG table:", err);
            setLeaveError(err instanceof Error ? err.message : "Failed to leave table. Please try again.");
            setIsLeaving(false);
        }
    }, [onLeaveConfirm]);

    const chipsLabel = hasValue(playerStack) ? formatSitAndGoStackString(playerStack) : null;
    const buyInLabel = gameOptions?.startingStack ? formatSitAndGoStackString(gameOptions.startingStack) : null;
    const canShowLeaveUi = hasValue(onLeaveConfirm) && hasValue(playerStack);

    const playersJoined = useMemo(() => {
        if (!gameOptions?.maxPlayers) return 0;
        return gameOptions.maxPlayers - emptySeatIndexes.length;
    }, [gameOptions?.maxPlayers, emptySeatIndexes.length]);

    const maxPlayers = gameOptions?.maxPlayers;

    const playerCountLabel = getGameTypeMnemonic(gameOptions?.minPlayers);

    if (isNullish(maxPlayers)) {
        return null;
    }

    const remaining = maxPlayers - playersJoined;

    return (
        <Modal isOpen onClose={noop} closeOnEscape={false} closeOnBackdropClick={false} widthClass="w-[420px]" ariaLabel="Waiting for players">
            <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-brand/10 border border-brand/30 grid place-items-center relative text-brand-light">
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-light animate-spin"></div>
                    <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                    </svg>
                </div>

                <h2 className="m-0 mt-4 text-xl font-semibold text-ink">Waiting for Players</h2>
                <p className="m-0 mt-1 text-sm text-ink-muted">{playerCountLabel} tournament is filling up...</p>
            </div>

            <div className={`${insetBoxClass} mt-5 text-center`}>
                <div className={`${fieldLabelClass} !mb-1`}>Players joined</div>
                <div className="text-3xl text-ink font-bold tabular-nums">
                    {playersJoined} / {maxPlayers}
                </div>

                <div className="w-full bg-line-strong rounded-full h-2.5 mt-3 overflow-hidden">
                    <div
                        className="bg-brand h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${(playersJoined / maxPlayers) * 100}%` }}
                    ></div>
                </div>

                <div className="flex items-center justify-center gap-2 mt-3">
                    <div className="flex gap-1" aria-hidden="true">
                        <div className={`w-1.5 h-1.5 bg-brand-light rounded-full animate-bounce ${styles.waitingDotDelay0}`}></div>
                        <div className={`w-1.5 h-1.5 bg-brand-light rounded-full animate-bounce ${styles.waitingDotDelay150}`}></div>
                        <div className={`w-1.5 h-1.5 bg-brand-light rounded-full animate-bounce ${styles.waitingDotDelay300}`}></div>
                    </div>
                    <span className="text-ink-muted text-sm">
                        Waiting for {remaining} more {remaining === 1 ? "player" : "players"}
                    </span>
                </div>
            </div>

            <div className={`${noticeClass.success} mt-3 flex items-center justify-center gap-2`}>
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shrink-0"></div>
                <span className="font-semibold text-sm">
                    Waiting for players, you are {playersJoined} of {maxPlayers}
                </span>
            </div>

            {canShowLeaveUi && isConfirming && (
                <div className={`${insetBoxClass} mt-3 !border-red-500/30`}>
                    <p className="m-0 mb-3 text-ink text-sm font-semibold text-center">Leave this tournament?</p>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-ink-muted">Your chips</span>
                            <span className="text-ink font-semibold tabular-nums">{chipsLabel}</span>
                        </div>
                        {buyInLabel && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-ink-muted">Buy-in</span>
                                <span className="text-ink-soft tabular-nums">{buyInLabel}</span>
                            </div>
                        )}
                    </div>

                    {leaveError && (
                        <p role="alert" className={`m-0 mt-3 ${noticeClass.error} break-words`}>
                            {leaveError}
                        </p>
                    )}
                </div>
            )}

            <ModalFooter>
                {canShowLeaveUi && !isConfirming && (
                    <PillButton variant="outline" onClick={handleLeaveClick} className="w-full">
                        Leave Game
                    </PillButton>
                )}

                {canShowLeaveUi && isConfirming && (
                    <>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isLeaving}
                            className="inline-flex items-center justify-center w-full h-11 rounded-btn border border-red-500/40 bg-red-500/10 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isLeaving ? "Leaving..." : "Confirm Leave"}
                        </button>
                        <PillButton variant="ghost" onClick={handleCancel} disabled={isLeaving} className="w-full">
                            Cancel
                        </PillButton>
                    </>
                )}

                <p className="m-0 text-center text-xs text-ink-muted">Tournament starts automatically when all players are seated</p>
            </ModalFooter>
        </Modal>
    );
};

export default SitAndGoWaitingModal;
