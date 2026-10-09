/**
 * TableHeader Component
 *
 * Displays the table header with two sections:
 * 1. Main Header - Table info, network selector, wallet balance, deposit button
 * 2. Sub Header - Blinds, hand info, action count, sidebar toggle, leave table button
 *
 * Hidden in mobile landscape mode.
 */

import React, { useState } from "react";
import { FaCopy, FaShare, FaQrcode } from "react-icons/fa";
import { IoSettingsOutline } from "react-icons/io5";
import { LuPanelLeftOpen, LuPanelLeftClose } from "react-icons/lu";
import { RxExit } from "react-icons/rx";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "../../../common/Modal";
import { NetworkSelector } from "../../../NetworkSelector";
import { ProfileAvatarButton } from "../../../profile";
import { formatGameFormatDisplay, isSitAndGoFormat } from "../../../../utils/gameFormatUtils";
import { buildHandShareUrl, buildShareOnXUrl } from "../../../../utils/handReplay";
import { GameFormat, GameOptionsDTO, PlayerDTO } from "@block52/poker-vm-sdk";
import { tableDisplayName } from "../../../../utils/lobbyTables";
import { useBlindLevel } from "../../../../hooks/game/useBlindLevel";
import styles from "./TableHeader.module.css";
import { pillClass } from "../../../ui";

