import React from "react";
import { LoadingSpinner } from "../common";
import type { FoldButtonProps } from "./types";

/**
 * Reusable Fold button component with loading spinner.
 * Uses the same spinner styling as the Call button.
 */
export const FoldButton: React.FC<FoldButtonProps> = ({
    loading,
    disabled,
    isMobileLandscape = false,
    onClick
}) => {
    return (
        <button
            className={`btn-fold cursor-pointer rounded-btn w-full border shadow-md backdrop-blur-sm transition-all duration-200 transform active:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${
                isMobileLandscape
                    ? "px-2 py-0.5 text-[10px]"
                    : "px-2 lg:px-5 py-1.5 lg:py-0 lg:h-full lg:min-h-[52px] text-xs lg:text-base font-semibold"
            }`}
            onClick={onClick}
            disabled={disabled || loading}
        >
            {loading ? (
                <>
                    <LoadingSpinner size="sm" />
                    FOLDING...
                </>
            ) : (
                "FOLD"
            )}
        </button>
    );
};
