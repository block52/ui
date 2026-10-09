import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { NetworkEndpoints, useNetwork } from "../context/NetworkContext";
import { hasElements } from "../utils/guards";
import { cssVars } from "../utils/cssVars";
import styles from "./NetworkSelector.module.css";

interface NetworkOptionProps {
    network: NetworkEndpoints;
    selected: boolean;
    onSelect: (network: NetworkEndpoints) => void;
}

const NetworkOption: React.FC<NetworkOptionProps> = ({ network, selected, onSelect }) => (
    <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => onSelect(network)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[56px] rounded-xl text-left transition-colors ${
            selected ? "bg-brand/10" : "hover:bg-surface-hover"
        }`}
    >
        <span
            aria-hidden="true"
            className={`flex-none w-[18px] h-[18px] rounded-full grid place-items-center border-2 ${
                selected ? "border-brand" : "border-line-strong"
            }`}
        >
            {selected && <span className="w-2 h-2 rounded-full bg-brand" />}
        </span>
        <span className="min-w-0 flex-1 flex flex-col gap-0.5">
            <span className={`text-sm font-medium truncate ${selected ? "text-ink" : "text-ink-body"}`}>{network.name}</span>
            <span className="font-mono text-xs text-ink-muted truncate">{network.rest}</span>
        </span>
    </button>
);

/** Menu width in px; keep in sync with the `w-[340px]` class below. */
const MENU_WIDTH = 340;
const VIEWPORT_MARGIN = 16;

type MenuPlacement = "right" | "left" | "sheet";

/**
 * Where to open the menu so it stays on screen: aligned to the button's right edge
 * (default, button near the right of the header), its left edge (button near the left,
 * e.g. the table page), or full-width under the header when neither side fits (phones).
 */
const choosePlacement = (buttonRect: DOMRect, viewportWidth: number): MenuPlacement => {
    if (buttonRect.right - MENU_WIDTH >= VIEWPORT_MARGIN) return "right";
    if (buttonRect.left + MENU_WIDTH <= viewportWidth - VIEWPORT_MARGIN) return "left";
    return "sheet";
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="px-3 pt-3 pb-1.5 text-xs uppercase tracking-[0.08em] text-ink-muted">{children}</div>
);

export const NetworkSelector: React.FC = () => {
    const { currentNetwork, setNetwork, availableNetworks, discoveredNetworks } = useNetwork();
    const [isOpen, setIsOpen] = useState(false);
    const [placement, setPlacement] = useState<MenuPlacement>("right");
    const [sheetTop, setSheetTop] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const close = useCallback(() => setIsOpen(false), []);

    // Close dropdown when clicking outside or pressing Escape
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                close();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, close]);

    const toggleOpen = useCallback(() => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPlacement(choosePlacement(rect, window.innerWidth));
            setSheetTop(rect.bottom + 8);
        }
        setIsOpen(open => !open);
    }, [isOpen]);

    const handleSelect = useCallback(
        (network: NetworkEndpoints) => {
            setNetwork(network);
            close();
        },
        [setNetwork, close]
    );

    return (
        <div className="relative z-[10000]" ref={dropdownRef}>
            {/* min-h-[44px]: minimum touch-target size (the header rows that host
                this are ≥44px tall, so the extra height changes nothing visually) */}
            <button
                type="button"
                ref={buttonRef}
                onClick={toggleOpen}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className={`flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full transition-colors duration-200 ${styles.dropdownButton}`}
            >
                <span className="font-medium text-sm whitespace-nowrap">{currentNetwork.name}</span>
                <svg
                    className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div
                    style={placement === "sheet" ? cssVars({ "--menu-top": `${sheetTop}px` }) : undefined}
                    className={`p-2 rounded-2xl bg-surface-card border border-line z-[10001] ${styles.dropdownMenu} ${
                        placement === "sheet"
                            ? "fixed left-4 right-4 top-[var(--menu-top)]"
                            : `absolute top-full mt-2 w-[340px] ${placement === "left" ? "left-0" : "right-0"}`
                    }`}
                >
                    <div role="listbox" aria-label="Network" className="max-h-[60vh] overflow-y-auto">
                        <SectionLabel>Network</SectionLabel>
                        {availableNetworks.map(network => (
                            <NetworkOption
                                key={`preset-${network.name}`}
                                network={network}
                                selected={network.name === currentNetwork.name}
                                onSelect={handleSelect}
                            />
                        ))}

                        {hasElements(discoveredNetworks) && (
                            <>
                                <div className="mx-3 mt-2 border-t border-line" />
                                <SectionLabel>Discovered</SectionLabel>
                                {discoveredNetworks.map(network => (
                                    <NetworkOption
                                        key={`discovered-${network.name}-${network.rest}`}
                                        network={network}
                                        selected={network.name === currentNetwork.name}
                                        onSelect={handleSelect}
                                    />
                                ))}
                            </>
                        )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-line">
                        <Link
                            to="/nodes"
                            onClick={close}
                            className="flex items-center justify-between min-h-[44px] px-3 rounded-xl text-sm text-ink-soft hover:bg-surface-hover hover:text-ink transition-colors"
                        >
                            View all nodes
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};
