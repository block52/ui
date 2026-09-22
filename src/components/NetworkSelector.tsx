import React, { useState, useRef, useEffect } from "react";
import { useNetwork } from "../context/NetworkContext";
import { hasElements } from "../utils/guards";
import styles from "./NetworkSelector.module.css";

export const NetworkSelector: React.FC = () => {
    const { currentNetwork, setNetwork, availableNetworks, discoveredNetworks } = useNetwork();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative z-[10000]" ref={dropdownRef}>
            {/* Dropdown Button */}
            {/* min-h-[44px]: minimum touch-target size (the header rows that host
                this are ≥44px tall, so the extra height changes nothing visually) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg transition-all duration-200 ${styles.dropdownButton}`}
            >
                {/* Network Icon */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                    />
                </svg>

                {/* Network Name */}
                <span className="font-semibold text-sm whitespace-nowrap">{currentNetwork.name}</span>

                {/* Dropdown Arrow */}
                <svg
                    className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    className={`absolute top-full mt-2 right-0 min-w-[280px] rounded-lg shadow-2xl overflow-hidden z-[10001] ${styles.dropdownMenu}`}
                >
                    {/* Preset Networks */}
                    {availableNetworks.map((network, index) => {
                        const isSelected = network.name === currentNetwork.name;
                        return (
                            <button
                                key={`preset-${index}`}
                                onClick={() => {
                                    setNetwork(network);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 transition-all duration-200 ${styles.networkItem} ${styles.networkItemBorder} ${isSelected ? styles.networkItemSelected : styles.networkItemUnselected}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span
                                        className={`font-semibold text-sm ${isSelected ? styles.networkNameSelected : styles.networkNameDefault}`}
                                    >
                                        {network.name}
                                    </span>
                                    {isSelected && (
                                        <svg className={`w-4 h-4 ${styles.checkIcon}`} fill="currentColor" viewBox="0 0 20 20">
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    )}
                                </div>
                                <div className={`text-xs ${styles.networkEndpointText}`}>
                                    <div className="font-mono">{network.rest}</div>
                                </div>
                            </button>
                        );
                    })}

                    {/* Discovered Networks Section */}
                    {hasElements(discoveredNetworks) && (
                        <>
                            {/* Section Header */}
                            <div
                                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider ${styles.discoveredHeader}`}
                            >
                                Discovered
                            </div>
                            {discoveredNetworks.map((network, index) => {
                                const isSelected = network.name === currentNetwork.name;
                                return (
                                    <button
                                        key={`discovered-${index}`}
                                        onClick={() => {
                                            setNetwork(network);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-3 transition-all duration-200 ${styles.networkItem} ${isSelected ? styles.networkItemSelected : styles.networkItemUnselected} ${index < discoveredNetworks.length - 1 ? styles.networkItemBorder : ""}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span
                                                className={`font-semibold text-sm ${isSelected ? styles.networkNameSelected : styles.networkNameDefault}`}
                                            >
                                                {network.name}
                                            </span>
                                            {isSelected && (
                                                <svg className={`w-4 h-4 ${styles.checkIcon}`} fill="currentColor" viewBox="0 0 20 20">
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            )}
                                        </div>
                                        <div className={`text-xs ${styles.networkEndpointText}`}>
                                            <div className="font-mono">{network.rest}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
