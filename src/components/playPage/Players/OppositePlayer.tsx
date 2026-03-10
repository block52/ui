/**
 * OppositePlayer Component
 *
 * Represents other players at the poker table (not the current user).
 * Displays player's cards, stack, status, and winner information.
 *
 * Props:
 * - left/top: Position on the table
 * - index: Seat number
 * - color: Player's color theme
 * - cardBackStyle: Style for card backs
 */

import * as React from "react";
import Badge from "../common/Badge";
import ProgressBar from "../common/ProgressBar";
import { useWinnerInfo } from "../../../hooks/game/useWinnerInfo";
import { usePlayerData } from "../../../hooks/player/usePlayerData";
import { useShowingCardsByAddress } from "../../../hooks/player/useShowingCardsByAddress";
import { useDealerPosition } from "../../../hooks/game/useDealerPosition";
import CustomDealer from "../../../assets/CustomDealer.svg";
import { colors } from "../../../utils/colorConfig";
import { useSitAndGoPlayerResults } from "../../../hooks/game/useSitAndGoPlayerResults";
import { getCardImageUrl, getCardBackUrl, CardBackStyle } from "../../../utils/cardImages";
import { useAllInEquity } from "../../../hooks/player/useAllInEquity";
import styles from "./PlayersCommon.module.css";

type OppositePlayerProps = {
    left?: string;
    top?: string;
    index: number;
    currentIndex: number;
    color?: string;
    status?: string;
    uiPosition?: number;
    cardBackStyle?: CardBackStyle;
};

