import React, { useEffect, useState } from "react";
import { useNextToActInfo } from "../../../hooks/game/useNextToActInfo";
import { useReplay } from "../../../context/gameState/ReplayContext";
import { TurnAnimationProps } from "../../../types/index";
import "./TurnAnimation.css";
import { PlayerDTO } from "@block52/poker-vm-sdk";

const TurnAnimation: React.FC<TurnAnimationProps & { position?: { left: string; top: string }; tableActivePlayers?: PlayerDTO[] }> = React.memo(
    ({ index, position, tableActivePlayers }) => {
        const { seat: nextToActSeat } = useNextToActInfo();
        const { isReplayMode } = useReplay();
        const [isCurrentPlayersTurn, setIsCurrentPlayersTurn] = useState(false);
        useEffect(() => {
            setIsCurrentPlayersTurn(nextToActSeat === index + 1);
        }, [nextToActSeat, index]);

        // A hand replay is a frozen snapshot — there is no live "next to act", so the
        // pulsing turn ring must never show (ui#721). It would otherwise flash forever
        // on whichever seat the snapshot happened to leave as next-to-act.
        if (isReplayMode) return null;

        if (tableActivePlayers && tableActivePlayers.length === 1) return null; // Don't show turn animation if only 1 player is on the table

        if (!isCurrentPlayersTurn || !position) return null;

        return (
            <div className="turn-animation-container" style={{ left: position.left, top: position.top }}>
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`turn-animation-ring turn-animation-ring-${i}`} />
                ))}
            </div>
        );
    }
);

TurnAnimation.displayName = "TurnAnimation";
export default TurnAnimation;
