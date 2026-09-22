import React, { useState, useEffect } from "react";
import { useCardsForHandStrength } from "../../hooks/player/useCardsForHandStrength";
import { usePlayerSeatInfo } from "../../hooks/player/usePlayerSeatInfo";
import { getViewportMode } from "../../config/stageGeometry";

const LiveHandStrengthDisplay: React.FC = () => {
    const { currentUserSeat } = usePlayerSeatInfo();
    const handStrength = useCardsForHandStrength(currentUserSeat);
    const [viewportMode, setViewportMode] = useState(getViewportMode());

    useEffect(() => {
        const handleResize = () => setViewportMode(getViewportMode());
        window.addEventListener("resize", handleResize);
        window.addEventListener("orientationchange", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("orientationchange", handleResize);
        };
    }, []);

    if (!handStrength) {
        return null;
    }

    // Phones (both orientations) have no persistent footer bar — sit just above
    // the on-demand action-bar zone, clear of the home indicator. Desktop/tablet
    // keep the 160px fixed footer.
    const isCompactMobile = viewportMode === "mobile-portrait" || viewportMode === "mobile-landscape";
    const bottomStyle = isCompactMobile ? { bottom: "calc(env(safe-area-inset-bottom) + 100px)" } : { bottom: "168px" };

    return (
        <div style={bottomStyle} className="fixed right-4 bg-black/80 backdrop-blur-sm p-3 rounded-lg border border-blue-500/20 shadow-lg z-50">
            <div className="flex flex-col items-end">
                <div className="text-white font-medium text-sm">{handStrength.descr}</div>
            </div>
        </div>
    );
};

export default LiveHandStrengthDisplay;
