/**
 * TableErrorPage Component
 *
 * Displays an error page when the game state is invalid or missing required fields.
 * Shows the specific fields that are missing and provides options to retry or go back.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { AnimatedBackground } from "../common/AnimatedBackground";
import { hasElements } from "../../utils/guards";

export interface ValidationError {
    missingFields: string[];
    message: string;
    rawData?: unknown;
}

interface TableErrorPageProps {
    error: ValidationError;
    tableId: string;
    onRetry: () => void;
}

function TableErrorPage({ error, tableId, onRetry }: TableErrorPageProps): React.ReactElement {
    const navigate = useNavigate();
    const [showRawData, setShowRawData] = React.useState(false);

    // Extract for TypeScript inference
    const missingFields: string[] = error.missingFields;
    const hasMissingFields = hasElements(missingFields);

    const handleBackToLobby = () => {
        navigate("/tables");
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4">
            <AnimatedBackground />
            <div className="relative z-10 max-w-2xl w-full">
                <div className="bg-surface-card rounded-2xl border border-red-500/30 shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-red-600/20 to-red-800/20 px-6 py-4 border-b border-red-500/30">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                                <svg
                                    className="w-6 h-6 text-red-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Table Error</h1>
                                <p className="text-red-300 text-sm">Unable to load game data</p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Error Message */}
                        <div className="bg-surface-raised rounded-xl p-4 border border-line">
                            <p className="text-ink-body">{error.message}</p>
                        </div>

                        {/* Missing Fields */}
                        {hasMissingFields ? (
                            <div>
                                <h3 className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-3">
                                    Missing Required Fields
                                </h3>
                                <div className="bg-surface-raised rounded-xl border border-line divide-y divide-line">
                                    {missingFields.map((field, index) => (
                                        <div key={index} className="px-4 py-3 flex items-center gap-3">
                                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                            <code className="text-red-300 font-mono text-sm">{field}</code>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {/* Table ID */}
                        <div className="bg-surface-raised rounded-xl p-4 border border-line">
                            <p className="text-ink-muted text-xs mb-1">Table ID</p>
                            <code className="text-brand-light font-mono text-sm break-all">{tableId}</code>
                        </div>

                        {/* Raw Data Toggle */}
                        {error.rawData !== undefined && (
                            <div>
                                <button
                                    onClick={() => setShowRawData(!showRawData)}
                                    className="text-sm text-ink-muted hover:text-ink-body flex items-center gap-2"
                                >
                                    <svg
                                        className={`w-4 h-4 transition-transform ${showRawData ? "rotate-90" : ""}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                    {showRawData ? "Hide" : "Show"} Raw Data (Debug)
                                </button>
                                {showRawData && (
                                    <div className="mt-3 bg-surface-page rounded-xl p-4 border border-line overflow-auto max-h-64">
                                        <pre className="text-xs text-ink-muted font-mono whitespace-pre-wrap">
                                            {JSON.stringify(error.rawData, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="px-6 py-4 bg-surface-raised border-t border-line flex gap-3">
                        <button
                            onClick={handleBackToLobby}
                            className="flex-1 px-4 py-3 border border-line-strong hover:bg-surface-hover text-ink font-semibold rounded-full transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Lobby
                        </button>
                        <button
                            onClick={onRetry}
                            className="flex-1 px-4 py-3 bg-brand hover:bg-brand/90 text-white font-semibold rounded-full transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                            Retry
                        </button>
                    </div>
                </div>

                {/* Help Text */}
                <p className="text-center text-ink-muted text-sm mt-4">
                    This error indicates the blockchain returned incomplete game data.
                    <br />
                    Please report this issue if it persists.
                </p>
            </div>
        </div>
    );
};

export default TableErrorPage;
