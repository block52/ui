import * as React from "react";
import { memo, useMemo, useCallback, useState, useEffect } from "react";
import Badge from "../common/Badge";
import ProgressBar from "../common/ProgressBar";
import { useWinnerInfo } from "../../../hooks/game/useWinnerInfo";
import { usePlayerData } from "../../../hooks/player/usePlayerData";
import { usePlayerTimer } from "../../../hooks/player/usePlayerTimer";
import { useParams } from "react-router-dom";
import type { PlayerProps } from "../../../types/index";
import { useGameStateContext } from "../../../context/GameStateContext";
import { useDealerPosition } from "../../../hooks/game/useDealerPosition";
import CustomDealer from "../../../assets/CustomDealer.svg";
import { colors } from "../../../utils/colorConfig";
import { getCardImageUrl } from "../../../utils/cardImages";
import { useSitAndGoPlayerResults } from "../../../hooks/game/useSitAndGoPlayerResults";
import { useAllInEquity } from "../../../hooks/player/useAllInEquity";
import styles from "./PlayersCommon.module.css";

const Player: React.FC<PlayerProps & { uiPosition?: number }> = memo(
    ({ left, top, index, currentIndex: _currentIndex, color, status: _status, uiPosition }) => {
        const { id } = useParams<{ id: string }>();
        const { playerData, stackValue, isFolded, isAllIn, isSeated, isSittingOut, isBusted, holeCards, round } = usePlayerData(index);
        const { winnerInfo } = useWinnerInfo();
        const { extendTime, canExtend, isCurrentUserTurn } = usePlayerTimer(id, index);

        const { dealerSeat } = useDealerPosition();
        const { equities, shouldShow: shouldShowEquity } = useAllInEquity();

        // Check if this seat is the dealer
        const isDealer = dealerSeat === index;

        // Get equity for this player if available
        const playerEquity = useMemo((): number | null => {
            if (!shouldShowEquity || !equities.has(index)) return null;
            return equities.get(index) ?? null;
        }, [shouldShowEquity, equities, index]);

        // Get tournament results for this seat
        const { getSeatResult, isSitAndGo } = useSitAndGoPlayerResults();
        const tournamentResult = useMemo(() => {
            return isSitAndGo ? getSeatResult(index) : null;
        }, [getSeatResult, isSitAndGo, index]);

        // State for extension UI feedback
        const [isExtending, setIsExtending] = useState(false);

        // Handle time extension
        const _handleExtendTime = () => {
            setIsExtending(true);

            // Use the timer hook's extend function
            extendTime?.();

            // Show brief feedback then reset
            setTimeout(() => {
                setIsExtending(false);
            }, 1500);
        };

        // Reset extending state when it's not the player's turn
        useEffect(() => {
            if (!isCurrentUserTurn) {
                setIsExtending(false);
            }
        }, [isCurrentUserTurn]);

        // Get player count to determine if timer should be active
        const { gameState } = useGameStateContext();
        const playerCount = gameState?.players?.length || 0;

        // Only show timer extension when there are 2+ players
        const shouldShowTimerExtension = playerCount >= 2 && canExtend && isCurrentUserTurn && !isExtending;

        // 1) detect when any winner exists
        const hasWinner = useMemo(() => Array.isArray(winnerInfo) && winnerInfo.length > 0, [winnerInfo]);

        // 2) memoize winner check
        const isWinner = useMemo(() => !!winnerInfo?.some((w: any) => w.seat === index), [winnerInfo, index]);

        // 3) dim non-winners when someone has won, also dim busted players like sitting out
        const opacityClass = hasWinner ? (isWinner ? "opacity-100" : "opacity-40") : (isSeated || isSittingOut || isBusted) ? "opacity-50" : isFolded ? "opacity-60" : "opacity-100";

        // 4) memoize winner amount
        const winnerAmount = useMemo(() => {
            if (!isWinner || !winnerInfo) return null;
            const winner = winnerInfo.find((w: any) => w.seat === index);
            return winner?.formattedAmount ?? null;
        }, [isWinner, winnerInfo, index]);

        // 5) render hole cards
        const renderCards = useCallback(() => {
            if (!holeCards || holeCards.length !== 2) {
                return <div className="w-[120px] h-[80px]"></div>;
            }

            return (
                <>
                    <img
                        src={getCardImageUrl(holeCards[0])}
                        width={60}
                        height={80}
                        className="mb-[11px]"
                        onError={_e => console.error(`❌ Player ${index} card1 failed to load:`, getCardImageUrl(holeCards[0]))}
                    />
                    <img
                        src={getCardImageUrl(holeCards[1])}
                        width={60}
                        height={80}
                        className="mb-[11px]"
                        onError={_e => console.error(`❌ Player ${index} card2 failed to load:`, getCardImageUrl(holeCards[1]))}
                    />
                </>
            );
        }, [holeCards, index]);

        // 6) status text for folded, all-in, or winner
        const statusText = useMemo(() => {
            if (isWinner && winnerAmount) {
                return (
                    <span className={`font-bold flex items-center justify-center w-full h-8 mt-[22px] gap-1 text-base ${styles.whiteText}`}>
                        WINS: {winnerAmount}
                    </span>
                );
            }
            if (isSeated) {
                return (
                    <span className={`font-bold animate-progress delay-2000 flex items-center w-full h-2 mb-2 mt-auto gap-2 justify-center ${styles.whiteText}`}>
                        SEATED
                    </span>
                );
            }
            if (isSittingOut) {
                return (
                    <span className={`font-bold animate-progress delay-2000 flex items-center w-full h-2 mb-2 mt-auto gap-2 justify-center ${styles.whiteText}`}>
                        SITTING OUT
                    </span>
                );
            }
            if (isFolded) {
                return (
                    <span className={`animate-progress delay-2000 flex items-center w-full h-2 mb-2 mt-auto gap-2 justify-center ${styles.whiteText}`}>
                        FOLD
                    </span>
                );
            }
            if (isAllIn) {
                return (
                    <span className={`animate-progress delay-2000 flex flex-col items-center w-full mb-2 mt-auto gap-0 justify-center ${styles.whiteText}`}>
                        <span>ALL IN</span>
                        {playerEquity !== null && (
                            <span className="text-yellow-400 font-bold text-sm">
                                {playerEquity.toFixed(1)}%
                            </span>
                        )}
                    </span>
                );
            }
            return null;
        }, [isWinner, winnerAmount, isSeated, isSittingOut, isFolded, isAllIn, playerEquity]);

        // 7) container style for positioning
        const containerStyle = useMemo(
            () => ({
                left,
                top
            }),
            [left, top]
        );

        // 8) status bar style (no pulse)
        const statusBarStyle = useMemo(
            () => ({
                backgroundColor: isWinner ? colors.accent.success : color || "#6b7280"
            }),
            [isWinner, color]
        );

        if (!playerData) {
            return <></>;
        }

        return (
            <div
                key={index}
                className={`${opacityClass} absolute flex flex-col justify-center w-[160px] h-[140px] mt-[40px] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer ${styles.secondaryText} ${styles.positionTransition}`}
                style={containerStyle}
            >
                {/* Development Mode Debug Info */}
                {import.meta.env.VITE_NODE_ENV === "development" && (
                    <div className="absolute top-[-60px] left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-2 py-1 rounded text-[10px] whitespace-nowrap z-50 border border-green-400">
                        <div className="text-green-400">UI Pos: {uiPosition ?? "N/A"}</div>
                        <div className="text-yellow-400">Seat: {index}</div>
                        <div className="text-gray-300">
                            XY: {left}, {top}
                        </div>
                        <div className="text-orange-300">Addr: ...{playerData?.address ? playerData.address.slice(-3) : "N/A"}</div>
                    </div>
                )}
                <div className="flex justify-center gap-1">{renderCards()}</div>
                <div className="relative flex flex-col justify-end mt-[-6px] mx-1s">
                    <div
                        style={statusBarStyle}
                        className="b-[0%] mt-[auto] w-full h-[55px] shadow-[1px_2px_6px_2px_rgba(0,0,0,0.3)] rounded-tl-2xl rounded-tr-2xl rounded-bl-md rounded-br-md flex flex-col"
                    >
                        {!isWinner && round !== "showdown" && <ProgressBar index={index} />}
                        {statusText}
                    </div>
                    <div className="absolute top-[-10px] w-full">
                        <Badge
                            count={index}
                            value={stackValue}
                            color={color}
                            canExtend={shouldShowTimerExtension}
                            // onExtend={shouldShowTimerExtension ? handleExtendTime : undefined}
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
        );
    },
    (prevProps, nextProps) => {
        return (
            prevProps.left === nextProps.left &&
            prevProps.top === nextProps.top &&
            prevProps.index === nextProps.index &&
            prevProps.currentIndex === nextProps.currentIndex &&
            prevProps.color === nextProps.color &&
            prevProps.status === nextProps.status
        );
    }
);

Player.displayName = "Player";

export default Player;
