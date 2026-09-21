/**
 * MobileTableHeader Component
 *
 * Portrait-phone replacement for TableHeader: a single 44px row (table name,
 * USDC balance, hamburger) plus a text-only status strip (blinds, hand number,
 * next to act). Everything else — network selector, share/copy/QR, wallet
 * address, avatar, settings, action log, top-up, table style, leave table —
 * lives in the hamburger drawer, each row a ≥44px tap target. Leave Table sits
 * at the bottom of the drawer styled as destructive, never as a bare tap
 * target next to the play surface.
 */

import React, { useState } from "react";
import { FaBars, FaCopy, FaQrcode, FaShare, FaTimes } from "react-icons/fa";
import { IoSettingsOutline } from "react-icons/io5";
import { LuPanelLeftOpen, LuPanelLeftClose } from "react-icons/lu";
import { RxExit } from "react-icons/rx";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "../../../common/Modal";
import { NetworkSelector } from "../../../NetworkSelector";
import { ProfileAvatarButton } from "../../../profile";
import { TopUpModal } from "../../../modals";
import { formatGameFormatDisplay, isSitAndGoFormat } from "../../../../utils/gameFormatUtils";
import { GameFormat, GameOptionsDTO, LegalActionDTO, NonPlayerActionType, PlayerDTO } from "@block52/poker-vm-sdk";
import { useBlindLevel } from "../../../../hooks/game/useBlindLevel";
import { useTableTopUp } from "../../../../hooks/game/useTableTopUp";
import type { NetworkEndpoints } from "../../../../context/NetworkContext";
import { formatBlindCountdown } from "./TableHeader";
import styles from "./TableHeader.module.css";

export type TableStyleOption = "modern" | "classic" | "nouns";

export interface MobileTableHeaderProps {
    tableId: string;
    tableName?: string;
    currentNetwork: NetworkEndpoints;

    // Game data
    gameFormat: GameFormat | null;
    gameOptions: GameOptionsDTO | null;
    tableActivePlayers: PlayerDTO[];

    // Wallet data
    publicKey: string | null;
    formattedAddress: string;
    isBalanceLoading: boolean;
    balanceFormatted: string;

    // Status strip data
    formattedValues: {
        smallBlindFormatted: string;
        bigBlindFormatted: string;
        isTournamentStyle: boolean;
    };
    handNumber: number;
    nextToAct: number;

    // Current user state
    currentPlayerData: PlayerDTO | null;
    isCurrentUserSeated: boolean;
    legalActions: LegalActionDTO[];
    currentStack: string;
    minBuyIn: string;
    maxBuyIn: string;
    walletBalance: string;

    // Sidebar state
    openSidebar: boolean;
    openSettings: boolean;

    // Table style (the fixed bottom-left selector is hidden on mobile)
    tableStyle: TableStyleOption;
    onCycleTableStyle: () => void;

    // Handlers
    handleLobbyClick: () => void;
    handleCopyTableLink: () => void;
    fetchAccountBalance: () => void;
    copyToClipboard: (text: string) => void;
    onCloseSideBar: () => void;
    onToggleSettings: () => void;
    handleLeaveTableClick: () => void;
    handleShareHand: () => void;
}

const TABLE_STYLE_LABELS: Record<TableStyleOption, string> = {
    modern: "Modern",
    classic: "Classic",
    nouns: "Nouns"
};

/** Shared row styling: every drawer item is a ≥44px tap target. */
const menuRowClass =
    "w-full min-h-[44px] flex items-center gap-3 px-4 text-sm text-left text-white transition-colors duration-150 hover:bg-white/10";

