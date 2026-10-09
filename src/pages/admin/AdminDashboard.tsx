import React from "react";
import { Link } from "react-router-dom";
import { PoweredBy } from "../../components/common/PoweredBy";

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

const bridgeSectionIcon = "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4";
const devToolsSectionIcon =
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z";

const SectionLabel: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
    <h2 className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
        <svg className="w-4 h-4 text-brand-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
        </svg>
        {children}
    </h2>
);

// Reusable card component
const MenuCard: React.FC<{ item: AdminMenuItem }> = ({ item }) => (
    <Link
        to={item.path}
        className="group flex items-center gap-4 min-h-[44px] p-5 rounded-2xl bg-surface-card border border-line transition-colors hover:bg-surface-hover hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-light"
    >
        <div className="w-10 h-10 shrink-0 rounded-xl bg-brand/15 text-brand-light grid place-items-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
            </svg>
        </div>
        <div className="min-w-0 flex-1">
            <h3 className="text-ink font-semibold">{item.label}</h3>
            <p className="text-ink-muted text-sm">{item.description}</p>
        </div>
        <svg
            className="w-5 h-5 shrink-0 text-ink-muted transition-colors group-hover:text-ink"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
    </Link>
);

const AdminDashboard: React.FC = () => {
    return (
        <div className="min-h-screen bg-surface-page">
            <div className="max-w-[1376px] mx-auto px-4 sm:px-8 py-8 flex flex-col min-h-[calc(100vh-73px)]">
                <div className="mb-8">
                    <h1 className="text-[28px] font-semibold text-ink mb-2">Admin Dashboard</h1>
                    <p className="text-ink-muted">Development and administrative tools for managing the poker platform</p>
                </div>

                <div className="mb-8 flex items-start gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10">
                    <svg className="w-5 h-5 mt-0.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <p className="text-amber-300 font-semibold">Development Mode Only</p>
                        <p className="text-amber-300/70 text-sm">These tools are only available in development environments.</p>
                    </div>
                </div>

                {/* Two sections side by side on wide screens, each with its cards stacked,
                    so the page fills its width however many tools each section holds. */}
                <div className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-10 items-start">
                    <section>
                        <SectionLabel icon={bridgeSectionIcon}>Bridge Management</SectionLabel>
                        <div className="flex flex-col gap-3">
                            {bridgeMenuItems.map(item => (
                                <MenuCard key={item.path} item={item} />
                            ))}
                        </div>
                    </section>

                    <section>
                        <SectionLabel icon={devToolsSectionIcon}>Developer Tools</SectionLabel>
                        <div className="flex flex-col gap-3">
                            {devToolsMenuItems.map(item => (
                                <MenuCard key={item.path} item={item} />
                            ))}
                        </div>
                    </section>
                </div>

                <PoweredBy />
            </div>
        </div>
    );
};

export default AdminDashboard;
