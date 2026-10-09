import React from "react";
import { Link } from "react-router-dom";

export interface PageTab {
    key: string;
    label: string;
    /** Route to navigate to; omit for in-page tabs driven by onSelect. */
    to?: string;
}

interface PageTabsProps {
    tabs: ReadonlyArray<PageTab>;
    activeKey: string;
    ariaLabel: string;
    onSelect?: (key: string) => void;
}

const tabClass = (active: boolean): string =>
    `px-3.5 py-3 -mb-px border-b-2 whitespace-nowrap text-sm transition-colors ${
        active ? "border-brand text-ink font-semibold" : "border-transparent text-ink-muted font-medium hover:text-ink"
    }`;

/** Underlined section tabs under a page title (Explorer sections, Node portal). */
export const PageTabs: React.FC<PageTabsProps> = ({ tabs, activeKey, ariaLabel, onSelect }) => (
    <nav aria-label={ariaLabel} className="flex gap-1 border-b border-line overflow-x-auto">
        {tabs.map(tab => {
            const active = tab.key === activeKey;
            return tab.to ? (
                <Link key={tab.key} to={tab.to} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                    {tab.label}
                </Link>
            ) : (
                <button key={tab.key} type="button" aria-current={active ? "page" : undefined} onClick={() => onSelect?.(tab.key)} className={tabClass(active)}>
                    {tab.label}
                </button>
            );
        })}
    </nav>
);