export const MobileTableHeader: React.FC<MobileTableHeaderProps> = ({
    tableId,
    tableName,
    currentNetwork,
    gameFormat,
    gameOptions,
    tableActivePlayers,
    publicKey,
    formattedAddress,
    isBalanceLoading,
    balanceFormatted,
    formattedValues,
    handNumber,
    nextToAct,
    currentPlayerData,
    isCurrentUserSeated,
    legalActions,
    currentStack,
    minBuyIn,
    maxBuyIn,
    walletBalance,
    openSidebar,
    openSettings,
    tableStyle,
    onCycleTableStyle,
    handleLobbyClick,
    handleCopyTableLink,
    fetchAccountBalance,
    copyToClipboard,
    onCloseSideBar,
    onToggleSettings,
    handleLeaveTableClick,
    handleShareHand
}) => {
    const blindLevel = useBlindLevel();
    const [menuOpen, setMenuOpen] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [showTopUp, setShowTopUp] = useState(false);
    const tableUrl = `${window.location.origin}/table/${tableId}`;

    const isSNG = gameFormat !== null && isSitAndGoFormat(gameFormat);
    const canTopUp = legalActions.some(a => a.action === NonPlayerActionType.TOP_UP);
    const showTopUpEntry = isCurrentUserSeated && !isSNG;
    const { topUp } = useTableTopUp(tableId, currentNetwork);

    // Same gating as TableHeader: no Leave for SNG (roster frozen once play
    // starts, poker-vm#2343; SNG leave/claim lives in the SNG modals, ui#465).
    const showLeaveTable = !!currentPlayerData && !isSNG;

    const closeMenuAnd = (action: () => void) => () => {
        setMenuOpen(false);
        action();
    };

    return (
        <div className="flex-shrink-0">
            {/* Single 44px row: table name · balance · hamburger.
                viewport-fit=cover extends the page under the Dynamic Island and,
                in landscape, under the notch on one side — the safe-area paddings
                keep the row's content clear of both. */}
            <div
                className={`w-full min-h-[44px] flex items-center justify-between pl-3 relative z-[100] border-b-2 ${styles.headerRoot}`}
                style={{
                    paddingTop: "env(safe-area-inset-top)",
                    paddingLeft: "calc(env(safe-area-inset-left) + 12px)",
                    paddingRight: "env(safe-area-inset-right)"
                }}
            >
                <button
                    className="text-white text-sm font-bold cursor-pointer truncate min-w-0 flex-1 min-h-[44px] text-left"
                    onClick={handleLobbyClick}
                >
                    {tableName ? tableName : `Table ${tableId ? tableId.slice(-5) : ""}`}
                </button>
                <div className="flex items-center flex-shrink-0">
                    {/* Balance — money on the table, wanted at a glance; tap to refresh */}
                    <button
                        onClick={fetchAccountBalance}
                        disabled={isBalanceLoading}
                        className="min-h-[44px] flex items-center px-2 disabled:opacity-50"
                        title="Refresh balance"
                    >
                        {isBalanceLoading ? (
                            <span className="text-xs text-gray-300">Loading...</span>
                        ) : (
                            <span className="text-white font-medium text-xs whitespace-nowrap">
                                ${balanceFormatted}
                                <span className="text-[9px] ml-1 text-gray-400">USDC</span>
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setMenuOpen(true)}
                        className="w-11 h-11 flex items-center justify-center text-white hover:opacity-80"
                        title="Menu"
                        aria-label="Open menu"
                    >
                        <FaBars size={18} />
                    </button>
                </div>
            </div>

            {/* Status strip — text only, no controls. No action count on mobile. */}
            <div
                className={`w-full flex items-center justify-center gap-3 px-2 h-[22px] sub-header z-[1] ${styles.subHeaderRoot}`}
                style={{ paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}
            >
                <span className={`text-[11px] font-semibold whitespace-nowrap ${styles.secondaryText}`}>
                    {blindLevel.isActive ? (
                        <>
                            {blindLevel.level !== undefined && `L${blindLevel.level + 1} `}
                            {blindLevel.currentBlindsFormatted}
                            {blindLevel.hasTimer && (
                                <>
                                    {" ("}
                                    <span className={blindLevel.secondsRemaining < 0 ? "text-red-500" : "text-yellow-300"}>
                                        {formatBlindCountdown(blindLevel.secondsRemaining)}
                                    </span>
                                    {")"}
                                </>
                            )}
                        </>
                    ) : (
                        `$${formattedValues.smallBlindFormatted} / $${formattedValues.bigBlindFormatted}`
                    )}
                </span>
                <span className={`text-[11px] font-semibold whitespace-nowrap ${styles.secondaryText}`}>Hand #{handNumber}</span>
                <span className={`text-[11px] font-semibold whitespace-nowrap ${styles.secondaryText}`}>Next: Seat {nextToAct}</span>
            </div>

            {/* Hamburger drawer */}
            {menuOpen && (
                <>
                    <div className="fixed inset-0 z-[1999] bg-black/60" onClick={() => setMenuOpen(false)} />
                    <div
                        className={`fixed top-0 right-0 bottom-0 z-[2000] w-[290px] max-w-[85vw] flex flex-col overflow-y-auto border-l-2 ${styles.headerRoot}`}
                        style={{
                            // Leave Table (the drawer's last row) must clear the home
                            // indicator; the top row must clear the Dynamic Island.
                            paddingTop: "env(safe-area-inset-top)",
                            paddingBottom: "env(safe-area-inset-bottom)",
                            paddingRight: "env(safe-area-inset-right)"
                        }}
                    >
                        <div className="flex items-center justify-between pl-4 min-h-[44px] border-b border-white/10">
                            <span className="text-white text-sm font-bold">Table menu</span>
                            <button
                                onClick={() => setMenuOpen(false)}
                                className="w-11 h-11 flex items-center justify-center text-white hover:opacity-80"
                                aria-label="Close menu"
                            >
                                <FaTimes size={16} />
                            </button>
                        </div>

                        {/* Game info (read-only) */}
                        {gameOptions && (
                            <div className="px-4 py-2 border-b border-white/10">
                                <span className={`text-xs font-semibold ${styles.brandText}`}>
                                    {gameFormat ? `${formatGameFormatDisplay(gameFormat)} • ` : ""}
                                    Texas Hold'em
                                    <span className={`ml-1 ${styles.secondaryText}`}>
                                        ({tableActivePlayers.length}/{gameOptions.maxPlayers} Players)
                                    </span>
                                </span>
                            </div>
                        )}

                        {/* Network */}
                        <div className="px-4 py-2 flex items-center gap-3 border-b border-white/10">
                            <span className="text-xs text-gray-400">Network</span>
                            <NetworkSelector />
                        </div>

                        {/* Wallet address (tap to copy) + avatar */}
                        <button className={menuRowClass} onClick={() => copyToClipboard(publicKey || "")} title="Copy full address">
                            <FaCopy size={14} className={styles.brandText} />
                            <span className={`font-mono text-xs truncate ${styles.brandText}`}>{formattedAddress}</span>
                        </button>
                        <div className={`${menuRowClass} cursor-default`}>
                            <ProfileAvatarButton title="Open avatar picker" className="min-w-[44px] min-h-[44px] flex items-center justify-center" />
                            <span>Avatar / NFT badge</span>
                        </div>

                        {/* Sharing */}
                        <button className={menuRowClass} onClick={closeMenuAnd(handleCopyTableLink)}>
                            <FaCopy size={14} />
                            <span>Copy Table Link</span>
                        </button>
                        <button className={menuRowClass} onClick={closeMenuAnd(() => setShowQR(true))}>
                            <FaQrcode size={14} />
                            <span>Share via QR Code</span>
                        </button>
                        <button className={menuRowClass} onClick={closeMenuAnd(handleShareHand)}>
                            <FaShare size={14} />
                            <span>Share this hand</span>
                        </button>
                        <a
                            href={`https://x.com/intent/tweet?text=${encodeURIComponent("Check out this poker hand on Block52!")}&url=${encodeURIComponent(`${window.location.origin}/explorer/hand/${tableId}/${handNumber}`)}&hashtags=${encodeURIComponent("Block52,Poker,OnChainPoker")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={menuRowClass}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            <span>Share on X</span>
                        </a>

                        {/* Panels */}
                        <button className={menuRowClass} onClick={closeMenuAnd(onCloseSideBar)}>
                            {openSidebar ? <LuPanelLeftOpen size={16} /> : <LuPanelLeftClose size={16} />}
                            <span>Action log</span>
                        </button>
                        <button className={menuRowClass} onClick={closeMenuAnd(onToggleSettings)}>
                            <IoSettingsOutline size={16} />
                            <span>Settings</span>
                        </button>

                        {/* Top-up — disabled while in the current hand, same rule as the
                            desktop button (#597): enablement comes from the TOP_UP legal action. */}
                        {showTopUpEntry && (
                            <button
                                className={`${menuRowClass} ${canTopUp ? "" : "opacity-50 cursor-not-allowed"}`}
                                onClick={canTopUp ? closeMenuAnd(() => setShowTopUp(true)) : undefined}
                                title={canTopUp ? "Add chips for the next hand" : "You can top up between hands — not while you're in the current hand."}
                            >
                                <span>💰</span>
                                <span>Top-Up Chips</span>
                            </button>
                        )}

                        {/* Table style — replaces the fixed bottom-left selector on mobile */}
                        <button className={menuRowClass} onClick={onCycleTableStyle}>
                            <span className="text-xs text-gray-400">Style</span>
                            <span>{TABLE_STYLE_LABELS[tableStyle]}</span>
                        </button>

                        <div className="flex-1" />

                        {/* Destructive action, isolated at the bottom of the menu */}
                        {showLeaveTable && (
                            <button
                                className={`${menuRowClass} border-t border-white/10 text-red-400 hover:bg-red-500/10 ${styles.leaveTableButton}`}
                                onClick={closeMenuAnd(handleLeaveTableClick)}
                            >
                                <RxExit size={16} />
                                <span className="font-semibold">Leave Table</span>
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* QR Code Modal */}
            <Modal
                isOpen={showQR}
                onClose={() => setShowQR(false)}
                title="Scan to Join Table"
                titleIcon={<FaQrcode size={16} />}
                widthClass="w-80"
                patternId="hexagons-qr-mobile"
                scrollable={false}
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-xl">
                        <QRCodeSVG value={tableUrl} size={240} />
                    </div>
                    <button
                        onClick={() => setShowQR(false)}
                        className="w-full py-2 rounded-lg bg-gray-700 text-white text-sm font-semibold hover:bg-gray-600 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </Modal>

            {/* Top-Up Modal — rendered outside the drawer so it survives the drawer closing */}
            {showTopUp && (
                <TopUpModal
                    tableId={tableId}
                    currentStack={currentStack}
                    minBuyIn={minBuyIn}
                    maxBuyIn={maxBuyIn}
                    walletBalance={walletBalance}
                    onClose={() => setShowTopUp(false)}
                    onTopUp={async (amount: string) => {
                        await topUp(amount);
                        setShowTopUp(false);
                    }}
                />
            )}
        </div>
    );
};
