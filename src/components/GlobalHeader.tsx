import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { NetworkSelector } from "./NetworkSelector";
import { useNetwork } from "../context/NetworkContext";
import { getCosmosClient } from "../utils/cosmos/client";
import { ProfileAvatarButton } from "./profile";
import { ThemeToggle } from "./ui/ThemeToggle";
import { useTheme } from "../context/ThemeContext";
import { hasElements } from "../utils/guards";
import styles from "./GlobalHeader.module.css";

interface MenuItem {
    path: string;
    label: string;
    icon: string;
    badge?: string;
    iconOnly?: boolean;
    newTab?: boolean;
}

const LogoComponent: React.FC = React.memo(() => {
    const [imageError, setImageError] = useState(false);
    const clubLogo = import.meta.env.VITE_CLUB_LOGO;
    const clubName = import.meta.env.VITE_CLUB_NAME || "Block 52";
    const logoSrc = clubLogo || "/logo1080.png";

    if (imageError) {
        return (
            <span className={`text-xl font-bold ${styles.logoFallback}`}>
                {clubName}
            </span>
        );
    }

    return (
        <img
            src={logoSrc}
            alt={`${clubName} Logo`}
            className="h-8 w-auto object-contain"
            onError={() => setImageError(true)}
        />
    );
});

const NetworkStatusAndSelector: React.FC<{ latestBlockHeight: string | null; hasError: boolean }> = ({ latestBlockHeight, hasError }) => (
    <>
        {latestBlockHeight && (
            <Link
                to={`/explorer/block/${latestBlockHeight}`}
                className={`flex items-center gap-1.5 hover:text-ink transition-colors ${styles.blockHeightText}`}
            >
                <div className={`w-2 h-2 rounded-full animate-pulse ${hasError ? "bg-red-400" : "bg-emerald-400"}`}></div>
                <span className="text-sm tabular-nums">#{latestBlockHeight}</span>
            </Link>
        )}

        <NetworkSelector />
    </>
);

/** Tables lives at /admin/tables, and the lobby at "/" is the same screen, so both highlight it. */
const isItemActive = (pathname: string, itemPath: string): boolean =>
    pathname === itemPath || (itemPath === "/admin/tables" && pathname === "/");

