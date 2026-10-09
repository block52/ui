import { useLocation } from "react-router-dom";
import styles from "./ExplorerHeader.module.css";

interface ExplorerHeaderProps {
    title?: string;
}

interface NavLink {
    href: string;
    label: string;
    description: string;
    icon: string;
}

export const ExplorerHeader = ({ title = "Block Explorer" }: ExplorerHeaderProps) => {
    const location = useLocation();
    const currentPath = location.pathname;

    const navLinks: NavLink[] = [
        {
            href: "/explorer",
            label: "Latest Blocks",
            description: "Latest blocks on Pokerchain",
            icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        },
        {
            href: "/explorer/accounts",
            label: "All Accounts",
            description: "All accounts on Pokerchain",
            icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        },
        {
            href: "/explorer/address",
            label: "Address Lookup",
            description: "Address lookup on Pokerchain",
            icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        },
        {
            href: "/hands",
            label: "My Hands",
            description: "Every hand your wallet played, with replays",
            icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        },
        {
            href: "/players",
            label: "Players",
            description: "Search players and view stats, VIP tier and history",
            icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        }
    ];

    const isActive = (href: string) => {
        if (href === "/explorer") {
            return currentPath === "/explorer";
        }
        return currentPath.startsWith(href);
    };

    return (
        <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 sm:mb-6 text-center">{title}</h1>
            
            {/* Card navigation: a 2x2 grid on phones (a centred overflowing row clips its
                first card off-screen, unreachable by scrolling); a centred row from sm up. */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-4 sm:justify-center">
                {navLinks.map(link => (
                    <a
                        key={link.href}
                        href={link.href}
                        className={`p-3 sm:p-4 rounded-lg border transition-colors duration-200 flex items-center sm:items-start gap-2 sm:gap-3 min-w-0 ${styles.navCard} ${
                            isActive(link.href) ? styles.navCardActive : styles.navCardInactive
                        }`}
                    >
                        <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${styles.iconWrapper}`}>
                            <svg
                                className={`w-5 h-5 ${styles.iconColor}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={link.icon} />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs sm:text-sm font-bold text-white sm:mb-1 truncate">
                                {link.label}
                            </h3>
                            <p className="hidden sm:block text-gray-400 text-xs leading-tight">
                                {link.description}
                            </p>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default ExplorerHeader;
