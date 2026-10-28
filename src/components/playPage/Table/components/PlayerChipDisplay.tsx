import * as React from "react";
import { usePlayerChipData } from "../../../../hooks/player/usePlayerChipData";
import { type BetSide, dealerSideFor } from "../../../../config/stageGeometry";
import Chip from "../../common/Chip";
import DealerButtonDisplay from "./DealerButtonDisplay";

interface PlayerChipDisplayProps {
    seatIndex: number;
    left: string;
    bottom: string;
    /** When set, the bet group is centred on (left, top) instead of anchored by bottom. */
    top?: string;
    /** The seat's felt edge; picks which side of the bet the dealer button goes on. */
    side?: BetSide;
    /** This seat holds the dealer button: draw it beside the bet (ui#835). */
    isDealer?: boolean;
    isTournament: boolean;
}

/**
 * Single-seat bet group: the chip pill and, for the button seat, the dealer
 * button beside it. Subscribes per-seat to usePlayerChipData so a WS update
 * affecting one seat re-renders only that seat's chip (#424). Memoized so
 * prop-stable parent re-renders skip when this seat's chip amount and
 * position haven't changed.
 */
const PlayerChipDisplay: React.FC<PlayerChipDisplayProps> = React.memo(({ seatIndex, left, bottom, top, side, isDealer = false, isTournament }) => {
    const { chipAmount } = usePlayerChipData(seatIndex);
    const hasBet = !!chipAmount && chipAmount !== "0";
    const centered = top !== undefined;
    const style = React.useMemo(
        () => ({
            left,
            bottom: centered ? undefined : bottom,
            top,
            transform: centered ? "translate(-50%, -50%)" : undefined
        }),
        [left, bottom, top, centered]
    );
    if (!hasBet && !isDealer) return null;
    return (
        <div className="chip-position" style={style}>
            {/* With no bet, an empty box keeps the bet's footprint so the button sits where it would beside chips. */}
            {hasBet ? <Chip amount={chipAmount} isTournament={isTournament} /> : <span className="bet-group-empty" />}
            {isDealer && <DealerButtonDisplay side={dealerSideFor(side)} />}
        </div>
    );
});

PlayerChipDisplay.displayName = "PlayerChipDisplay";

export default PlayerChipDisplay;
