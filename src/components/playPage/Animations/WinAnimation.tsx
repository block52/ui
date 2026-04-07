import React from "react";
import { useWinnerInfo } from "../../../hooks/game/useWinnerInfo";
import { WinAnimationProps } from "../../../types/index";
import "./WinAnimation.css";

const WinAnimation: React.FC<WinAnimationProps & { position?: { left: string; top: string } }> = React.memo(({ index, position }) => {
    const { winnerInfo } = useWinnerInfo();

    const isWinner = !!winnerInfo?.some(w => w.seat === index + 1);
    if (!isWinner || !position) return null;

    return (
        <div className="win-animation-container" style={{ left: position.left, top: position.top }}>
            {[0, 1, 2, 3].map(i => (
                <div key={`ring-${i}`} className={`win-animation-ring win-animation-ring-${i}`} />
            ))}
            <ul className="bubbles">
                {[0, 1, 2, 3, 4].map((_, i) => (
                    <li key={i} className="bubble" />
                ))}
            </ul>
        </div>
    );
});

WinAnimation.displayName = "WinAnimation";
export default WinAnimation;
