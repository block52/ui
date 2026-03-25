/**
 * TableHeader Component
 *
 * Displays the table header with two sections:
 * 1. Main Header - Table info, network selector, wallet balance, deposit button
 * 2. Sub Header - Blinds, hand info, action count, sidebar toggle, leave table button
 *
 * Hidden in mobile landscape mode.
 */

import React from "react";
import { FaCopy, FaShare } from "react-icons/fa";
import { LuPanelLeftOpen, LuPanelLeftClose } from "react-icons/lu";
import { RxExit } from "react-icons/rx";
import { NetworkSelector } from "../../../NetworkSelector";
import { ProfileAvatarButton } from "../../../profile";
import { formatGameFormatDisplay } from "../../../../utils/gameFormatUtils";
import { GameFormat, GameOptionsDTO, PlayerDTO } from "@block52/poker-vm-sdk";
import styles from "./TableHeader.module.css";

export interface TableHeaderProps {
    // Table info
    tableId: string;
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

    // Handlers
    handleLobbyClick: () => void;
    handleCopyTableLink: () => void;
    handleDepositClick: () => void;
    fetchAccountBalance: () => void;
    copyToClipboard: (text: string) => void;
    onCloseSideBar: () => void;
    handleLeaveTableClick: () => void;
    handleShareHand: () => void;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
    tableId,
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
    handleLobbyClick,
    handleCopyTableLink,
    handleDepositClick,
    fetchAccountBalance,
    copyToClipboard,
    onCloseSideBar,
    handleLeaveTableClick,
    handleShareHand,
}) => {
    // Hidden in mobile landscape
    if (isMobileLandscape) {
        return null;
    }

    return (
        <div className="flex-shrink-0">
            {/*//! MAIN HEADER - CASINO STYLE */}
            <div
                className={`w-[100vw] h-[50px] sm:h-[65px] text-center flex items-center justify-between px-2 sm:px-4 z-[100] relative border-b-2 ${styles.headerRoot}`}
            >
                {/* Subtle animated background */}
                <div className="absolute inset-0 z-0">
                    {/* Bottom edge glow */}
                    <div
                        className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent to-transparent opacity-50 ${styles.bottomGlow}`}
                    ></div>
                </div>

                {/* Left Section - Table button and Network selector */}
                <div className="flex items-center space-x-2 sm:space-x-4 z-[9999] relative">
                    <span
                        className="text-white text-sm sm:text-[24px] cursor-pointer hover:text-[#ffffff] transition-colors duration-300 font-bold"
                        onClick={handleLobbyClick}
                    >
                        Table {tableId ? tableId.slice(-5) : ""}
                    </span>
                    <NetworkSelector />
                    {/* Copy Table Link Button */}
                    <button
                        onClick={handleCopyTableLink}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 hover:opacity-80 border ${styles.copyTableButton}`}
                        title="Copy table link to clipboard"
                    >
                        <FaCopy size={12} />
                        <span className="hidden sm:inline">Copy Table Link</span>
                        <span className="sm:hidden">Copy Link</span>
                    </button>
                    {/* Game Format & Variant Display - Desktop Only */}
                    {gameOptions && (
                        <div className={`hidden md:flex items-center ml-4 px-3 py-1 rounded-lg ${styles.gameFormatContainer}`}>
                            <span className={`text-sm font-semibold ${styles.brandText}`}>
                                {gameFormat ? `${formatGameFormatDisplay(gameFormat)} • ` : ""}
                                Texas Hold'em
                                {gameOptions.minPlayers && gameOptions.maxPlayers && (
                                    <span className={`ml-1 ${styles.secondaryText}`}>
                                        ({tableActivePlayers.length}/{gameOptions.maxPlayers} Players)
                                    </span>
                                )}
                            </span>
                        </div>
                    )}
                </div>

                {/* Right Section - Wallet info */}
                <div className="flex items-center z-10 min-w-0">
                    <div className={`flex items-center rounded-lg py-1 px-1 sm:px-2 mr-1 sm:mr-3 min-w-0 ${styles.walletInfo}`}>
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
                                            <span className="text-[8px] sm:text-[10px] ml-1 text-gray-400">USDC</span>
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
                            <span className={`text-[10px] sm:text-[15px] font-semibold ${styles.secondaryText}`}>
                                {formattedValues.isTournamentStyle
                                    ? `${formattedValues.smallBlindFormatted} / ${formattedValues.bigBlindFormatted}`
                                    : `$${formattedValues.smallBlindFormatted} / $${formattedValues.bigBlindFormatted}`}
                            </span>

                            <span className={`text-[10px] sm:text-[15px] font-semibold ${styles.secondaryText}`}>
                                Hand #{handNumber}
                            </span>
                            <span className={`hidden sm:inline-block text-[15px] font-semibold ${styles.secondaryText}`}>
                                <span className="ml-2">Actions # {actionCount}</span>
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
                                href={`https://x.com/intent/tweet?text=${encodeURIComponent("Check out this poker hand on Block52!")}&url=${encodeURIComponent(`${window.location.origin}/explorer/hand/${tableId}/${handNumber}`)}&hashtags=${encodeURIComponent("Block52,Poker,OnChainPoker")}`}
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
                    <span
                        className={`cursor-pointer transition-colors duration-200 px-1 sm:px-2 py-0.5 sm:py-1 rounded hover:opacity-80 ${openSidebar ? styles.sidebarToggleOpen : styles.sidebarToggleClosed}`}
                        onClick={onCloseSideBar}
                        title="Toggle Action Log"
                    >
                        {openSidebar ? <LuPanelLeftOpen size={14} /> : <LuPanelLeftClose size={14} />}
                    </span>

                    {/* Only show Leave Table button if user is seated */}
                    {currentPlayerData && (
                        <span
                            className={`text-xs sm:text-[16px] cursor-pointer flex items-center gap-0.5 transition-colors duration-300 ml-2 sm:ml-3 ${styles.leaveTableButton}`}
                            onClick={handleLeaveTableClick}
                            title="Leave Table"
                        >
                            <span className="hidden sm:inline">Leave Table</span>
                            <span className="sm:hidden">Leave</span>
                            <RxExit size={12} />
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
