import React from "react";
import { Link } from "react-router-dom";
import { AnimatedBackground } from "../../components/common/AnimatedBackground";
import styles from "./AdminDashboard.module.css";

interface AdminMenuItem {
    path: string;
    label: string;
    description: string;
    icon: string;
}

// Bridge Management section
const bridgeMenuItems: AdminMenuItem[] = [
    {
        path: "/admin/bridge",
        label: "Deposit",
        description: "Deposit USDC from Ethereum",
        icon: "M12 4v16m0-16l-4 4m4-4l4 4"
    },
    {
        path: "/bridge/withdrawals",
        label: "Withdrawals",
        description: "Withdraw USDC to Ethereum",
        icon: "M12 20V4m0 16l-4-4m4 4l4-4"
    }
];

// Developer Tools section
const devToolsMenuItems: AdminMenuItem[] = [
    {
        path: "/admin/genesis",
        label: "Genesis State",
        description: "View and debug genesis configuration",
        icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    },
    {
        path: "/admin/test-signing",
        label: "Test Signing",
        description: "Test message signing and verification",
        icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    }
];

// Reusable card component
const MenuCard: React.FC<{ item: AdminMenuItem }> = ({ item }) => (
    <Link
        to={item.path}
        className={`p-6 rounded-lg border transition-all duration-200 hover:scale-[1.02] ${styles.menuCard}`}
    >
        <div className="flex items-start gap-4">
            <div
                className={`p-3 rounded-lg ${styles.menuIconContainer}`}
            >
                <svg
                    className={`w-6 h-6 ${styles.brandIcon}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                </svg>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                    {item.label}
                </h3>
                <p className="text-gray-400 text-sm">
                    {item.description}
                </p>
            </div>
        </div>
    </Link>
);

const AdminDashboard: React.FC = () => {
    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-8 text-center">
                <h1 className="text-4xl font-bold text-white mb-2">
                    Admin Dashboard
                </h1>
                <p className="text-gray-400">
                    Development and administrative tools for managing the poker platform
                </p>
            </div>

            {/* Warning Banner */}
            <div className="mb-8 flex justify-center">
                <div
                    className={`inline-flex items-center gap-3 p-4 rounded-lg border ${styles.warningBanner}`}
                >
                    <svg className="w-6 h-6 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <p className="text-yellow-400 font-semibold">Development Mode Only</p>
                        <p className="text-yellow-400/70 text-sm">
                            These tools are only available in development environments.
                        </p>
                    </div>
                </div>
            </div>

            {/* Operator / Club Admin Section (ui#795) */}
            <div className="mb-10">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className={`w-5 h-5 ${styles.brandIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" />
                    </svg>
                    Club / Operator
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <MenuCard
                        item={{
                            path: "/admin/club",
                            label: "Club Admin",
                            description: "Operator back office — players & KYC, hand review, agents, games, finance.",
                            icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        }}
                    />
                </div>
            </div>

            {/* Bridge Management Section */}
            <div className="mb-10">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className={`w-5 h-5 ${styles.brandIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Bridge Management
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bridgeMenuItems.map((item) => (
                        <MenuCard key={item.path} item={item} />
                    ))}
                </div>
            </div>

            {/* Developer Tools Section */}
            <div>
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className={`w-5 h-5 ${styles.brandIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    </svg>
                    Developer Tools
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devToolsMenuItems.map((item) => (
                        <MenuCard key={item.path} item={item} />
                    ))}
                </div>
            </div>

            {/* Powered by Block52 Footer */}
            <div className="fixed bottom-4 left-4 flex items-center z-10 opacity-30">
                <div className="flex flex-col items-start bg-transparent px-3 py-2 rounded-lg backdrop-blur-sm border-0">
                    <div className="text-left mb-1">
                        <span className="text-xs text-white font-medium tracking-wide">POWERED BY</span>
                    </div>
                    <img src="/block52.png" alt="Block52 Logo" className="h-6 w-auto object-contain pointer-events-none" />
                </div>
            </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