export const GlobalHeader: React.FC = () => {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { currentNetwork } = useNetwork();
    const { preference: themePreference, toggle: toggleTheme } = useTheme();
    const [latestBlockHeight, setLatestBlockHeight] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    // Don't show header on game table pages (they have their own layout)
    // But DO show it on /table/admin
    const hideOnPaths = ["/table/"];
    const shouldHide = hideOnPaths.some(path => location.pathname.startsWith(path)) && location.pathname !== "/table/admin";

    useEffect(() => {
        // Hidden on this route — the poll would fetch, setState and re-render for
        // a header that renders null. The early `return null` below is AFTER this
        // effect, so without this guard /table/:id polls RPC for the whole session.
        if (shouldHide) {
            return;
        }

        const fetchBlockHeight = async () => {
            try {
                const cosmosClient = getCosmosClient({
                    rpc: currentNetwork.rpc,
                    rest: currentNetwork.rest
                });

                if (!cosmosClient) return;

                const blocks = await cosmosClient.getLatestBlocks(1);
                if (hasElements(blocks)) {
                    setLatestBlockHeight(blocks[0].block.header.height);
                    setHasError(false);
                }
            } catch {
                setHasError(true);
            }
        };

        fetchBlockHeight();
        const interval = setInterval(fetchBlockHeight, 10000); // Update every 10 seconds

        return () => clearInterval(interval);
    }, [currentNetwork, shouldHide]);

    if (shouldHide) {
        return null;
    }

    const userMenuItems: MenuItem[] = [
        { path: "/admin/tables", label: "Tables", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
        { path: "/explorer", label: "Block Explorer", icon: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" },
        { path: "/explorer/distribution", label: "Hand Distribution", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
        { path: "/nodes", label: "Nodes", icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" },
        { path: "/tech-notes", label: "Tech Notes", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    ];

    const adminMenuItems: MenuItem[] = [
        { path: "/admin", label: "Admin", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z", iconOnly: true }
    ];


    return (
        <header
            className={`sticky top-0 z-40 w-full ${styles.headerShell}`}
        >
            <div className="w-full px-4 lg:px-8 py-3.5">
                <div className="hidden lg:flex items-center justify-between">
                    <div className="flex items-center gap-7">
                        <Link to="/" className="hover:opacity-80 transition-opacity flex items-center">
                            <LogoComponent />
                        </Link>

                        <nav className="flex items-center gap-[22px]">
                            {userMenuItems.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    target={item.newTab ? "_blank" : undefined}
                                    rel={item.newTab ? "noopener noreferrer" : undefined}
                                    aria-current={isItemActive(location.pathname, item.path) ? "page" : undefined}
                                    className={`relative px-1 py-2 text-sm transition-colors flex items-center after:absolute after:left-0 after:right-0 after:-bottom-[18px] after:h-0.5 after:rounded-btn after:transition-opacity ${
                                        isItemActive(location.pathname, item.path)
                                            ? `${styles.navLinkActive} after:bg-brand after:opacity-100`
                                            : `${styles.navLinkInactive} after:bg-brand after:opacity-0 hover:after:opacity-40`
                                    }`}
                                    title={item.iconOnly ? item.label : undefined}
                                >
                                    {!item.iconOnly && item.label}
                                    {item.badge && (
                                        <span
                                            className={`ml-1 px-1.5 py-0.5 rounded text-xs font-semibold ${styles.badgePill}`}
                                        >
                                            {item.badge}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                        <NetworkStatusAndSelector latestBlockHeight={latestBlockHeight} hasError={hasError} />
                        <ThemeToggle />
                        <Link
                            to="/admin"
                            className={`p-2 rounded-lg transition-all duration-200 hover:opacity-80 ${location.pathname === "/admin" ? styles.navItemActive : styles.navItemInactive}`}
                            title="Admin"
                            aria-label="Admin"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            </svg>
                        </Link>
                        <ProfileAvatarButton title="Open avatar picker" />
                    </div>
                </div>

                <div className="flex lg:hidden items-center justify-between">
                    <Link to="/" className="hover:opacity-80 transition-opacity flex items-center">
                        <LogoComponent />
                    </Link>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-4">
                            <NetworkStatusAndSelector latestBlockHeight={latestBlockHeight} hasError={hasError} />
                        </div>
                        <div className="md:hidden">
                            <NetworkSelector />
                        </div>

                        <ThemeToggle className="hidden sm:grid" />
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                            aria-expanded={isMenuOpen}
                            className={`w-11 h-11 grid place-items-center rounded-btn border transition-colors ${
                                isMenuOpen ? "bg-surface-hover border-line-strong text-ink" : "border-transparent text-ink-soft hover:bg-surface-hover hover:text-ink"
                            }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                {isMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                        <ProfileAvatarButton title="Open avatar picker" />
                    </div>
                </div>

                {/* Mobile Navigation Menu: floats over the page instead of pushing it down */}
                {isMenuOpen && (
                    <div className="lg:hidden absolute inset-x-0 top-full">
                        <button
                            type="button"
                            aria-label="Close menu"
                            onClick={() => setIsMenuOpen(false)}
                            className="absolute inset-x-0 top-0 h-screen bg-black/60 backdrop-blur-sm cursor-default"
                        />
                        <nav aria-label="Main" className="relative bg-surface-card border-b border-line shadow-[0_24px_60px_rgba(0,0,0,0.55)] p-3 flex flex-col gap-1">
                            {userMenuItems.map(item => {
                                const active = isItemActive(location.pathname, item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        target={item.newTab ? "_blank" : undefined}
                                        rel={item.newTab ? "noopener noreferrer" : undefined}
                                        onClick={() => setIsMenuOpen(false)}
                                        aria-current={active ? "page" : undefined}
                                        className={`flex items-center gap-3 min-h-[52px] px-3 rounded-xl transition-colors ${
                                            active ? "bg-brand/10 text-ink" : "text-ink-body hover:bg-surface-hover"
                                        }`}
                                    >
                                        <span className={`w-9 h-9 rounded-lg grid place-items-center flex-none ${active ? "bg-brand/20 text-brand-light" : "bg-surface-raised text-ink-muted"}`}>
                                            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                                            </svg>
                                        </span>
                                        <span className="flex-1 text-[15px] font-medium">{item.label}</span>
                                        {item.badge && (
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles.badgePill}`}>{item.badge}</span>
                                        )}
                                        {active && <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-hidden="true" />}
                                    </Link>
                                );
                            })}

                            <div className="my-1 border-t border-line" />

                            {adminMenuItems.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    target={item.newTab ? "_blank" : undefined}
                                    rel={item.newTab ? "noopener noreferrer" : undefined}
                                    onClick={() => setIsMenuOpen(false)}
                                    aria-current={isItemActive(location.pathname, item.path) ? "page" : undefined}
                                    className="flex items-center gap-3 min-h-[44px] px-3 rounded-xl text-sm text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
                                >
                                    <span className="w-9 h-9 grid place-items-center flex-none">
                                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                                        </svg>
                                    </span>
                                    {item.label}
                                </Link>
                            ))}

                            <button
                                type="button"
                                onClick={toggleTheme}
                                className="flex items-center gap-3 min-h-[44px] px-3 rounded-xl text-sm text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
                            >
                                <span className="w-9 h-9 grid place-items-center flex-none">
                                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                                    </svg>
                                </span>
                                {themePreference === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                            </button>
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
};
