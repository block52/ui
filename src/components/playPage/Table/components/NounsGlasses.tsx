/**
 * NounsGlasses Component
 *
 * Inline SVG pixel-art rendering of the iconic Nouns DAO glasses.
 * Red left lens, blue right lens, with poker suit accents.
 * Reference: https://github.com/block52/nouns.poker
 * Official Nouns: https://www.nouns.com
 */

import React from "react";

interface NounsGlassesProps {
    width?: number;
    className?: string;
}

export const NounsGlasses: React.FC<NounsGlassesProps> = ({ width = 300, className = "" }) => {
    return (
        <svg
            viewBox="0 0 240 80"
            width={width}
            className={className}
            shapeRendering="crispEdges"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Bridge */}
            <rect x="104" y="24" width="32" height="8" fill="#1a1a2e" />

            {/* Left Frame */}
            <rect x="8" y="12" width="96" height="56" rx="0" fill="#1a1a2e" />
            {/* Left Lens - Red */}
            <rect x="16" y="20" width="80" height="40" fill="#d63c5e" />
            {/* Left Lens Shine */}
            <rect x="20" y="24" width="12" height="8" fill="rgba(255,255,255,0.25)" />
            {/* Left Lens - Spade Accent */}
            <rect x="48" y="32" width="8" height="8" fill="rgba(255,255,255,0.15)" />
            <rect x="44" y="40" width="16" height="4" fill="rgba(255,255,255,0.15)" />
            <rect x="48" y="44" width="8" height="4" fill="rgba(255,255,255,0.15)" />

            {/* Right Frame */}
            <rect x="136" y="12" width="96" height="56" rx="0" fill="#1a1a2e" />
            {/* Right Lens - Blue */}
            <rect x="144" y="20" width="80" height="40" fill="#2b83f6" />
            {/* Right Lens Shine */}
            <rect x="148" y="24" width="12" height="8" fill="rgba(255,255,255,0.25)" />
            {/* Right Lens - Diamond Accent */}
            <rect x="180" y="32" width="8" height="4" fill="rgba(255,255,255,0.15)" />
            <rect x="176" y="36" width="16" height="4" fill="rgba(255,255,255,0.15)" />
            <rect x="180" y="40" width="8" height="4" fill="rgba(255,255,255,0.15)" />

            {/* Left Arm */}
            <rect x="0" y="24" width="8" height="8" fill="#1a1a2e" />
            {/* Right Arm */}
            <rect x="232" y="24" width="8" height="8" fill="#1a1a2e" />
        </svg>
    );
};
