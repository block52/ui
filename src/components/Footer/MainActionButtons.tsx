import React from "react";
import { LoadingSpinner } from "../common";
import { TexasHoldemRound, ActionDTO, PlayerStatus } from "@block52/poker-vm-sdk";
import { FoldButton } from "./FoldButton";
import { getRaiseToAmount } from "../../utils/raiseUtils";
import type { MainActionButtonsProps } from "./types";
import styles from "./MainActionButtons.module.css";

export const MainActionButtons: React.FC<MainActionButtonsProps> = ({
    canFold,
    canCheck,
    canCall,
    callAmount,
    canBet,
    canRaise,
    raiseAmount,
    isRaiseAmountInvalid,
    playerStatus,
    loading,
    isMobileLandscape,
    currentRound,
    previousActions,
    userAddress,
    isAllIn,
    onFold,
    onCheck,
    onCall,
    onBetOrRaise
}) => {
    // Calculate the total amount to display for raise button
    // This includes blinds posted during ANTE round when we're in PREFLOP
    const raiseToAmount = canRaise ? getRaiseToAmount(raiseAmount, previousActions, currentRound, userAddress) : raiseAmount;
    return (
        <div className={`flex justify-between ${isMobileLandscape ? "gap-0.5" : "gap-1 lg:gap-2"}`}>
            {/* Show fold button if canFold OR if currently folding (to show spinner) */}
            {(canFold || loading === "fold") && (
                <FoldButton
                    loading={loading === "fold"}
                    disabled={loading !== null}
                    isMobileLandscape={isMobileLandscape}
                    onClick={onFold}
                />
            )}

            {playerStatus === PlayerStatus.FOLDED && (
                <div className="text-gray-400 py-1.5 lg:py-2 px-2 lg:px-4 bg-gray-800 bg-opacity-50 rounded-lg text-xs lg:text-sm">
                    You have folded this hand
                </div>
            )}

            {canCheck && (
                <button
                    className={`btn-check cursor-pointer rounded-lg w-full shadow-md backdrop-blur-sm
                    transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${
                        isMobileLandscape ? "px-2 py-0.5 text-[10px]" : "px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm"
                    }`}
                    onClick={onCheck}
                    disabled={loading !== null}
                >
                    {loading === "check" ? (
                        <>
                            <LoadingSpinner size="sm" />
                            CHECKING...
                        </>
                    ) : (
                        "CHECK"
                    )}
                </button>
            )}

            {canCall && (
                <button
                    className={`btn-call cursor-pointer rounded-lg w-full border shadow-md backdrop-blur-sm
                    transition-all duration-200 font-medium transform active:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${
                        isMobileLandscape ? "px-2 py-0.5 text-[10px]" : "px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm"
                    }`}
                    onClick={onCall}
                    disabled={loading !== null}
                >
                    {loading === "call" ? (
                        <>
                            <LoadingSpinner size="sm" />
                            CALLING...
                        </>
                    ) : (
                        <>
                            CALL <span className={styles.amountAccent}>${callAmount}</span>
                        </>
                    )}
                </button>
            )}

            {(canRaise || canBet) && (
                <button
                    onClick={onBetOrRaise}
                    disabled={loading !== null || (canRaise ? isRaiseAmountInvalid : false)}
                    className={`cursor-pointer hover:scale-105 btn-raise rounded-lg w-full border shadow-md backdrop-blur-sm transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${
                        isMobileLandscape ? "px-2 py-0.5 text-[10px]" : "px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm"
                    }`}
                >
                    {loading === "raise" || loading === "bet" ? (
                        <>
                            <LoadingSpinner size="sm" />
                            {isAllIn ? "JAMMING..." : canRaise ? "RAISING..." : "BETTING..."}
                        </>
                    ) : (
                        <>
                            {canRaise ? "RAISE TO" : "BET"}{" "}
                            <span className={styles.amountAccent}>${raiseToAmount.toFixed(2)}</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
};
