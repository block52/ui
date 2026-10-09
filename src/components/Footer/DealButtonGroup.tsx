import React, { useState } from "react";
import { LoadingSpinner } from "../common";
import { DealEntropyModal } from "../modals";
import type { DealButtonGroupProps } from "./types";
import styles from "./DealButtonGroup.module.css";

export const DealButtonGroup: React.FC<DealButtonGroupProps> = ({
    tableId,
    onDeal,
    loading,
    disabled,
    autoDealEnabled = false
}) => {
    const [showEntropyModal, setShowEntropyModal] = useState(false);

    const dealIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 lg:h-5 lg:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );

    const entropyIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 lg:h-5 lg:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
    );

    return (
        <>
            {showEntropyModal && (
                <DealEntropyModal
                    tableId={tableId}
                    onClose={() => setShowEntropyModal(false)}
                    onDeal={onDeal}
                />
            )}

            <div className="flex justify-center gap-2 mb-2 lg:mb-3">
                <button
                    onClick={() => onDeal("")}
                    disabled={disabled || loading}
                    className="btn-deal text-white font-bold py-2 lg:py-3 px-6 lg:px-8 rounded-full shadow-md text-sm lg:text-base backdrop-blur-sm transition-all duration-300 flex items-center justify-center gap-1 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <LoadingSpinner size="sm" />
                            DEALING...
                        </>
                    ) : (
                        <>
                            {dealIcon}
                            DEAL
                        </>
                    )}
                </button>

                {/* Only show entropy button when auto-deal is disabled */}
                {!autoDealEnabled && (
                    <button
                        onClick={() => setShowEntropyModal(true)}
                        disabled={disabled || loading}
                        className={`text-white font-bold py-2 lg:py-3 px-4 lg:px-6 rounded-full shadow-md text-sm lg:text-base backdrop-blur-sm transition-all duration-300 flex items-center justify-center gap-2 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${styles.entropyButton}`}
                    >
                        {entropyIcon}
                        <span className="text-xs lg:text-sm">Show Entropy</span>
                    </button>
                )}
            </div>
        </>
    );
};
