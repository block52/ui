/**
 * ChipLeaderboard (ui#280)
 *
 * Live chip standings overlay for tournaments / sit-and-gos: each player's
 * rank, chip count and share of the chips in play, re-ranked on every
 * WebSocket frame. Front-end-only — derived from `gameState.players` via
 * `computeChipStandings`, so it needs no indexer (#721) and shows chips in
 * play *right now*, not winnings/buy-in P&L.
 *
 * The component gates itself: it renders nothing unless the "Chip Leaderboard"
 * setting is on AND the table is a tournament/SNG. Callers can mount it
 * unconditionally on the felt.
 */

import React, { useMemo } from "react";
import { isTournamentFormat } from "@block52/poker-vm-sdk";
import { useGameData } from "../../../context/gameState/GameDataContext";
import { useGameStateContext } from "../../../context/GameStateContext";
import { useGameSettings } from "../../../context/GameSettingsContext";
import { useProfileAvatar } from "../../../context/profile/ProfileAvatarContext";
import { computeChipStandings, ChipStanding } from "../../../utils/leaderboard";
import { truncateHash } from "../../../utils/formatUtils";

const LeaderboardRow: React.FC<{ standing: ChipStanding }> = ({ standing }) => {
    const { getAvatarForAddress } = useProfileAvatar();
    const avatarUrl = getAvatarForAddress(standing.address, standing.avatar);

    return (
        <div
            className={`flex items-center gap-2 py-1.5 px-2 rounded-md border-b border-white/5 last:border-0 ${
                standing.isBusted ? "opacity-40" : ""
            }`}
        >
            <span className="w-5 flex-shrink-0 text-center text-[11px] font-bold text-gray-300 tabular-nums">{standing.rank}</span>
            {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-5 h-5 flex-shrink-0 rounded-full object-cover" />
            ) : (
                <span className="w-5 h-5 flex-shrink-0 rounded-full bg-white/10" aria-hidden="true" />
            )}
            <span className="flex-1 min-w-0 truncate text-[11px] text-white" title={standing.address}>
                {truncateHash(standing.address, 4)}
            </span>
            <span className="flex-shrink-0 text-[11px] font-semibold text-white tabular-nums">
                {standing.isBusted ? "OUT" : standing.stack.toLocaleString()}
            </span>
            <span className="w-11 flex-shrink-0 text-right text-[10px] text-gray-400 tabular-nums">
                {standing.isBusted ? "" : `${standing.pctOfChips.toFixed(1)}%`}
            </span>
        </div>
    );
};

export const ChipLeaderboard: React.FC = () => {
    const { gameState } = useGameData();
    const { gameFormat } = useGameStateContext();
    const { showLeaderboard } = useGameSettings();

    const summary = useMemo(() => computeChipStandings(gameState?.players), [gameState?.players]);

    // Gate: opt-in setting, tournament/SNG only, and we actually have players.
    if (!showLeaderboard || !isTournamentFormat(gameFormat) || summary.standings.length === 0) {
        return null;
    }

    return (
        <div className="chip-leaderboard bg-[#1a2234]/95 rounded-xl border border-white/10 shadow-2xl backdrop-blur-sm w-56 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <h3 className="text-[11px] font-bold tracking-wide text-white uppercase">Chip Leaderboard</h3>
                <span className="text-[10px] text-gray-400">{summary.playersRemaining} left</span>
            </div>
            <div className="max-h-64 overflow-y-auto px-1 py-1">
                {summary.standings.map(standing => (
                    <LeaderboardRow key={standing.address} standing={standing} />
                ))}
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/10 text-[10px] text-gray-400">
                <span>Avg stack</span>
                <span className="tabular-nums">{Math.round(summary.averageStack).toLocaleString()}</span>
            </div>
        </div>
    );
};

ChipLeaderboard.displayName = "ChipLeaderboard";

export default ChipLeaderboard;