const OppositePlayer: React.FC<OppositePlayerProps> = React.memo(({ left, top, index, color, uiPosition, cardBackStyle }) => {
    const { playerData, stackValue, isFolded, isAllIn, isSeated, isSittingOut, isBusted, holeCards, round } = usePlayerData(index);
    const { winnerInfo } = useWinnerInfo();
    const { equities, shouldShow: shouldShowEquity } = useAllInEquity();

    // Get equity for this player if available
    const playerEquity = React.useMemo((): number | null => {
        if (!shouldShowEquity || !equities.has(index)) return null;
        return equities.get(index) ?? null;
    }, [shouldShowEquity, equities, index]);
    const { showingPlayers } = useShowingCardsByAddress();
    const { dealerSeat } = useDealerPosition();

    // Check if this seat is the dealer
    const isDealer = dealerSeat === index;

    // Get tournament results for this seat
    const { getSeatResult, isSitAndGo } = useSitAndGoPlayerResults();
    const tournamentResult = React.useMemo(() => {
        return isSitAndGo ? getSeatResult(index) : null;
    }, [getSeatResult, isSitAndGo, index]);

    // 1) detect when any winner exists
    const hasWinner = React.useMemo(() => Array.isArray(winnerInfo) && winnerInfo.length > 0, [winnerInfo]);

    // Check if this player is a winner
    const isWinner = React.useMemo(() => {
        if (!winnerInfo) return false;
        return winnerInfo.some((winner: any) => winner.seat === index);
    }, [winnerInfo, index]);

    // 2) dim non-winners when someone has won, also dim busted players like sitting out
    const opacityClass = hasWinner ? (isWinner ? "opacity-100" : "opacity-40") : (isSeated || isSittingOut || isBusted) ? "opacity-50" : isFolded ? "opacity-60" : "opacity-100";

    // Get winner amount if this player is a winner
    const winnerAmount = React.useMemo(() => {
        if (!isWinner || !winnerInfo) return null;
        const winner = winnerInfo.find((w: any) => w.seat === index);
        return winner ? winner.formattedAmount : null;
    }, [isWinner, winnerInfo, index]);

    // Check if this player is showing cards
    const isShowingCards = React.useMemo(() => {
        if (!showingPlayers || !playerData) return false;
        return showingPlayers.some((p: { seat: number }) => p.seat === index);
    }, [showingPlayers, playerData, index]);

    // Get the showing cards for this player if available
    const showingCards = React.useMemo(() => {
        if (!isShowingCards || !showingPlayers) return null;
        const playerShowingCards = showingPlayers.find((p: { seat: number; holeCards: string[] }) => p.seat === index);
        return playerShowingCards ? playerShowingCards.holeCards : null;
    }, [isShowingCards, showingPlayers, index]);

    if (!playerData) {
        return <></>;
    }

    return (
        <>
            {/* Main player display */}
            <div
                key={index}
                className={`${opacityClass} absolute flex flex-col justify-center w-[160px] h-[140px] mt-[40px] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-[20] ${styles.secondaryText} ${styles.positionTransition}`}
                style={{
                    left: left,
                    top: top
                }}
            >
                {/* Development Mode Debug Info */}
                {import.meta.env.VITE_NODE_ENV === "development" && (
                    <div className="absolute top-[-60px] left-1/2 transform -translate-x-1/2 bg-blue-600 bg-opacity-80 text-white px-2 py-1 rounded text-[10px] whitespace-nowrap z-50 border border-blue-400">
                        <div className="text-blue-200">UI Pos: {uiPosition ?? "N/A"}</div>
                        <div className="text-yellow-300">Seat: {index}</div>
                        <div className="text-gray-200">XY: {left}, {top}</div>
                        <div className="text-orange-300">Addr: ...{playerData?.address ? playerData.address.slice(-3) : "N/A"}</div>
                    </div>
                )}
                <div className="flex justify-center gap-1">
                    {holeCards && holeCards.length === 2 ? (
                        isShowingCards && showingCards ? (
                            // Show the actual cards if player is showing
                            <>
                                <img src={getCardImageUrl(showingCards[0])} alt="Player Card 1" width={60} height={80} className="mb-[11px]" />
                                <img src={getCardImageUrl(showingCards[1])} alt="Player Card 2" width={60} height={80} className="mb-[11px]" />
                            </>
                        ) : (
                            // Show card backs for opponents (they shouldn't see actual cards)
                            <>
                                <img src={getCardBackUrl(cardBackStyle)} alt="Opposite Player Card" width={60} height={80} className="mb-[11px]"  />
                                <img src={getCardBackUrl(cardBackStyle)} alt="Opposite Player Card" width={60} height={80} className="mb-[11px]"  />
                            </>
                        )
                    ) : (
                        <div className="w-[120px] h-[80px]"></div>
                    )}
                </div>
                <div className="relative flex flex-col justify-end mt-[-6px] mx-1">
                    <div
                        style={{ backgroundColor: isWinner ? colors.accent.success : (color || "#6b7280") }}
                        className={`b-[0%] mt-[auto] w-full h-[55px] shadow-[1px_2px_6px_2px_rgba(0,0,0,0.3)] rounded-tl-2xl rounded-tr-2xl rounded-bl-md rounded-br-md flex flex-col ${
                            isWinner 
                        }`}
                    >
                        {/* Progress bar is not shown in showdown */}
                        {!isWinner && round !== "showdown" && <ProgressBar index={index} />}
                        {!isWinner && (isSeated || isSittingOut) && (
                            <span className={`font-bold animate-progress delay-2000 flex items-center w-full h-2 mb-2 mt-auto gap-2 justify-center ${styles.whiteText}`}>SITTING OUT</span>
                        )}
                        {!isWinner && isFolded && (
                            <span className={`animate-progress delay-2000 flex items-center w-full h-2 mb-2 mt-auto gap-2 justify-center ${styles.whiteText}`}>FOLD</span>
                        )}
                        {!isWinner && isAllIn && (
                            <span className={`animate-progress delay-2000 flex flex-col items-center w-full mb-2 mt-auto gap-0 justify-center ${styles.whiteText}`}>
                                <span>ALL IN</span>
                                {playerEquity !== null && (
                                    <span className="text-yellow-400 font-bold text-sm">
                                        {playerEquity.toFixed(1)}%
                                    </span>
                                )}
                            </span>
                        )}
                        {isWinner && winnerAmount && (
                            <span className={`font-bold flex items-center justify-center w-full h-8 mt-[22px] gap-1 text-base ${styles.whiteText}`}>
                                WINS: {winnerAmount}
                            </span>
                        )}
                    </div>
                    <div className="absolute top-[-10px] w-full">
                        <Badge
                            count={index}
                            value={stackValue}
                            color={color}
                            tournamentPlace={tournamentResult?.place}
                            tournamentPayout={tournamentResult?.payout}
                        />
                    </div>

                    {/* Dealer Button - TODO: Implement framer motion animation in future iteration */}
                    {isDealer && (
                        <div className="absolute top-[-85px] right-[-40px] w-12 h-12 z-20">
                            <img src={CustomDealer} alt="Dealer Button" className="w-full h-full" />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function - only re-render if meaningful props change
    return (
        prevProps.left === nextProps.left &&
        prevProps.top === nextProps.top &&
        prevProps.index === nextProps.index &&
        prevProps.color === nextProps.color
    );
});

export default OppositePlayer;
