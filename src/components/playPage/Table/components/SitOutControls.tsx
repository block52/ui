import React from "react";
import type { SitOutControls as SitOutControlsState } from "../../../../hooks/playerActions/useSitOutControls";

interface SitOutControlsProps {
    controls: SitOutControlsState;
    /** Compact typography for the on-felt panels; the drawer row uses full size. */
    compact?: boolean;
}

/**
 * The two INDEPENDENT sit-out checkboxes (#763, matches Ignition): "next hand"
 * fires at the next hand boundary, "next big blind" holds you in until the BB
 * rotates back to your seat (so you don't waste blinds already paid this orbit).
 * Both may be checked; per #763 "the first applicable condition triggers".
 *
 * Presentation only — state and submission live in useSitOutControls so the same
 * controls can render on the felt (desktop/landscape) or in the hamburger drawer
 * (compact mobile, ui#670) without duplicating the submission path.
 */
export const SitOutControls: React.FC<SitOutControlsProps> = ({ controls, compact = false }) => {
    const { nextHandChecked, toggleNextHand, nextBbQueued, toggleNextBb } = controls;
    const textSize = compact ? "text-xs" : "text-sm";
    return (
        <div className="flex flex-col gap-1" data-testid="sit-out-controls">
            <label className="flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    checked={nextHandChecked}
                    onChange={toggleNextHand}
                    className="form-checkbox h-4 w-4 text-amber-500 border-gray-500 rounded focus:ring-0"
                />
                <span className={`ml-2 ${nextHandChecked ? "text-amber-300" : "text-white"} ${textSize}`}>Sit Out Next Hand</span>
            </label>
            <label className="flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    checked={nextBbQueued}
                    onChange={toggleNextBb}
                    className="form-checkbox h-4 w-4 text-amber-500 border-gray-500 rounded focus:ring-0"
                />
                <span className={`ml-2 ${nextBbQueued ? "text-amber-300" : "text-white"} ${textSize}`}>Sit Out Next Big Blind</span>
            </label>
        </div>
    );
};

export default SitOutControls;
