import React from "react";
import { usePlayerActionDropBox } from "../../../hooks/player/usePlayerActionDropBox";
import { useSeatJoinNotification } from "../../../hooks/notifications/useSeatJoinNotification";
import { useGameStateContext } from "../../../context/GameStateContext";
import { isTournamentFormat } from "../../../utils/gameFormatUtils";
import { formatForSitAndGo, formatForCashGame, formatUSDCToSimpleDollars } from "../../../utils/numberUtils";
import ProgressBar from "./ProgressBar";
import { colors } from "../../../utils/colorConfig";
import "./Badge.css";

type BadgeProps = {
    count: number; // Seat index
    value: number; // Stack value
    color?: string;
    // Timer extension props
    canExtend?: boolean;
    onExtend?: () => void;
    // Sit & Go tournament results
    tournamentPlace?: number;
    tournamentPayout?: string;
    // Seat banner state — passed from parent player component
    isWinner?: boolean;
    winnerAmount?: string | null;
    isTurnTimerActive?: boolean;
    round?: string | null;
    isFolded?: boolean;
    isAllIn?: boolean;
    isSeated?: boolean;
    isSittingOut?: boolean;
    playerEquity?: number | null;
    onSitIn?: () => void;
};

const Badge: React.FC<BadgeProps> = React.memo(({
    count, value, color, canExtend, onExtend,
    tournamentPlace, tournamentPayout,
    isWinner, winnerAmount, isTurnTimerActive,
    round, isFolded, isAllIn, isSeated, isSittingOut, playerEquity, onSitIn
}) => {
    // Track previous banner mode so we can detect timer→action transitions
    const prevBannerModeRef = React.useRef<string>("hidden");

    // Get game format to determine if it's a tournament-style game
    const { gameFormat } = useGameStateContext();
    const isTournament = isTournamentFormat(gameFormat);

    // Format the value based on game format using clean utility functions
    const formattedValue = isTournament
        ? formatForSitAndGo(value)  // Returns "10,000" format (tournament chips)
        : formatForCashGame(value);  // Returns "$100.00" format (cash game)

    // Get action display data for this player
    const actionDisplay = usePlayerActionDropBox(count);

    // Get seat join notification data for this player
    const seatJoinNotification = useSeatJoinNotification(count);

    // Determine if a transient (action/seat-join) message is active
    const hasTransientMessage =
        actionDisplay.isVisible ||
        actionDisplay.isAnimatingOut ||
        seatJoinNotification.isVisible ||
        seatJoinNotification.isAnimatingOut;

    // --- Unified banner mode resolution (priority order) ---
    // 1. Winner  2. Action  3. Seat-join  4. Timer/status  5. Hidden
    type BannerMode = "winner" | "action" | "seat-join" | "timer" | "hidden";

    const bannerMode: BannerMode = (() => {
        if (isWinner) return "winner";
        if (actionDisplay.isVisible || actionDisplay.isAnimatingOut) return "action";
        if (seatJoinNotification.isVisible || seatJoinNotification.isAnimatingOut) return "seat-join";
        if (isTurnTimerActive) return "timer";
        return "hidden";
    })();

    const isBannerVisible = bannerMode !== "hidden";

    // Derive transient animation flags for action / seat-join content
    const isTransientAnimatingOut = bannerMode === "action"
        ? actionDisplay.isAnimatingOut
        : bannerMode === "seat-join"
            ? seatJoinNotification.isAnimatingOut
            : false;

    const isTextHiding = bannerMode === "action"
        ? actionDisplay.isTextHiding
        : bannerMode === "seat-join"
            ? seatJoinNotification.isTextHiding
            : false;

    // Banner shell colour
    const bannerBg = isWinner
        ? colors.accent.success
        : (color || "#6b7280");

    const bannerStyle: React.CSSProperties = bannerMode === "action" || bannerMode === "seat-join"
        ? {
            backgroundColor: `${color || "#3b82f6"}dd`,
            borderColor: color || "#3b82f6",
            boxShadow: `0 4px 12px ${color || "#3b82f6"}40, 0 2px 4px rgba(0,0,0,0.3)`
        }
        : {
            backgroundColor: `${bannerBg}dd`,
            borderColor: bannerBg,
            borderWidth: "1px",
            borderStyle: "solid",
            boxShadow: `0 4px 12px ${bannerBg}40, 0 2px 4px rgba(0,0,0,0.3)`
        };

    // When the banner was already showing (e.g. timer) and an action arrives,
    // skip the shell dropdown animation — just swap the content inside.
    const wasAlreadyVisible = prevBannerModeRef.current !== "hidden";
    const isTransitionFromTimer = wasAlreadyVisible
        && (bannerMode === "action" || bannerMode === "seat-join")
        && !isTransientAnimatingOut;

    // Update the ref AFTER we've read the previous value
    React.useEffect(() => {
        prevBannerModeRef.current = bannerMode;
    }, [bannerMode]);

    // --- Transient (action / seat-join) enter/exit CSS class ---
    // If shell was already visible (timer was showing), skip the enter animation.
    const transientAnimClass = isTransientAnimatingOut
        ? "action-display-exit"
        : isTransitionFromTimer
            ? ""  // shell stays put — no enter animation needed
            : (bannerMode === "action" || bannerMode === "seat-join")
                ? "action-display-enter"
                : "";

    // Get place suffix (1st, 2nd, 3rd, 4th)
    const getPlaceSuffix = (place: number) => {
        if (place === 1) return "1st";
        if (place === 2) return "2nd";
        if (place === 3) return "3rd";
        return `${place}th`;
    };

    const getTournamentPlaceClass = (place: number) => {
        if (place === 1) return "tournament-place-first";
        if (place === 2) return "tournament-place-second";
        if (place === 3) return "tournament-place-third";
        return "tournament-place-other";
    };

    // --- Render inner content based on mode ---
    const renderBannerContent = () => {
        switch (bannerMode) {
            case "winner":
                return (
                    <span className="seat-banner-text font-bold flex items-center justify-center w-full h-8 mt-[22px] gap-1 text-base">
                        WINS: {winnerAmount}
                    </span>
                );

            case "action":
                return (
                    <div className={`action-display-content ${isTextHiding ? "action-display-content-hide" : ""}`}>
                        <span className="action-display-text">
                            {actionDisplay.action}
                        </span>
                        {actionDisplay.amount && (
                            <span className="action-display-amount">
                                {actionDisplay.amount}
                            </span>
                        )}
                    </div>
                );

            case "seat-join":
                return (
                    <div className={`action-display-content ${isTextHiding ? "action-display-content-hide" : ""}`}>
                        <span className="action-display-text">
                            YOUR SEAT
                        </span>
                    </div>
                );

            case "timer": {
                // Timer mode: show progress bar + status text
                return (
                    <>
                        {round !== "showdown" && <ProgressBar index={count} />}
                        {isSeated && (
                            <span className="seat-banner-text font-bold animate-progress delay-2000 flex items-center w-full h-2 mb-2 mt-auto gap-2 justify-center">
                                SEATED
                            </span>
                        )}
                        {isSittingOut && (
                            onSitIn ? (
                                <button
                                    className="sit-in-badge-button"
                                    onClick={(e) => { e.stopPropagation(); onSitIn(); }}
                                >
                                    I'm Back
                                </button>
                            ) : (
                                <span className="seat-banner-text font-bold animate-progress delay-2000 flex items-center w-full h-2 mb-2 mt-auto gap-2 justify-center">
                                    SITTING OUT
                                </span>
                            )
                        )}
                        {isFolded && (
                            <span className="seat-banner-text animate-progress delay-2000 flex items-center w-full h-2 mb-2 mt-auto gap-2 justify-center">
                                FOLD
                            </span>
                        )}
                        {isAllIn && (
                            <span className="seat-banner-text animate-progress delay-2000 flex flex-col items-center w-full mb-2 mt-auto gap-0 justify-center">
                                <span>ALL IN</span>
                                {playerEquity !== null && playerEquity !== undefined && (
                                    <span className="text-yellow-400 font-bold text-sm">
                                        {playerEquity.toFixed(1)}%
                                    </span>
                                )}
                            </span>
                        )}
                    </>
                );
            }

            default:
                return null;
        }
    };

    return (
        <div className="badge-container">
            <div style={{ backgroundColor: color }} className="badge-number">
                {count}
            </div>
            <div className="badge-value">
                {formattedValue}
            </div>

            {/* Tournament Results Display */}
            {tournamentPlace && (
                <div className="badge-tournament-results">
                    <div className={`tournament-place ${getTournamentPlaceClass(tournamentPlace)}`}>
                        {getPlaceSuffix(tournamentPlace)} Place
                    </div>
                    {tournamentPayout && tournamentPayout !== "0" && (
                        <div className="tournament-payout tournament-payout-win">
                            Won: ${formatUSDCToSimpleDollars(tournamentPayout)}
                        </div>
                    )}
                </div>
            )}

            {/* Unified seat banner — single animated container for all modes */}
            <div className={`seat-banner-shell ${isBannerVisible ? "seat-banner-visible" : "seat-banner-hidden"} ${transientAnimClass}`}>
                <div
                    className={`seat-banner-box ${
                        (bannerMode === "action" && !isTransientAnimatingOut) ? "action-display-pulse" : ""
                    }`}
                    style={bannerStyle}
                >
                    <div className={`seat-banner-content-inner ${isTransitionFromTimer ? "seat-banner-content-swap" : ""}`}>
                        {renderBannerContent()}
                    </div>
                </div>
            </div>

            {/* Timer Extension Icon - Timer icon inside badge */}
            {canExtend && onExtend && (
                <div
                    className="timer-extension-button"
                    onClick={onExtend}
                >
                    <svg
                        className="timer-extension-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        {/* Clock circle */}
                        <circle cx="12" cy="12" r="8" strokeWidth="2"/>
                        {/* Clock hands */}
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/>
                        {/* Plus symbol in corner */}
                        <circle cx="18" cy="6" r="3" fill="currentColor"/>
                        <path stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 6h2M18 5v2"/>
                    </svg>
                </div>
            )}
        </div>
    );
});

export default Badge;
