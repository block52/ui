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

    // Sit clear of the action bar in both layouts: its height plus a small gap.
    // Desktop's footer is 160px (hence 168px). On phones the on-demand action
    // bar measures 161px once it is showing bet sizing, so the old 100px put
    // this bubble INSIDE it — "A high" sat on top of the bet buttons (#684).
    // Both offsets are the bar's own height + 8px; the phone one adds the home
    // indicator, which the bar also pads for.
    const isCompactMobile = viewportMode === "mobile-portrait" || viewportMode === "mobile-landscape";
    const bottomStyle = isCompactMobile ? { bottom: "calc(env(safe-area-inset-bottom) + 169px)" } : { bottom: "168px" };

    return (
        <div style={bottomStyle} className="fixed right-4 bg-black/80 backdrop-blur-sm p-3 rounded-lg border border-blue-500/20 shadow-lg z-50">
            <div className="flex flex-col items-end">
                <div className="text-white font-medium text-sm">{handStrength.descr}</div>
            </div>
        </div>
    );
};

export default LiveHandStrengthDisplay;
