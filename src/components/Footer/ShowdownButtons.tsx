import React from "react";
import { ActionButton } from "./ActionButton";
import type { ShowdownButtonsProps } from "./types";

export const ShowdownButtons: React.FC<ShowdownButtonsProps> = ({
    canMuck,
    canShow,
    canSlowRoll,
    loading,
    isSlowRolling,
    slowRollCountdown,
    onMuck,
    onShow,
    onSlowRoll
}) => {
    return (
        <div className="flex justify-center gap-2 mb-2 lg:mb-3">
            {canMuck && !isSlowRolling && (
                <ActionButton
                    action="muck"
                    label="MUCK CARDS"
                    loading={loading === "muck"}
                    onClick={onMuck}
                    variant="secondary"
                    className="px-4 lg:px-6 py-2 lg:py-3 text-sm lg:text-base"
                />
            )}
            {canShow && !isSlowRolling && (
                <ActionButton
                    action="show"
                    label="SHOW CARDS"
                    loading={loading === "show"}
                    onClick={onShow}
                    variant="success"
                    className="px-4 lg:px-6 py-2 lg:py-3 text-sm lg:text-base"
                />
            )}
            {canSlowRoll && canShow && !isSlowRolling && (
                <ActionButton
                    action="slow-roll"
                    label="SLOW ROLL"
                    loading={false}
                    onClick={onSlowRoll}
                    variant="danger"
                    className="px-4 lg:px-6 py-2 lg:py-3 text-sm lg:text-base"
                />
            )}
            {isSlowRolling && (
                <div className="flex items-center justify-center px-6 lg:px-8 py-2 lg:py-3 text-sm lg:text-base font-bold bg-red-600/80 border border-red-500 rounded-lg shadow-md backdrop-blur-sm animate-pulse">
                    <span className="text-white">SLOW ROLLING... {slowRollCountdown}</span>
                </div>
            )}
        </div>
    );
};
