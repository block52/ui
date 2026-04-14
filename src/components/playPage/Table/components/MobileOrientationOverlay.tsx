/**
 * MobileOrientationOverlay
 *
 * Blocks mobile portrait mode on the table page with a "rotate your phone" animation.
 * Provides a "Back to Lobby" button as the only action.
 */

import React from "react";
import ReactDOM from "react-dom";

export interface MobileOrientationOverlayProps {
    isPortraitBlocked: boolean;
    onGoToLobby: () => void;
}

export const MobileOrientationOverlay: React.FC<MobileOrientationOverlayProps> = ({
    isPortraitBlocked,
    onGoToLobby
}) => {
    if (!isPortraitBlocked) return null;

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
            style={{ width: "100vw", height: "100dvh", top: 0, left: 0 }}
        >
            {/* Animated phone rotation */}
            <div className="mb-8 relative">
                <svg
                    width="80"
                    height="120"
                    viewBox="0 0 80 120"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ animation: "phone-rotate 3s ease-in-out infinite", transformOrigin: "center center" }}
                >
                    <rect x="10" y="5" width="60" height="110" rx="10" ry="10" stroke="white" strokeWidth="3" fill="none" />
                    <rect x="16" y="20" width="48" height="75" rx="2" fill="rgba(255,255,255,0.1)" />
                    <circle cx="40" cy="107" r="5" stroke="white" strokeWidth="2" fill="none" />
                </svg>
                {/* Rotation arrow */}
                <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="absolute -right-6 top-1/2 -translate-y-1/2 text-green-400 animate-pulse"
                >
                    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" fill="currentColor" />
                </svg>
            </div>

            <h2 className="text-white text-xl font-bold mb-3 text-center px-8">
                Rotate to Play
            </h2>
            <p className="text-gray-400 text-sm text-center px-12 mb-10">
                Turn your phone sideways for the best experience
            </p>

            <button
                onClick={onGoToLobby}
                className="px-6 py-3 rounded-lg bg-white bg-opacity-10 hover:bg-opacity-20 text-white text-sm font-medium transition-all"
            >
                Back to Lobby
            </button>
        </div>,
        document.body
    );
};
