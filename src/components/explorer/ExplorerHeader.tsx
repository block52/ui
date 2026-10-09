import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageTabs, PageTab } from "../ui";
import { explorerSearchPath } from "../../utils/explorerSearch";

interface ExplorerHeaderProps {
    title?: string;
    subtitle?: string;
}

/** Explorer sections. Address lookup is reached through the search box (a b52… query). */
const EXPLORER_TABS: ReadonlyArray<PageTab> = [
    { key: "blocks", label: "Latest blocks", to: "/explorer" },
    { key: "accounts", label: "Accounts", to: "/explorer/accounts" },
    { key: "hands", label: "My hands", to: "/hands" },
    { key: "players", label: "Players", to: "/players" },
    { key: "distribution", label: "Hand distribution", to: "/explorer/distribution" }
];

/** Which tab a route belongs to; detail pages light up their parent list. */
const activeTabFor = (path: string): string => {
    if (path.startsWith("/explorer/distribution")) return "distribution";
    if (path.startsWith("/explorer/accounts") || path.startsWith("/explorer/address")) return "accounts";
    if (path.startsWith("/explorer/hand") || path.startsWith("/hands")) return "hands";
    if (path.startsWith("/players")) return "players";
    if (path === "/explorer" || path.startsWith("/explorer/block") || path.startsWith("/explorer/tx")) return "blocks";
    return "";
};

const SearchIcon = () => (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
    </svg>
);

/** Explorer page title, the unified search (height, tx hash or b52 address) and the section tabs. */
export const ExplorerHeader = ({ title = "Block Explorer", subtitle = "Pokerchain · blocks, accounts and hands" }: ExplorerHeaderProps) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [query, setQuery] = useState("");

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const path = explorerSearchPath(query);
        if (path) {
            navigate(path);
            setQuery("");
        }
    };

    return (
        <div className="flex flex-col gap-5 mb-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1 min-w-0 max-w-[640px]">
                    <h1 className="m-0 text-[28px] leading-tight font-semibold text-ink">{title}</h1>
                    <p className="m-0 text-ink-muted leading-normal">{subtitle}</p>
                </div>
                <form role="search" onSubmit={submit} className="w-full sm:w-auto sm:flex-[0_1_420px] sm:min-w-[260px]">
                    <label className="flex items-center gap-2 h-11 px-4 rounded-full border border-line bg-surface-card text-ink-muted focus-within:border-brand transition-colors">
                        <SearchIcon />
                        <input
                            type="search"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Block height, tx hash or b52 address"
                            aria-label="Search by block height, tx hash or b52 address"
                            className="flex-1 min-w-0 bg-transparent border-0 text-sm text-ink-body placeholder:text-ink-muted outline-none"
                        />
                    </label>
                </form>
            </div>
            <PageTabs tabs={EXPLORER_TABS} activeKey={activeTabFor(pathname)} ariaLabel="Explorer sections" />
        </div>
    );
};

export default ExplorerHeader;
