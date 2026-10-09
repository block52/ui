import { useState, useEffect } from "react";
import { ExplorerPage, explorerThClass } from "../components/explorer/ExplorerPanel";
import { useParams, useNavigate } from "react-router-dom";
import { microToUsdc } from "../constants/currency";
import { truncateMiddle } from "../utils/stringUtils";
import { isEmpty, hasElements } from "../utils/guards";
import { Pagination } from "../components/common";
import { VipBadge } from "../components/players/VipBadge";
import { formatScaledPercent } from "../utils/vip";
import { usePlayerProfile } from "../hooks/player/usePlayerProfile";
import { usePlayerSessions } from "../hooks/player/usePlayerSessions";

const SESSIONS_PAGE_SIZE = 20;

const formatUsd = (micro: number): string => {
    const value = microToUsdc(micro);
    const sign = value < 0 ? "-" : "";
    return `${sign}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const StatCard: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass = "text-ink" }) => (
    <div className={`p-5 rounded-2xl bg-surface-card border border-line`}>
        <p className="text-ink-muted text-sm mb-1">{label}</p>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
);

export default function PlayerProfilePage() {
    const { address } = useParams<{ address: string }>();
    const navigate = useNavigate();
    const [sessionsPage, setSessionsPage] = useState(1);
    const [copied, setCopied] = useState(false);

    const { profile, loading, error } = usePlayerProfile(address);
    const {
        sessions,
        total: sessionsTotal,
        loading: sessionsLoading
    } = usePlayerSessions(address, SESSIONS_PAGE_SIZE, (sessionsPage - 1) * SESSIONS_PAGE_SIZE);

    useEffect(() => {
        document.title = address ? `Player ${truncateMiddle(address, 8, 6)} - Block52` : "Player - Block52";
        return () => {
            document.title = "Block52 Chain";
        };
    }, [address]);

    const copyAddress = () => {
        if (!address) return;
        navigator.clipboard.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <ExplorerPage title="Player Profile">

                <button onClick={() => navigate("/players")} className="mb-4 text-sm text-ink-muted hover:text-ink transition-colors">
                    ← Back to players
                </button>

                {loading ? (
                    <div className={`rounded-2xl p-8 text-center bg-surface-card border border-line`}>
                        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 border-brand`}></div>
                        <p className="text-ink-muted">Loading player...</p>
                    </div>
                ) : error ? (
                    <div className="p-6 rounded-2xl bg-surface-card border border-red-400/50">
                        <p className="text-red-400 text-center">{error}</p>
                    </div>
                ) : !profile ? (
                    <div className={`p-8 rounded-2xl text-center bg-surface-card border border-line`}>
                        <p className="text-ink-muted">No data for this player.</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className={`p-6 rounded-2xl mb-6 bg-surface-card border border-line`}>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className={`font-mono text-sm break-all text-brand-light`}>{profile.player_address}</span>
                                    <button onClick={copyAddress} className="text-xs text-ink-muted hover:text-ink transition-colors">
                                        {copied ? "Copied!" : "Copy"}
                                    </button>
                                </div>
                                <VipBadge tier={profile.vip_tier} rakebackPct={profile.rakeback_pct} showRakeback />
                            </div>
                        </div>

                        {/* Volume & money */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <StatCard label="Hands Played" value={profile.total_hands.toLocaleString()} />
                            <StatCard
                                label="Net Profit"
                                value={formatUsd(profile.net_profit)}
                                valueClass={profile.net_profit >= 0 ? "text-green-400 [[data-theme=light]_&]:text-green-700" : "text-red-400"}
                            />
                            <StatCard label="Total Buy-In" value={formatUsd(profile.total_buy_ins)} />
                            <StatCard label="Total Cash-Out" value={formatUsd(profile.total_cash_outs)} />
                            <StatCard label="Sessions" value={profile.session_count.toLocaleString()} />
                            <StatCard label="Total Actions" value={profile.total_actions.toLocaleString()} />
                            <StatCard label="Rake Contributed" value={formatUsd(profile.total_rake_contributed)} />
                            <StatCard label="VIP Points" value={profile.vip_points.toLocaleString()} />
                        </div>

                        {/* Playing style */}
                        <div className={`p-6 rounded-2xl mb-6 bg-surface-card border border-line`}>
                            <h2 className="text-ink font-bold mb-4">Playing Style</h2>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div>
                                    <p className="text-ink-muted text-sm mb-1">VPIP</p>
                                    <p className="text-xl font-bold text-ink">{formatScaledPercent(profile.vpip)}</p>
                                </div>
                                <div>
                                    <p className="text-ink-muted text-sm mb-1">PFR</p>
                                    <p className="text-xl font-bold text-ink">{formatScaledPercent(profile.pfr)}</p>
                                </div>
                                <div>
                                    <p className="text-ink-muted text-sm mb-1">Aggression</p>
                                    <p className="text-xl font-bold text-ink">{(profile.aggression_factor / 100).toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-ink-muted text-sm mb-1">WTSD</p>
                                    <p className="text-xl font-bold text-ink">{formatScaledPercent(profile.wtsd)}</p>
                                </div>
                                <div>
                                    <p className="text-ink-muted text-sm mb-1">W$SD</p>
                                    <p className="text-xl font-bold text-ink">{formatScaledPercent(profile.won_at_showdown)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Records */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                            <StatCard label="Biggest Pot Won" value={formatUsd(profile.biggest_pot_won)} />
                            <StatCard label="Biggest Hand Profit" value={formatUsd(profile.biggest_hand_profit)} />
                            <StatCard label="Longest Session (blocks)" value={profile.longest_session_blocks.toLocaleString()} />
                        </div>

                        {/* Session history */}
                        <div className={`rounded-2xl overflow-hidden bg-surface-card border border-line`}>
                            <div className="px-6 py-4 border-b border-line">
                                <h2 className="text-ink font-bold">Session History</h2>
                            </div>
                            {sessionsLoading ? (
                                <div className="p-8 text-center">
                                    <div className={`animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3 border-brand`}></div>
                                    <p className="text-ink-muted">Loading sessions...</p>
                                </div>
                            ) : isEmpty(sessions) ? (
                                <div className="p-8 text-center">
                                    <p className="text-ink-muted">No sessions recorded</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr>
                                                <th className={explorerThClass}>Game</th>
                                                <th className={`${explorerThClass} text-right`}>Join Block</th>
                                                <th className={`${explorerThClass} text-right`}>Leave Block</th>
                                                <th className={`${explorerThClass} text-right`}>Buy-In</th>
                                                <th className={`${explorerThClass} text-right`}>Cash-Out</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sessions.map((s, i) => (
                                                <tr key={`${s.game_id}-${s.join_block}-${i}`} className="border-t border-line">
                                                    <td className="px-6 py-4">
                                                        <span className={`font-mono text-sm text-brand-light`}>{truncateMiddle(s.game_id, 8, 6)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-ink-soft">{s.join_block.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right text-ink-soft">
                                                        {s.leave_block != null ? s.leave_block.toLocaleString() : "—"}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-ink-soft">{formatUsd(s.buy_in_amount)}</td>
                                                    <td className="px-6 py-4 text-right text-ink-soft">
                                                        {s.cash_out_amount != null ? formatUsd(s.cash_out_amount) : "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {!sessionsLoading && hasElements(sessions) && sessionsTotal > SESSIONS_PAGE_SIZE && (
                                <Pagination
                                    currentPage={sessionsPage}
                                    totalItems={sessionsTotal}
                                    pageSize={SESSIONS_PAGE_SIZE}
                                    onPageChange={setSessionsPage}
                                />
                            )}
                        </div>
                    </>
                )}
        </ExplorerPage>
    );
}
