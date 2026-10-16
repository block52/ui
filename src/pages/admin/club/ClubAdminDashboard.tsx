import React from "react";
import { Link } from "react-router-dom";
import { AnimatedBackground } from "../../../components/common/AnimatedBackground";

/**
 * Operator / club admin hub (ui#795). The landing page for a white-label operator's
 * back office, linking to the five areas. Scaffold: the areas are stubs for now and
 * get built out behind operator auth with real data as follow-ups.
 */
interface ClubArea {
    path: string;
    label: string;
    description: string;
    icon: string;
}

const CLUB_AREAS: ClubArea[] = [
    {
        path: "/admin/club/players",
        label: "Players & KYC",
        description: "Players on the club, KYC'd vs non-KYC'd, balances, VIP tier & rakeback.",
        icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z"
    },
    {
        path: "/admin/club/hands",
        label: "Hand Review",
        description: "Review a player's hands for collusion and chip dumping; flag suspicious pairs.",
        icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    },
    {
        path: "/admin/club/agents",
        label: "Agents",
        description: "Agents recruiting players, their rakeback deals, and who's performing.",
        icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    },
    {
        path: "/admin/club/games",
        label: "Game Management",
        description: "Open and pre-stage cash tables and SNGs so they're ready for players.",
        icon: "M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.953-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4m9-1.5a9 9 0 11-18 0 9 9 0 0118 0z"
    },
    {
        path: "/admin/club/finance",
        label: "Finance Overview",
        description: "Money in / money out — deposits, withdrawals, rake, agent payouts, net.",
        icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
    }
];

const AreaCard: React.FC<{ area: ClubArea }> = ({ area }) => (
    <Link
        to={area.path}
        className="p-6 rounded-lg border border-gray-700 bg-gray-900/40 transition-all duration-200 hover:scale-[1.02] hover:border-pink-500/50"
    >
        <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-pink-500/10">
                <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={area.icon} />
                </svg>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-white mb-1">{area.label}</h3>
                <p className="text-gray-400 text-sm">{area.description}</p>
            </div>
        </div>
    </Link>
);

const ClubAdminDashboard: React.FC = () => (
    <div className="min-h-screen p-8 relative">
        <AnimatedBackground />
        <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-2">
                <Link to="/admin" className="text-sm text-gray-400 hover:text-white transition-colors">
                    ← Admin
                </Link>
            </div>
            <div className="mb-8 text-center">
                <h1 className="text-4xl font-bold text-white mb-2">Club Admin</h1>
                <p className="text-gray-400">Operator back office for white-label clubs — players, agents, games and money.</p>
            </div>

            <div className="mb-8 flex justify-center">
                <div className="inline-flex items-center gap-3 p-4 rounded-lg border border-pink-500/30 bg-pink-500/5">
                    <span className="text-pink-400 font-semibold">Scaffold</span>
                    <p className="text-pink-200/70 text-sm">Starting point (ui#795) — areas are stubs to refine, then wire behind operator auth.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {CLUB_AREAS.map(area => (
                    <AreaCard key={area.path} area={area} />
                ))}
            </div>
        </div>
    </div>
);

export default ClubAdminDashboard;
