import React from "react";
import { formatCountdown, formatStartsAt } from "../../utils/scheduledSng";
import { formatUsdc, phaseLabel, type TournamentLobbyCard } from "../../utils/tournamentLobby";

interface TournamentCardProps {
    card: TournamentLobbyCard;
    nowMs: number;
    onRegister: (card: TournamentLobbyCard) => void;
    onUnregister: (card: TournamentLobbyCard) => void;
}

const CHIP_CLASS: Record<TournamentLobbyCard["phase"], string> = {
    open: "bg-green-900/40 text-green-300 border-green-700",
    full: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
    starting: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
    running: "bg-blue-900/40 text-blue-300 border-blue-700",
    finished: "bg-gray-700/60 text-gray-300 border-gray-600",
    cancelled: "bg-red-900/40 text-red-300 border-red-700"
};

const Stat: React.FC<{ label: string; value: string; testId?: string }> = ({ label, value, testId }) => (
    <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
        <div className="text-sm text-white font-medium" data-testid={testId}>
            {value}
        </div>
    </div>
);

/** One tournament in the lobby: the field, the clock, the money and the register / unregister action. */
export const TournamentCard: React.FC<TournamentCardProps> = ({ card, nowMs, onRegister, onUnregister }) => {
    const registering = card.phase === "open" || card.phase === "full";
    return (
        <div className="rounded-xl border border-gray-700 bg-gray-900/70 backdrop-blur-md p-4 flex flex-col gap-3" data-testid="tournament-card">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="text-white font-semibold truncate" title={card.tournamentId}>
                        Tournament {card.tournamentId.slice(0, 8)}…{card.tournamentId.slice(-4)}
                    </div>
                    <div className="text-xs text-gray-400">
                        {card.seatsPerTable}-max tables · {Number(card.startingStack).toLocaleString("en-US")} chips · {card.blindLabel}
                    </div>
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${CHIP_CLASS[card.phase]}`} data-testid="tournament-phase">
                    {phaseLabel(card.phase)}
                </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Registered" value={`${card.registered} / ${card.maxEntrants}`} testId="tournament-registered" />
                <Stat label="Buy-in" value={formatUsdc(card.cost.gross)} testId="tournament-buyin" />
                <Stat
                    label={card.prizePoolIsProjected ? "Prize pool (so far)" : "Prize pool"}
                    value={formatUsdc(card.prizePoolMicro)}
                    testId="tournament-prizepool"
                />
                <Stat
                    label={registering ? "Starts in" : "Started"}
                    value={registering ? formatCountdown(card.startsAtMs, nowMs) : formatStartsAt(card.startsAtMs, nowMs)}
                    testId="tournament-countdown"
                />
            </div>

            <div className="text-xs text-gray-400">
                Starts {formatStartsAt(card.startsAtMs, nowMs)} · needs {card.minEntrants} to run
                {card.atRiskOfCancelling && (
                    <span className="text-yellow-400" data-testid="tournament-at-risk">
                        {" "}
                        · {card.minEntrants - card.registered} more needed or it cancels
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2">
                {card.isRegistered && card.canUnregister ? (
                    <button
                        type="button"
                        onClick={() => onUnregister(card)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 transition-colors"
                        data-testid="tournament-unregister"
                    >
                        Unregister
                    </button>
                ) : card.isRegistered ? null : (
                    <button
                        type="button"
                        onClick={() => onRegister(card)}
                        disabled={!card.canRegister}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="tournament-register"
                    >
                        Register · {formatUsdc(card.cost.gross)}
                    </button>
                )}
                {card.isRegistered && (
                    <span className="text-xs text-green-400" data-testid="tournament-you-are-in">
                        You are registered
                    </span>
                )}
                {!card.canRegister && !card.isRegistered && card.registerBlockedReason && (
                    <span className="text-xs text-gray-400">{card.registerBlockedReason}</span>
                )}
            </div>
        </div>
    );
};
