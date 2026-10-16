import React from "react";
import { Link } from "react-router-dom";
import { AnimatedBackground } from "../../../components/common/AnimatedBackground";

/**
 * Shared chrome for the operator / club admin area (ui#795). A titled page with a
 * back link to the club hub and an optional "what goes here" outline, so each stub
 * area reads consistently while it's still a scaffold to refine.
 */
export interface ClubAdminLayoutProps {
    title: string;
    subtitle?: string;
    /** Bulleted outline of what this area will hold — shown as a scaffold note. */
    planned?: string[];
    children?: React.ReactNode;
}

export const ClubAdminLayout: React.FC<ClubAdminLayoutProps> = ({ title, subtitle, planned, children }) => (
    <div className="min-h-screen p-8 relative">
        <AnimatedBackground />
        <div className="max-w-6xl mx-auto relative z-10">
            <div className="mb-6">
                <Link to="/admin/club" className="text-sm text-gray-400 hover:text-white transition-colors">
                    ← Club admin
                </Link>
            </div>

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
                {subtitle && <p className="text-gray-400">{subtitle}</p>}
            </div>

            {/* Scaffold banner — this area is a placeholder to be refined + wired to real data. */}
            <div className="mb-8 inline-flex items-start gap-3 p-4 rounded-lg border border-pink-500/30 bg-pink-500/5">
                <span className="text-pink-400 font-semibold">Scaffold</span>
                <p className="text-pink-200/70 text-sm">
                    Placeholder UI only — no real data is wired yet. Refine the layout here, then we build it out behind
                    operator auth with live data.
                </p>
            </div>

            {planned && planned.length > 0 && (
                <div className="mb-8 p-5 rounded-lg border border-gray-700 bg-gray-900/40">
                    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">What goes here</h2>
                    <ul className="list-disc list-inside space-y-1.5 text-gray-400 text-sm">
                        {planned.map(item => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>
            )}

            {children}
        </div>
    </div>
);
