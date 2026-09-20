import * as React from "react";
import { memo, useMemo, useCallback, useState, useEffect } from "react";
import Badge from "../common/Badge";
import { useWinnerInfo } from "../../../hooks/game/useWinnerInfo";
import { useWinnerCards } from "../../../hooks/game/useWinnerCards";
import { usePlayerData } from "../../../hooks/player/usePlayerData";
import { usePlayerTimer } from "../../../hooks/player/usePlayerTimer";
import { useParams } from "react-router-dom";
import type { PlayerProps } from "../../../types/index";
import { useGameStateContext } from "../../../context/GameStateContext";
import { useDealerPosition } from "../../../hooks/game/useDealerPosition";
import CustomDealer from "../../../assets/CustomDealer.svg";
import { getCardImageUrl, getCardBackUrl, type CardBackStyle } from "../../../utils/cardImages";
import { useHoleCardDealContext } from "../../../context/HoleCardDealContext";
import { viteEnv } from "../../../utils/viteEnv";
import { useSitAndGoPlayerResults } from "../../../hooks/game/useSitAndGoPlayerResults";
import { useAllInEquity } from "../../../hooks/player/useAllInEquity";
import { useProfileAvatar } from "../../../context/profile/ProfileAvatarContext";
import { useNetwork } from "../../../context/NetworkContext";
import { useActionSubmit } from "../../../context/ActionSubmitContext";
import { SIT_IN_METHOD_POST_NOW, sitIn } from "../../../hooks/playerActions";
import { hasElements } from "../../../utils/guards";
import { getSeatOpacityClass } from "../../../utils/seatOpacity";
import styles from "./PlayersCommon.module.css";
import "../Card/UserCards.css";