export const formatBlindCountdown = (secondsRemaining: number): string => {
    // Negative = overtime (hand still running past the level end); show the
    // elapsed-over time with a leading minus, e.g. -0:10. (poker-vm#2292)
    const isOvertime = secondsRemaining < 0;
    const abs = Math.abs(secondsRemaining);
    const minutes = Math.floor(abs / 60);
    const seconds = abs % 60;
    return `${isOvertime ? "-" : ""}${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export interface TableHeaderProps {
    // Table info
    tableId: string;
    /** Optional paid table name; falls back to the truncated tableId when absent. */
    tableName?: string;
    isMobileLandscape: boolean;

    // Game data
    gameFormat: GameFormat | null;
    gameOptions: GameOptionsDTO | null;
    tableActivePlayers: PlayerDTO[];

    // Wallet data
    publicKey: string | null;
    formattedAddress: string;
    isBalanceLoading: boolean;
    balanceFormatted: string;

    // Sub-header data
    formattedValues: {
        smallBlindFormatted: string;
        bigBlindFormatted: string;
        isTournamentStyle: boolean;
    };
    handNumber: number;
    actionCount: number;
    nextToAct: number;

    // Current user state
    currentPlayerData: PlayerDTO | null;

    // Sidebar state
    openSidebar: boolean;

    // Settings sidebar state
    openSettings: boolean;

    // Handlers
    handleLobbyClick: () => void;
    handleCopyTableLink: () => void;
    handleDepositClick: () => void;
    fetchAccountBalance: () => void;
    copyToClipboard: (text: string) => void;
    onCloseSideBar: () => void;
    onToggleSettings: () => void;
    handleLeaveTableClick: () => void;
    handleShareHand: () => void;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
    tableId,
    tableName,
    isMobileLandscape,
    gameFormat,
    gameOptions,
    tableActivePlayers,
    publicKey,
    formattedAddress,
    isBalanceLoading,
    balanceFormatted,
    formattedValues,
    handNumber,
    actionCount,
    nextToAct,
    currentPlayerData,
    openSidebar,
    openSettings,
    handleLobbyClick,
    handleCopyTableLink,
    handleDepositClick,
    fetchAccountBalance,
    copyToClipboard,
    onCloseSideBar,
    onToggleSettings,
    handleLeaveTableClick,
    handleShareHand,
}) => {
    // Owned here rather than passed down from Table. The hook ticks once a
    // second to drive the blind countdown, and TableHeader is its only consumer
    // — calling it in Table meant that tick re-rendered the entire play-page
    // tree (9 seats, the board, the action panel) once a second on every
    // SNG/tournament table. Now it re-renders the header only.
    const blindLevel = useBlindLevel();

    const [showQR, setShowQR] = useState(false);
    const tableUrl = `${window.location.origin}/table/${tableId}`;

    // Hidden in mobile landscape
    if (isMobileLandscape) {
        return null;
    }

    return (
        <div className="flex-shrink-0">
            {/*//! MAIN HEADER - CASINO STYLE */}
            <div
                className={`w-full h-[50px] sm:h-[65px] text-center flex items-center justify-between px-2 sm:px-4 z-[100] relative border-b-2 ${styles.headerRoot}`}
            >
                {/* Subtle animated background */}
                <div className="absolute inset-0 z-0">
                    {/* Bottom edge glow */}
                    <div
                        className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent to-transparent opacity-50 ${styles.bottomGlow}`}
                    ></div>
                </div>

                {/* Left Section - Table button and Network selector */}
                <div className="flex items-center space-x-2 sm:space-x-3 z-[9999] relative min-w-0 whitespace-nowrap">
                    <span
                        className="text-white text-sm sm:text-[24px] cursor-pointer transition-colors duration-300 font-bold flex-shrink-0"
                        onClick={handleLobbyClick}
                    >
                        {tableDisplayName(tableId, tableName)}
                    </span>
                    <NetworkSelector />
                    {/* Copy Table Link Button */}
                    <button
                        onClick={handleCopyTableLink}
                        className={`flex-shrink-0 flex items-center justify-center gap-1.5 min-w-[40px] h-10 px-2.5 lg:px-3 rounded-btn text-sm font-semibold transition-colors duration-200 border ${styles.copyTableButton}`}
                        title="Copy table link to clipboard"
                        aria-label="Copy table link"
                    >
                        <FaCopy size={12} />
                        <span className="hidden lg:inline">Copy Table Link</span>
                    </button>
                    {/* QR Code Button */}
                    <button
                        onClick={() => setShowQR(true)}
                        className={`flex-shrink-0 flex items-center justify-center gap-1.5 min-w-[40px] h-10 px-2.5 xl:px-3 rounded-btn text-sm font-semibold transition-colors duration-200 border ${styles.copyTableButton}`}
                        title="Show QR code for table link"
                        aria-label="Share via QR code"
                    >
                        <FaQrcode size={12} />
                        <span className="hidden xl:inline">Share via QR Code</span>
                    </button>
                    {/* Compact player count for the middle widths where the full pill below does not fit */}
                    {gameOptions && gameOptions.minPlayers > 0 && gameOptions.maxPlayers > 0 && (
                        <div className={`hidden md:flex xl:hidden flex-shrink-0 items-center px-3 h-8 rounded-full text-sm font-semibold tabular-nums ${styles.gameFormatContainer} ${styles.secondaryText}`}>
                            {tableActivePlayers.length}/{gameOptions.maxPlayers}
                        </div>
                    )}
                    {/* Game Format & Variant Display - Desktop Only */}
                    {gameOptions && (
                        <div className={`hidden xl:flex flex-shrink-0 items-center ml-2 px-3 py-1 rounded-full ${styles.gameFormatContainer}`}>
                            <span className={`text-sm font-semibold ${styles.brandText}`}>
                                {gameFormat ? `${formatGameFormatDisplay(gameFormat)} • ` : ""}
                                Texas Hold'em
                                {gameOptions.minPlayers > 0 && gameOptions.maxPlayers > 0 && (
                                    <span className={`ml-1 ${styles.secondaryText}`}>
                                        ({tableActivePlayers.length}/{gameOptions.maxPlayers} Players)
                                    </span>
                                )}
                            </span>
                        </div>
                    )}
                </div>

                {/* Right Section - Wallet info */}
                <div className="flex items-center z-10 min-w-0 whitespace-nowrap flex-shrink-0">
                    <div className={`flex items-center rounded-full py-1 px-2 sm:px-3 mr-1 sm:mr-3 min-w-0 ${styles.walletInfo}`}>
                        {isBalanceLoading ? (
                            <span className="text-xs sm:text-sm">Loading...</span>
                        ) : (
                            <>
                                {/* Address */}
                                <div className="flex items-center mr-1 sm:mr-4 min-w-0">
                                    <span
                                        className={`font-mono text-[10px] sm:text-xs truncate max-w-[60px] sm:max-w-none ${styles.brandText}`}
                                    >
                                        {formattedAddress}
                                    </span>
                                    <FaCopy
                                        className={`ml-1 sm:ml-1.5 cursor-pointer transition-colors duration-200 hover:opacity-80 ${styles.brandText}`}
                                        size={9}
                                        onClick={() => copyToClipboard(publicKey || "")}
                                        title="Copy full address"
                                    />
                                </div>

                                {/* Balance */}
                                <div className="flex items-center flex-shrink-0">
                                    <div
                                        className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full flex items-center justify-center mr-0.5 sm:mr-1.5 ${styles.balanceIcon}`}
                                    >
                                        <span className={`font-bold text-[8px] sm:text-[10px] ${styles.brandText}`}>
                                            $
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-white font-medium text-[10px] sm:text-xs">
                                            ${balanceFormatted}
                                            <span className="text-[8px] sm:text-[10px] ml-1 text-ink-muted">USDC</span>
                                        </p>
                                    </div>
                                    {/* Refresh button */}
                                    <button
                                        onClick={fetchAccountBalance}
                                        disabled={isBalanceLoading}
                                        className={`ml-1 transition-colors duration-200 disabled:opacity-50 hover:opacity-80 ${styles.brandText}`}
                                        title="Refresh balance"
                                    >
                                        <span className="text-[8px]">↻</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="ml-2 flex-shrink-0">
                        <ProfileAvatarButton title="Open avatar picker" />
                    </div>
                </div>
            </div>

            {/* SUB HEADER */}
            <div
                className={`text-white flex justify-between items-center p-1 sm:p-2 h-[28px] sm:h-[35px] relative overflow-hidden shadow-lg sub-header z-[1] ${styles.subHeaderRoot}`}
            >
                {/* Animated background overlay */}
                <div className="sub-header-overlay shimmer-animation" />

                {/* Bottom edge shadow */}
                <div className="sub-header-shadow" />

                {/* Left Section */}
                <div className="flex items-center z-20">
                    <div className="flex flex-col">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                            {blindLevel.isActive ? (
                                <span className={`text-[10px] sm:text-[15px] font-semibold ${styles.secondaryText}`}>
                                    {blindLevel.level !== undefined && `Level ${blindLevel.level + 1} `}{blindLevel.currentBlindsFormatted} Next {blindLevel.nextBlindsFormatted}
                                    {blindLevel.hasTimer && (
                                        <>
                                            {" ("}
                                            <span className={blindLevel.secondsRemaining < 0 ? "text-red-500" : "text-yellow-300"}>
                                                {formatBlindCountdown(blindLevel.secondsRemaining)}
                                            </span>
                                            {")"}
                                        </>
                                    )}
                                </span>
                            ) : (
                                <span className={`text-[10px] sm:text-[15px] font-semibold ${styles.secondaryText}`}>
                                    {`$${formattedValues.smallBlindFormatted} / $${formattedValues.bigBlindFormatted}`}
                                </span>
                            )}

                            <span className={`text-[10px] sm:text-[15px] font-semibold ${styles.secondaryText}`}>
                                Hand #{handNumber}
                            </span>
                            <span className={`hidden sm:inline-block text-[15px] font-semibold ${styles.secondaryText}`}>
                                <span className="ml-2">Actions #{actionCount}</span>
                            </span>
                            <span className={`text-[10px] sm:text-[15px] font-semibold ${styles.secondaryText}`}>
                                <span className="sm:ml-2">Next to act: Seat {nextToAct}</span>
                            </span>
                            <button
                                onClick={handleShareHand}
                                className={`flex items-center gap-1 text-[10px] sm:text-[15px] font-semibold transition-colors duration-200 hover:opacity-80 ${styles.secondaryText}`}
                                title="Share this hand"
                            >
                                <FaShare size={10} />
                                <span className="hidden sm:inline">Share</span>
                            </button>
                            <a
                                href={buildShareOnXUrl(buildHandShareUrl(window.location.origin, tableId, handNumber))}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Share on X"
                                className={`transition-colors duration-200 hover:opacity-80 ${styles.secondaryText}`}
                            >
                                <svg className="w-3 h-3 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center z-10 mr-1 sm:mr-3">
                    {/* Settings gear icon */}
                    <button
                        type="button"
                        className={`grid place-items-center w-6 h-6 sm:w-7 sm:h-7 cursor-pointer transition-colors duration-200 rounded-btn mr-1 ${openSettings ? styles.sidebarToggleOpen : styles.sidebarToggleClosed}`}
                        onClick={onToggleSettings}
                        title="Toggle Settings"
                        aria-label="Toggle settings"
                        aria-pressed={openSettings}
                    >
                        <IoSettingsOutline size={15} />
                    </button>
                    <button
                        type="button"
                        className={`grid place-items-center w-6 h-6 sm:w-7 sm:h-7 cursor-pointer transition-colors duration-200 rounded-btn ${openSidebar ? styles.sidebarToggleOpen : styles.sidebarToggleClosed}`}
                        onClick={onCloseSideBar}
                        title="Toggle Action Log"
                        aria-label="Toggle action log"
                        aria-pressed={openSidebar}
                    >
                        {openSidebar ? <LuPanelLeftOpen size={15} /> : <LuPanelLeftClose size={15} />}
                    </button>
                    {/* Only show Leave Table button if user is seated — and never
                        for SNG, where the roster is frozen once play starts
                        (poker-vm#2343) and leave/claim is handled by the SNG
                        modals (block52/ui#465). */}
                    {currentPlayerData && !(gameFormat && isSitAndGoFormat(gameFormat)) && (
                        <button
                            type="button"
                            className={`h-6 sm:h-7 px-2.5 cursor-pointer flex items-center gap-1.5 rounded-btn border text-xs font-semibold transition-colors duration-200 ml-2 sm:ml-3 ${styles.leaveTableButton}`}
                            onClick={handleLeaveTableClick}
                            title="Leave Table"
                        >
                            <span className="hidden sm:inline">Leave table</span>
                            <span className="sm:hidden">Leave</span>
                            <RxExit size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* QR Code Modal */}
            <Modal
                isOpen={showQR}
                onClose={() => setShowQR(false)}
                title="Scan to Join Table"
                titleIcon={<FaQrcode size={16} />}
                widthClass="w-80"
                patternId="hexagons-qr"
                scrollable={false}
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-xl">
                        <QRCodeSVG value={tableUrl} size={240} />
                    </div>
                    <button
                        onClick={() => setShowQR(false)}
                        className={pillClass("outline", "sm", "w-full")}
                    >
                        Close
                    </button>
                </div>
            </Modal>
        </div>
    );
};
