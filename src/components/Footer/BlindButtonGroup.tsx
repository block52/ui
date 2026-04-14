import React from "react";
import { PlayerStatus } from "@block52/poker-vm-sdk";
import { LoadingSpinner } from "../common";
import { FoldButton } from "./FoldButton";
import type { BlindButtonGroupProps } from "./types";

export const BlindButtonGroup: React.FC<BlindButtonGroupProps> = ({
    showSmallBlind,
    showBigBlind,
    smallBlindAmount,
    bigBlindAmount,
    canFold,
    playerStatus,
    loading,
    isMobileLandscape,
    isTournament,
    onPostSmallBlind,
    onPostBigBlind,
    onFold
}) => {
    return (
        <div className={`flex justify-center items-center ${isMobileLandscape ? "gap-0.5" : "gap-1 lg:gap-2"}`}>
            {showSmallBlind && playerStatus !== PlayerStatus.FOLDED && (
                <button
                    onClick={onPostSmallBlind}
                    disabled={loading !== null}
                    className="btn-small-blind text-white font-medium py-1.5 lg:py-2 px-2 lg:px-4 rounded-lg shadow-md transition-all duration-200 text-xs lg:text-sm border flex items-center transform hover:scale-105 mr-1 lg:mr-2 disabled:opacity-50 disabled:cursor-not-allowed gap-1"
                >
                    {loading === "small-blind" ? (
                        <>
                            <LoadingSpinner size="sm" />
                            POSTING...
                        </>
                    ) : (
                        <>
                            <span className="mr-1">Post Small Blind</span>
                            <span className="btn-small-blind-amount backdrop-blur-sm px-1 lg:px-2 py-1 rounded text-xs border">
                                {smallBlindAmount}
                            </span>
                        </>
                    )}
                </button>
            )}

            {showBigBlind && playerStatus !== PlayerStatus.FOLDED && (
                <button
                    onClick={onPostBigBlind}
                    disabled={loading !== null}
                    className="btn-big-blind text-white font-medium py-1.5 lg:py-2 px-2 lg:px-4 rounded-lg shadow-md transition-all duration-200 text-xs lg:text-sm border flex items-center transform hover:scale-105 mr-1 lg:mr-2 disabled:opacity-50 disabled:cursor-not-allowed gap-1"
                >
                    {loading === "big-blind" ? (
                        <>
                            <LoadingSpinner size="sm" />
                            POSTING...
                        </>
                    ) : (
                        <>
                            <span className="mr-1">Post Big Blind</span>
                            <span className="btn-big-blind-amount backdrop-blur-sm px-1 lg:px-2 py-1 rounded text-xs border">
                                {bigBlindAmount}
                            </span>
                        </>
                    )}
                </button>
            )}

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
        </div>
    );
};