const Player: React.FC<PlayerProps & { uiPosition?: number; cardBackStyle?: CardBackStyle }> = memo(
    ({ left, top, index, currentIndex: _currentIndex, color, status: _status, uiPosition, cardBackStyle }) => {
        const { id } = useParams<{ id: string }>();
        const { playerData, stackValue, isFolded, isAllIn, isSeated, isSittingOut, holeCards, round } = usePlayerData(index);
        const { winnerInfo, winnerBySeat } = useWinnerInfo();
        const winnerCards = useWinnerCards();
        const { extendTime, canExtend, isCurrentUserTurn, isActive: isTurnTimerActive } = usePlayerTimer(id, index);

        const { dealerSeat } = useDealerPosition();
        const { equities, shouldShow: shouldShowEquity } = useAllInEquity();
        const { getAvatarForAddress } = useProfileAvatar();
        const { currentNetwork } = useNetwork();
        const { submit } = useActionSubmit();

        // Dealing choreography (ui#21): hold the placeholder while this seat's
        // cards are in flight, show backs once they land, flip to the faces once
        // the whole deal has landed. Idle = dealt + revealed, so nothing changes
        // outside a deal.
        const { isDealt, viewerRevealed } = useHoleCardDealContext();
        const dealt = isDealt(index);

        // Callback for "I'm Back" button on badge — routes through the
        // ActionSubmitController (dedupe / serialize / retry / error toast).
        const handleSitInFromBadge = useCallback(() => {
            if (id) {
                submit({ actionName: "sit-in", run: () => sitIn(id, currentNetwork, SIT_IN_METHOD_POST_NOW) });
            }
        }, [id, currentNetwork, submit]);

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
        const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

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
        const hasWinner = useMemo(() => hasElements(winnerInfo), [winnerInfo]);

        // 2) memoize winner check via the shared seat index (#2455)
        const isWinner = useMemo(() => winnerBySeat.has(index), [winnerBySeat, index]);

        // 3) dim the seat based on how involved this player is in the hand
        //    (see getSeatOpacityClass — dims seated/sitting-out/sitting-in/busted/folded).
        const opacityClass = getSeatOpacityClass({ status: playerData?.status, hasWinner, isWinner });

        // 4) memoize winner amount
        const winnerAmount = useMemo(() => {
            return winnerBySeat.get(index)?.formattedAmount ?? null;
        }, [winnerBySeat, index]);

        // 4b) memoize winner hand description (e.g. "Full House")
        const winnerHandDescription = useMemo(() => {
            return winnerBySeat.get(index)?.description ?? null;
        }, [winnerBySeat, index]);

        // 5) render hole cards — each as a 3D flip card (Card/UserCards.css):
        //    front = card back, back = the face; `flipped` shows the face. Mounted
        //    already flipped outside a deal, so the flip only ever animates at the
        //    end of a deal, when viewerRevealed goes false → true.
        const renderCards = useCallback(() => {
            if (!holeCards || holeCards.length !== 2 || !dealt) {
                return <div className="w-[120px] h-[80px]"></div>;
            }

            const hasWinningCards = winnerCards.size > 0;
            const backSrc = getCardBackUrl(cardBackStyle);
            const flippedClass = viewerRevealed ? " flipped" : "";

            return (
                <>
                    {holeCards.map((card, cardIndex) => {
                        const lift = isWinner && hasWinningCards && winnerCards.has(card);
                        const mute = isWinner && hasWinningCards && !winnerCards.has(card);
                        const faceSrc = getCardImageUrl(card);
                        return (
                            <div
                                key={`${cardIndex}-${card}`}
                                className={`handcard mb-[11px]${flippedClass}${lift ? " animate-win-card" : ""}${mute ? " opacity-40" : ""}`}
                                data-testid="hole-card"
                            >
                                <div className="handcard-inner">
                                    <div className="handcard-front">
                                        <img src={backSrc} alt="" width={60} height={80} />
                                    </div>
                                    <div className="handcard-back">
                                        <img
                                            src={faceSrc}
                                            alt={`Your card ${cardIndex + 1}`}
                                            width={60}
                                            height={80}
                                            onError={_e => console.error(`❌ Player ${index} card${cardIndex + 1} failed to load:`, faceSrc)}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </>
            );
        }, [holeCards, index, isWinner, winnerCards, dealt, viewerRevealed, cardBackStyle]);

        // 6) container style for positioning
        const containerStyle = useMemo(
            () => ({
                left,
                top
            }),
            [left, top]
        );

        const selectedAvatarUrl = useMemo(() => {
            return getAvatarForAddress(playerData?.address, playerData?.avatar);
        }, [getAvatarForAddress, playerData?.address, playerData?.avatar]);

        useEffect(() => {
            setAvatarLoadFailed(false);
        }, [selectedAvatarUrl]);

        if (!playerData) {
            return <></>;
        }

        return (
            <div
                key={index}
                className={`${opacityClass} absolute flex flex-col justify-center w-[160px] h-[140px] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer ${styles.secondaryText} ${styles.positionTransition}`}
                style={containerStyle}
            >
                {/* Development Mode Debug Info */}
                {viteEnv.VITE_NODE_ENV === "development" && (
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
                <div className="relative flex flex-col justify-end mt-[-6px] mx-1">
                    {selectedAvatarUrl && !avatarLoadFailed && (
                        <div className={styles.avatarChip}>
                            <img
                                src={selectedAvatarUrl}
                                alt="Player avatar"
                                className={styles.avatarImage}
                                onError={() => setAvatarLoadFailed(true)}
                            />
                        </div>
                    )}
                    {selectedAvatarUrl && avatarLoadFailed && (
                        <div className={`${styles.avatarChip} ${styles.avatarFallback}`}>
                            NFT
                        </div>
                    )}
                    {/* Spacer preserves the 55px flow height the old status bar occupied */}
                    <div className="w-full h-[55px]" />
                    <div className="absolute top-[-10px] w-full">
                        <Badge
                            count={index}
                            value={stackValue}
                            color={color}
                            canExtend={shouldShowTimerExtension}
                            // onExtend={shouldShowTimerExtension ? handleExtendTime : undefined}
                            tournamentPlace={tournamentResult?.place}
                            tournamentPayout={tournamentResult?.payout}
                            isWinner={isWinner}
                            winnerAmount={winnerAmount}
                            winnerHandDescription={winnerHandDescription}
                            isTurnTimerActive={isTurnTimerActive}
                            round={round}
                            isFolded={isFolded}
                            isAllIn={isAllIn}
                            isSeated={isSeated}
                            isSittingOut={isSittingOut}
                            playerEquity={playerEquity}
                            onSitIn={isSittingOut ? handleSitInFromBadge : undefined}
                        />
                    </div>

                    {/* Dealer Button — rendered at table level using geometry positions */}
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
            prevProps.status === nextProps.status &&
            prevProps.cardBackStyle === nextProps.cardBackStyle
        );
    }
);

Player.displayName = "Player";

export default Player;
