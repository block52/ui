import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { copyToClipboard } from "../utils/clipboard";
import { truncateMiddle } from "../utils/stringUtils";
import { Card, PillButton } from "./ui";

interface WalletPanelProps {
    onDeposit: () => void;
    onWithdraw: () => void;
    onTransfer: () => void;
    onCreateWallet: () => void;
    onImportWallet: () => void;
    onRefresh?: () => Promise<void>;
    usdcBalance: string;
    cosmosWalletAddress: string | null;
}

const ghostIconClass =
    "w-11 h-11 lg:w-9 lg:h-9 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-light";

const RefreshIcon: React.FC<{ spinning?: boolean }> = ({ spinning = false }) => (
    <svg
        className={`w-[18px] h-[18px] ${spinning ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
        <path d="M21 3v5h-5" />
    </svg>
);

const ManageIcon: React.FC = () => (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </svg>
);

const CopyIcon: React.FC = () => (
    <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const CardTitle: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <h2 className="m-0 text-lg font-semibold text-ink">Game Wallet</h2>
        {children && <div className="flex gap-0.5">{children}</div>}
    </div>
);

const WalletPanel: React.FC<WalletPanelProps> = ({
    onDeposit,
    onWithdraw,
    onTransfer,
    onCreateWallet,
    onImportWallet,
    onRefresh,
    usdcBalance,
    cosmosWalletAddress
}) => {
    const navigate = useNavigate();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        if (!onRefresh || isRefreshing) return;
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setIsRefreshing(false);
        }
    }, [onRefresh, isRefreshing]);

    if (!cosmosWalletAddress) {
        return (
            <Card>
                <CardTitle />
                <div className="px-5 pt-3 pb-5 flex flex-col gap-4">
                    <p className="m-0 text-ink-soft">Create or import a wallet to start playing.</p>
                    <div className="flex flex-col gap-2.5">
                        <PillButton variant="primary" size="lg" className="w-full" onClick={onCreateWallet}>
                            Create New Wallet
                        </PillButton>
                        <PillButton variant="outline" size="md" className="w-full" onClick={onImportWallet}>
                            Import Existing Wallet
                        </PillButton>
                    </div>
                </div>
            </Card>
        );
    }

    const balance = Number(usdcBalance);

    return (
        <Card>
            <CardTitle>
                {onRefresh && (
                    <button type="button" onClick={handleRefresh} disabled={isRefreshing} className={ghostIconClass} title="Refresh balance" aria-label="Refresh balance">
                        <RefreshIcon spinning={isRefreshing} />
                    </button>
                )}
                <button type="button" onClick={() => navigate("/wallet")} className={ghostIconClass} title="Manage wallet" aria-label="Manage wallet">
                    <ManageIcon />
                </button>
            </CardTitle>

            <div className="px-5 pt-3 pb-5 flex flex-col gap-[18px]">
                <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="text-xs uppercase tracking-[0.08em] text-ink-muted">USDC balance</span>
                    <span className="text-4xl font-bold text-ink tabular-nums tracking-tight leading-tight">${balance.toFixed(2)}</span>
                    <div className="flex items-center gap-1 text-ink-muted min-w-0">
                        <span className="font-mono text-[13px] truncate" title={cosmosWalletAddress}>
                            {truncateMiddle(cosmosWalletAddress, 7, 7, "…")}
                        </span>
                        <button
                            type="button"
                            onClick={() => copyToClipboard(cosmosWalletAddress, "Address copied to clipboard!")}
                            className={ghostIconClass}
                            title="Copy wallet address"
                            aria-label="Copy wallet address"
                        >
                            <CopyIcon />
                        </button>
                    </div>
                </div>

                {balance === 0 && <p className="m-0 px-3.5 py-3 rounded-[10px] leading-snug bg-brand/15 text-brand-light">Deposit USDC to take a seat.</p>}

                <div className="grid grid-cols-3 lg:grid-cols-2 gap-2 lg:gap-2.5">
                    <PillButton variant="primary" size="md" className="w-full lg:col-span-2 lg:h-12 lg:text-[15px]" onClick={onDeposit}>
                        Deposit
                    </PillButton>
                    <PillButton variant="outline" size="md" className="w-full px-2" onClick={onWithdraw}>
                        Withdraw
                    </PillButton>
                    <PillButton variant="outline" size="md" className="w-full px-2" onClick={onTransfer}>
                        Send
                    </PillButton>
                </div>
            </div>
        </Card>
    );
};

export default WalletPanel;
