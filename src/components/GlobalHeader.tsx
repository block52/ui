import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { NetworkSelector } from "./NetworkSelector";
import { useNetwork } from "../context/NetworkContext";
import { getCosmosClient } from "../utils/cosmos/client";
import { ProfileAvatarButton } from "./profile";
import styles from "./GlobalHeader.module.css";

interface MenuItem {
    path: string;
    label: string;
    icon: string;
    badge?: string;
    iconOnly?: boolean; // Show only icon, hide label (for discreet menu items)
    newTab?: boolean; // Open link in new tab
}

// Logo component with error handling - uses VITE_CLUB_LOGO env variable
// Falls back to /logo1080.png if not set, then to text if image fails
// Memoized to prevent unnecessary re-renders
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

// Reusable component for network status and selector (extracted to avoid recreation on every render)
const NetworkStatusAndSelector: React.FC<{ latestBlockHeight: string | null; hasError: boolean }> = ({ latestBlockHeight, hasError }) => (
    <>
        {/* Block Height Indicator - clickable link to block explorer */}
        {latestBlockHeight && (
            <Link
                to={`/explorer/block/${latestBlockHeight}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity ${styles.blockHeightLink}`}
            >
                <div className={`w-2 h-2 rounded-full animate-pulse ${hasError ? "bg-red-400" : "bg-green-400"}`}></div>
                <span className={`text-sm font-mono ${styles.blockHeightText}`}>
                    #{latestBlockHeight}
                </span>
            </Link>
        )}

        <NetworkSelector />
    </>
);

export const GlobalHeader: React.FC = () => {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { currentNetwork } = useNetwork();
    const [latestBlockHeight, setLatestBlockHeight] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    // Fetch latest block height
    useEffect(() => {
        const fetchBlockHeight = async () => {
            try {
                const cosmosClient = getCosmosClient({
                    rpc: currentNetwork.rpc,
                    rest: currentNetwork.rest
                });

                if (!cosmosClient) return;

                const blocks = await cosmosClient.getLatestBlocks(1);
                if (blocks.length > 0) {
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
    }, [currentNetwork]);

    // Don't show header on game table pages (they have their own layout)
    // But DO show it on /table/admin
    const hideOnPaths = ["/table/"];
    const shouldHide = hideOnPaths.some(path => location.pathname.startsWith(path)) && location.pathname !== "/table/admin";

    // Hide header on Nouns landing page (it has its own full-screen layout)
    const isNounsLanding = import.meta.env.VITE_TABLE_STYLE === "nouns" && location.pathname === "/";

    if (shouldHide || isNounsLanding) {
        return null;
    }

    // User-facing menu items (always visible)
    // Note: Wallet removed - accessible via settings button in Dashboard
    // Note: Withdrawals moved to Admin > Bridge Management section
    const userMenuItems: MenuItem[] = [
        { path: "/admin/tables", label: "Tables", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
        { path: "/explorer", label: "Block Explorer", icon: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }
    ];

    // Admin/dev menu items - icon only for discreet access
    const adminMenuItems: MenuItem[] = [
        { path: "/admin", label: "Admin", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z", iconOnly: true }
    ];

    // User-facing menu items only (admin moved to right side of header)
    const menuItems: MenuItem[] = [...userMenuItems];

    return (
        <header
            className={`sticky top-0 z-40 w-full ${styles.headerShell}`}
        >
            <div className="container mx-auto px-4 py-3">
                {/* Desktop Layout: 3-column flexbox with logo+nav on left, network status on right */}
                <div className="hidden lg:flex items-center justify-between">
                    {/* Left: Logo + Navigation */}
                    <div className="flex items-center gap-6">
                        <Link to="/" className="hover:opacity-80 transition-opacity flex items-center">
                            <LogoComponent />
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="flex items-center gap-1">
                            {menuItems.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    target={item.newTab ? "_blank" : undefined}
                                    rel={item.newTab ? "noopener noreferrer" : undefined}
                                    className={`${item.iconOnly ? "px-2" : "px-3"} py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-80 flex items-center gap-1.5 ${location.pathname === item.path ? styles.navItemActive : styles.navItemInactive}`}
                                    title={item.iconOnly ? item.label : undefined}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                                    </svg>
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

                    {/* Right: Admin + Network Status & Selector */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <NetworkStatusAndSelector latestBlockHeight={latestBlockHeight} hasError={hasError} />
                        {/* Admin icon - discreet access */}
                        <Link
                            to="/admin"
                            className={`p-2 rounded-lg transition-all duration-200 hover:opacity-80 ${location.pathname === "/admin" ? styles.navItemActive : styles.navItemInactive}`}
                            title="Admin"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            </svg>
                        </Link>
                        <ProfileAvatarButton title="Open avatar picker" />
                    </div>
                </div>

                {/* Mobile/Tablet Layout: Keep original structure */}
                <div className="flex lg:hidden items-center justify-between">
                    {/* Left side - Logo/Title */}
                    <Link to="/" className="hover:opacity-80 transition-opacity flex items-center">
                        <LogoComponent />
                    </Link>

                    {/* Right side - Network Selector & Mobile Menu */}
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-4">
                            <NetworkStatusAndSelector latestBlockHeight={latestBlockHeight} hasError={hasError} />
                        </div>
                        <div className="md:hidden">
                            <NetworkSelector />
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className={`p-2 rounded-lg hover:opacity-80 transition-opacity ${styles.mobileMenuButton}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                {/* Mobile Navigation Menu */}
                {isMenuOpen && (
                    <nav className={`lg:hidden mt-4 pb-2 border-t pt-4 ${styles.mobileMenuNav}`}>
                        <div className="flex flex-col gap-2">
                            {[...menuItems, ...adminMenuItems].map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    target={item.newTab ? "_blank" : undefined}
                                    rel={item.newTab ? "noopener noreferrer" : undefined}
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-80 flex items-center gap-2 ${location.pathname === item.path ? styles.navItemActive : styles.navItemInactive}`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                                    </svg>
                                    {item.label}
                                    {item.badge && (
                                        <span
                                            className={`ml-auto px-2 py-0.5 rounded text-xs font-semibold ${styles.badgePill}`}
                                        >
                                            {item.badge}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </nav>
                )}
            </div>
        </header>
    );
};
