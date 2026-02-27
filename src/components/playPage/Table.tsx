/**
 * Table Component
 *
 * This is the main poker table component that orchestrates the entire game interface.
 * It manages:
 * - Player positions and rotations
 * - Game state and progress
 * - Community cards
 * - Pot amounts
 * - Dealer button
 * - Player actions
 *
 * Key Features:
 * - Dynamic table layout (6 or 9 players)
 * - Real-time game state updates
 * - Player position management
 * - Chip position calculations
 * - Winner animations
 * - Sidebar for game log
 *
 * Player Components:
 * - Player: Current user's view with hole cards and controls
 * - OppositePlayer: Other players' views with seat changing functionality
 * - VacantPlayer: Empty seat views with direct join/seat changing
 *
 * PlayerPopUpCard Integration:
 * - Used by OppositePlayer for seat changing
 * - Used by VacantPlayer for seat changing (only when user is already seated)
 * - Provides consistent UI for player interactions
 *
 * State Management:
 * - Uses multiple hooks for different aspects of the game
 * - Manages player positions and rotations
 * - Handles game progress and round information
 * - Controls UI elements visibility
 *
 * Components Used:
 * - Player: Current user's view
 * - OppositePlayer: Other players' views
 * - VacantPlayer: Empty seat views
 * - PlayerPopUpCard: Popup for player actions
 * - PokerActionPanel: Betting controls
 * - ActionsLog: Game history
 */

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { isSitAndGoFormat, isTournamentFormat } from "../../utils/gameFormatUtils";
// Position arrays now come from useTableLayout hook
// // Position arrays now come from useTableLayout hook
// import { playerPosition, dealerPosition, vacantPlayerPosition } from "../../utils/PositionArray";
import PokerActionPanel from "../Footer";

// Extracted Table components
import { TableHeader, TableBoard, TableSidebar, TableModals, PlayerSeating, TableStatusMessages, PlayerActionButtons, LayoutDebugInfo } from "./Table/components";


import Chip from "./common/Chip";
import defaultLogo from "../../assets/YOUR_CLUB.png";
import { HexagonPattern } from "../common/Modal";

// Use environment variable for club logo with fallback to default
const clubLogo = import.meta.env.VITE_CLUB_LOGO || defaultLogo;

import { useParams } from "react-router-dom";
import React from "react";
import { formatUSDCToSimpleDollars } from "../../utils/numberUtils";
import { toast } from "react-toastify";
import { RxExit } from "react-icons/rx";

import { isValidPlayerAddress } from "../../utils/addressUtils";
import { CardBackStyle } from "../../utils/cardImages";

import "./Table.css"; // Import the Table CSS file

//// TODO get these hooks to subscribe to the wss connection

// 1. Core Data Providers
import { useTableData } from "../../hooks/game/useTableData"; // Used to create tableActivePlayers (filtered players), Contains seat numbers, addresses, and player statuses
import { usePlayerSeatInfo } from "../../hooks/player/usePlayerSeatInfo"; // Provides currentUserSeat - the current user's seat position and userDataBySeat - object for direct seat-to-player lookup
import { useNextToActInfo } from "../../hooks/game/useNextToActInfo";

//2. Visual Position/State Providers
import { useChipPositions } from "../../hooks/animations/useChipPositions";
import { usePlayerChipData } from "../../hooks/player/usePlayerChipData";

//3. Game State Providers
import { useTableState } from "../../hooks/game/useTableState"; //Provides currentRound, formattedTotalPot, tableSize, tableSize determines player layout (6 vs 9 players)
import { useGameProgress } from "../../hooks/game/useGameProgress"; //Provides isGameInProgress - whether a hand is active

//todo wire up to use the sdk instead of the proxy
// 4. Player Actions
import { leaveTable } from "../../hooks/playerActions/leaveTable";

// 5. Winner Info
import { useWinnerInfo } from "../../hooks/game/useWinnerInfo"; // Provides winner information for animations
import { useGameResults } from "../../hooks/game/useGameResults"; // Game results display

// other
import { usePlayerLegalActions } from "../../hooks/playerActions/usePlayerLegalActions";
import { useGameOptions } from "../../hooks/game/useGameOptions";
import { getCosmosBalance, getCosmosAddressSync, getFormattedCosmosAddress } from "../../utils/cosmosAccountUtils";
import { useGameStateContext } from "../../context/GameStateContext";
import { useNetwork } from "../../context/NetworkContext";
import { PlayerDTO, PlayerStatus } from "@block52/poker-vm-sdk";
import LiveHandStrengthDisplay from "./LiveHandStrengthDisplay";

// Table Error Page
import TableErrorPage from "./TableErrorPage";
import { useGameStartCountdown } from "../../hooks/game/useGameStartCountdown";

// Table Layout Configuration
import { useTableLayout } from "../../hooks/game/useTableLayout";
import { useVacantSeatData } from "../../hooks/game/useVacantSeatData";
import { getViewportMode } from "../../config/tableLayoutConfig";

// Turn Notification
import { useTurnNotification } from "../../hooks/notifications/useTurnNotification";

//* Here's the typical sequence of a poker hand:
//* ANTE - Initial forced bets
//* PREFLOP - Players get their hole cards, betting round
//* FLOP - First 3 community cards dealt, betting round
//* TURN - Fourth community card dealt, betting round
//* RIVER - Final community card dealt, final betting round
//* SHOWDOWN - Players show their cards to determine winner

//* Define the interface for the position object

interface NetworkDisplayProps {
    isMainnet?: boolean;
}

// Memoize the NetworkDisplay component
const NetworkDisplay = memo(({ isMainnet = false }: NetworkDisplayProps) => {
    return (
        <div className="network-display flex items-center gap-1 sm:gap-1.5 px-1 sm:px-2 py-1 rounded-lg text-[10px] sm:text-xs">
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isMainnet ? "bg-green-500" : "network-display-dot-devnet"}`}></div>
            <span className="text-gray-300 whitespace-nowrap">Block52 Chain</span>
        </div>
    );
});

NetworkDisplay.displayName = "NetworkDisplay";

// Helper to format chip counts for tournament display with commas
const formatChipCount = (chips: number): string => {
    return chips.toLocaleString("en-US");
};


const Table = React.memo(() => {
    const { id } = useParams<{ id: string }>();
    // Game state context and subscription
    const { subscribeToTable, unsubscribeFromTable, gameState, gameFormat, validationError, error } = useGameStateContext();
    const { currentNetwork } = useNetwork();

    useEffect(() => {
        if (id) {
            subscribeToTable(id);
        }
    }, [id, subscribeToTable]);

    // Card back style configuration - can be customized per club/table
    // Options: "default", "block52", "custom", or a custom URL
    const cardBackStyle: CardBackStyle = "default";

    // Game Start Countdown
    const { gameStartTime, showCountdown, handleCountdownComplete, handleSkipCountdown } = useGameStartCountdown();

    // Track viewport mode for debugging
    const [viewportMode, setViewportMode] = useState(getViewportMode());

    const [accountBalance, setAccountBalance] = useState<string>("0");
    const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(true);
    const [, setBalanceError] = useState<Error | null>(null);
    const publicKey = getCosmosAddressSync();

    // Update to use the imported hook
    const tableDataValues = useTableData();
    const { isUserAlreadyPlaying, emptySeatIndexes } = useVacantSeatData();

    // Determine if we're in a Sit & Go waiting for players state
    // This is true when: it's a sit-and-go, the user is seated, but not all seats are filled
    const isSitAndGoWaitingForPlayers = useMemo(() => {
        const isSitAndGo = isSitAndGoFormat(gameFormat);
        const hasEmptySeats = emptySeatIndexes.length > 0;
        const result = isSitAndGo && isUserAlreadyPlaying && hasEmptySeats;

        return result;
    }, [gameFormat, isUserAlreadyPlaying, emptySeatIndexes.length]);

    // invoke hook for seat loop
    const { winnerInfo } = useWinnerInfo();

    // Zoom is now handled by the table layout configuration
    // const calculateZoom = useCallback(() => { ... }, []);

    // Function to fetch Cosmos account balance
    const fetchAccountBalance = useCallback(async () => {
        try {
            setIsBalanceLoading(true);
            setBalanceError(null);

            const balance = await getCosmosBalance(currentNetwork, "usdc");
            setAccountBalance(balance);
        } catch (err) {
            console.error("Error fetching Cosmos balance:", err);
            setBalanceError(err instanceof Error ? err : new Error("Failed to fetch balance"));
        } finally {
            setIsBalanceLoading(false);
        }
    }, [currentNetwork]);

    // Fetch balance once on page load
    useEffect(() => {
        if (publicKey) {
            fetchAccountBalance();
        }
    }, [publicKey, fetchAccountBalance]);

    // Manual balance refresh function for after key actions
    const updateBalanceOnPlayerJoin = useCallback(() => {
        if (publicKey) {
            fetchAccountBalance();
        }
    }, [publicKey, fetchAccountBalance]);

    // Zoom is now managed by useTableLayout hook
    const [openSidebar, setOpenSidebar] = useState(false);

    // Leave table modal state
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

    // Transaction popup state
    const [recentTxHash, setRecentTxHash] = useState<string | null>(null);

    // Callback to show transaction popup
    const handleTransactionSubmitted = useCallback(
        (txHash: string | null) => {
            if (txHash) {
                setRecentTxHash(txHash);
                // Auto-refresh balance after transaction
                fetchAccountBalance();
            }
        },
        [fetchAccountBalance]
    );

    // Callback to close transaction popup
    const handleCloseTransactionPopup = useCallback(() => {
        setRecentTxHash(null);
    }, []);

    // Use the hook directly instead of getting it from context
    const { legalActions: playerLegalActions, playerStatus, sitInMethod, pendingSitOut } = usePlayerLegalActions();

    // Add the usePlayerSeatInfo hook
    const { currentUserSeat } = usePlayerSeatInfo();

    // Add the useNextToActInfo hook
    const {
        seat: nextToActSeat,
        player: _nextToActPlayer,
        isCurrentUserTurn,
        availableActions: _nextToActAvailableActions,
        timeRemaining: _timeRemaining
    } = useNextToActInfo(id);

    // Enable turn-to-act notifications (tab flashing + optional sound)
    useTurnNotification(isCurrentUserTurn, {
        enableSound: true,
        soundVolume: 0.3,
        flashInterval: 1000
    });

    // Add the useTableState hook to get table state properties
    const { tableSize } = useTableState();

    // Use the table layout configuration system (only 4 and 9 players supported)
    // TODO: Add support for 2, 3, 5, 6, 7, 8 player tables - positions need to be configured in tableLayoutConfig.ts
    const tableLayout = useTableLayout((tableSize as 4 | 9) || 9);

    // Add the useGameProgress hook
    const { isGameInProgress, handNumber, actionCount, nextToAct } = useGameProgress(id);

    // Add the useGameOptions hook
    const { gameOptions } = useGameOptions();

    // Add the useGameResults hook
    const { results } = useGameResults();

    // Memoize formatted values
    const formattedValues = useMemo(() => {
        if (!gameOptions) {
            return {
                smallBlindFormatted: "N/A",
                bigBlindFormatted: "N/A",
                isTournamentStyle: false
            };
        }

        // Check if this is a tournament-style game (tournament or sit-and-go)
        const isTournamentStyle = isTournamentFormat(gameFormat) || isSitAndGoFormat(gameFormat);

        if (isTournamentStyle) {
            // Tournament: blinds are chip counts, display with commas
            const smallBlind = Number(gameOptions.smallBlind);
            const bigBlind = Number(gameOptions.bigBlind);

            return {
                smallBlindFormatted: formatChipCount(smallBlind),
                bigBlindFormatted: formatChipCount(bigBlind),
                isTournamentStyle: true
            };
        } else {
            // Cash game: blinds are USDC microunits, convert to dollars
            return {
                smallBlindFormatted: formatUSDCToSimpleDollars(gameOptions.smallBlind),
                bigBlindFormatted: formatUSDCToSimpleDollars(gameOptions.bigBlind),
                isTournamentStyle: false
            };
        }
    }, [gameOptions, gameFormat]);

    // ============================================================
    // TABLE ROTATION SYSTEM - COMPREHENSIVE DOCUMENTATION
    // ============================================================
    //
    // OVERVIEW:
    // The rotation system allows the poker table view to rotate, changing which
    // seat appears at the bottom (traditional "hero" position in poker UIs).
    // This is controlled by a single variable: startIndex
    //
    // KEY CONCEPTS:
    // - UI Position: The visual position on screen (0 = bottom, 1 = left, 2 = top, etc.)
    // - Seat Number: The actual seat at the table (1, 2, 3, 4, etc.)
    // - startIndex: The offset that determines the rotation
    //
    // HOW IT WORKS:
    // The formula: seatNumber = ((uiPosition + startIndex) % tableSize) + 1
    //
    // Example with 4 players:
    // - startIndex = 0: No rotation
    //   UI Pos 0 shows Seat 1 (bottom)
    //   UI Pos 1 shows Seat 2 (left)
    //   UI Pos 2 shows Seat 3 (top)
    //   UI Pos 3 shows Seat 4 (right)
    //
    // - startIndex = 1: Rotate by 1 (Seat 2 at bottom)
    //   UI Pos 0 shows Seat 2 (bottom)
    //   UI Pos 1 shows Seat 3 (left)
    //   UI Pos 2 shows Seat 4 (top)
    //   UI Pos 3 shows Seat 1 (right)
    //
    // ROTATION CONTROLS:
    // - ← Rotate: Increases startIndex, rotates seats CLOCKWISE
    //   From default (0): goes to 1 → Seat 4 moves to bottom, Seat 1 moves to left
    // - Rotate →: Decreases startIndex, rotates seats COUNTER-CLOCKWISE
    //   From default (0): goes to 3 → Seat 2 moves to bottom, Seat 1 moves to right
    // - Reset (startIndex = 0): Returns to default view (Seat 1 at bottom)
    //
    // WHERE ROTATION IS APPLIED:
    // 1. In getComponentToRender() function (line ~570)
    //    - Calculates which seat should appear at each UI position
    //    - Formula: seatNumber = ((positionIndex + startIndex) % tableSize) + 1
    //
    // 2. In the render loop (line ~1000)
    //    - Uses tableLayout.positions.players (NOT pre-rotated)
    //    - Passes positionIndex to getComponentToRender
    //    - Rotation happens inside getComponentToRender
    //
    // IMPORTANT: Rotation happens ONLY ONCE in getComponentToRender()
    // We don't pre-rotate arrays to avoid double rotation

    const [seat] = useState<number>(0);
    const [startIndex, setStartIndex] = useState<number>(0); // Controls table rotation (0 = no rotation)

    const [currentIndex, setCurrentIndex] = useState<number>(1);

    // Add the useChipPositions hook AFTER startIndex is defined
    const { chipPositionArray: _chipPositionArray } = useChipPositions(startIndex);

    // Add the usePlayerChipData hook
    const { getChipAmount } = usePlayerChipData();

    // Memoize user wallet address using Cosmos utility function
    const userWalletAddress = useMemo(() => {
        const storedAddress = getCosmosAddressSync();
        return storedAddress ? storedAddress.toLowerCase() : null;
    }, []);

    // Use Cosmos utility function for formatted address
    const formattedAddress = getFormattedCosmosAddress();

    // Memoize table active players
    const tableActivePlayers = useMemo(() => {
        const activePlayers = tableDataValues.tableDataPlayers?.filter((player: PlayerDTO) => isValidPlayerAddress(player.address)) ?? [];

        return activePlayers;
    }, [tableDataValues.tableDataPlayers]);

    // Check if any player is ACTIVE or ALL_IN (mirrors PVM's checkBootstrap logic)
    const hasActivePlayers = useMemo(() => {
        return tableActivePlayers.some((p: PlayerDTO) =>
            p.status === PlayerStatus.ACTIVE || p.status === PlayerStatus.ALL_IN
        );
    }, [tableActivePlayers]);

    // Optimize window width detection - only check on resize
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 414);
    const [isMobileLandscape, setIsMobileLandscape] = useState(
        window.innerWidth <= 1024 && window.innerWidth > window.innerHeight && window.innerHeight <= 600
    );

    // Update viewport mode on window resize
    useEffect(() => {
        const handleResize = () => {
            setViewportMode(getViewportMode());
            setIsMobile(window.innerWidth <= 414);
            setIsMobileLandscape(window.innerWidth <= 1024 && window.innerWidth > window.innerHeight && window.innerHeight <= 600);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // 🔧 PERFORMANCE FIX: Disabled mouse tracking to prevent hundreds of re-renders
    // Mouse tracking was causing setMousePosition({ x, y }) on every mouse move
    // which created new objects and triggered excessive re-renders
    // useEffect(() => {
    //     // Mouse tracking disabled for performance
    // }, []);

    // Legacy seat effect (can be removed if not used)
    useEffect(() => (seat ? setStartIndex(seat) : setStartIndex(0)), [seat]);

    // AUTO-ROTATION: Automatically rotate table when user joins
    // This ensures the current user always appears at the bottom position
    // DISABLED FOR NOW - uncomment to enable auto-rotation
    // useEffect(() => {
    //     if (currentUserSeat > 0) {
    //         // Calculate rotation needed to put current user at bottom
    //         // Position 0 is bottom, so we need to rotate by (userSeat - 1)
    //         const rotationNeeded = currentUserSeat - 1;
    //
    //         console.log(`🎯 AUTO-ROTATION: User is at seat ${currentUserSeat}, rotating by ${rotationNeeded} to put them at bottom`);
    //         setStartIndex(rotationNeeded);
    //     }
    // }, [currentUserSeat]);


    // Winner animations
    const hasWinner = Array.isArray(winnerInfo) && winnerInfo.length > 0;

    // Restore the useEffect for the timer
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentIndex((prevIndex: number) => {
                if (prevIndex === 2) {
                    // Handle case where prevIndex is 2 (e.g., no change or custom logic)
                    return prevIndex + 2; // For example, keep it the same
                }
                if (prevIndex === 4) {
                    // If prevIndex is 4, increment by 2
                    return prevIndex + 2;
                }
                if (prevIndex === 9) {
                    // If prevIndex is 4, increment by 2
                    return prevIndex - 8;
                } else {
                    // Otherwise, just increment by 1
                    return prevIndex + 1;
                }
            });
        }, 30000);

        // Cleanup the timer on component unmount
        return () => clearTimeout(timer);
    }, [currentIndex]);

    // Memoize handlers
    const handleResize = useCallback(() => {
        // Add a small delay for orientation changes to ensure dimensions are updated
        setTimeout(() => {
            tableLayout.refreshLayout();
            setIsMobile(window.innerWidth <= 414);
            setIsMobileLandscape(window.innerWidth <= 1024 && window.innerWidth > window.innerHeight && window.innerHeight <= 600);
        }, 100);
    }, [tableLayout]);

    useEffect(() => {
        window.addEventListener("resize", handleResize);
        window.addEventListener("orientationchange", handleResize);

        // Also listen for the modern screen orientation API
        if (screen.orientation) {
            screen.orientation.addEventListener("change", handleResize);
        }

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("orientationchange", handleResize);
            if (screen.orientation) {
                screen.orientation.removeEventListener("change", handleResize);
            }
        };
    }, [handleResize]);

    // Position arrays are now managed by useTableLayout hook
    // useEffect(() => { ... }, [tableSize, id]);

    const onCloseSideBar = useCallback(() => {
        setOpenSidebar(!openSidebar);
    }, [openSidebar]);

    // Memoize formatted balance - Cosmos returns microunits (6 decimals)
    const balanceFormatted = useMemo(() => (accountBalance ? formatUSDCToSimpleDollars(accountBalance) : "0.00"), [accountBalance]);

    const potDisplayValues = useMemo(() => {
        // pots[0] = main pot (completed rounds only)
        // totalPot = live total (main pot + current round bets)
        const pots = Array.isArray(gameState?.pots) ? (gameState?.pots as string[]) : [];
        const mainPotRaw = pots.length > 0 ? BigInt(pots[0]) : 0n;
        const totalPotRaw = gameState?.totalPot ? BigInt(gameState.totalPot) : mainPotRaw;

        // Check if this is a tournament-style game
        const isTournamentStyle = isTournamentFormat(gameFormat) || isSitAndGoFormat(gameFormat);

        let totalPotCalculated: string;
        let mainPotCalculated: string;

        if (isTournamentStyle) {
            // Tournament: pot is chip count, display with commas
            totalPotCalculated = totalPotRaw === 0n ? "0" : formatChipCount(Number(totalPotRaw));
            mainPotCalculated = mainPotRaw === 0n ? "0" : formatChipCount(Number(mainPotRaw));
        } else {
            // Cash game: pot is USDC microunits, convert to dollars
            totalPotCalculated = totalPotRaw === 0n ? "0.00" : formatUSDCToSimpleDollars(totalPotRaw.toString());
            mainPotCalculated = mainPotRaw === 0n ? "0.00" : formatUSDCToSimpleDollars(mainPotRaw.toString());
        }

        return {
            totalPot: totalPotCalculated,
            mainPot: mainPotCalculated,
            isTournamentStyle
        };
    }, [gameState?.pots, gameState?.totalPot, gameFormat]);



    const copyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
    }, []);

    // Handler for copying table link
    const handleCopyTableLink = useCallback(async () => {
        try {
            const tableUrl = `${window.location.origin}/table/${id}`;
            await navigator.clipboard.writeText(tableUrl);
            toast.success("Table link copied to clipboard!", {
                position: "top-right",
                autoClose: 2000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true
            });
        } catch (error) {
            console.error("Failed to copy table link:", error);
            toast.error("Failed to copy link. Please try again.", {
                position: "top-right",
                autoClose: 2000
            });
        }
    }, [id]);

    // Memoize event handlers to prevent re-renders
    const handleLobbyClick = useCallback(() => {
        window.location.href = "/";
    }, []);

    const handleDepositClick = useCallback(() => {
        window.location.href = "/";
    }, []);

    // Open leave table modal
    const handleLeaveTableClick = useCallback(() => {
        setIsLeaveModalOpen(true);
    }, []);

    // Close leave table modal
    const handleLeaveModalClose = useCallback(() => {
        setIsLeaveModalOpen(false);
    }, []);

    // Get current player data for leave modal
    const currentPlayerData = useMemo(() => {
        return tableDataValues.tableDataPlayers?.find((p: PlayerDTO) => p.address?.toLowerCase() === userWalletAddress?.toLowerCase());
    }, [tableDataValues.tableDataPlayers, userWalletAddress]);

    // Confirm leave table action
    const handleLeaveTableConfirm = useCallback(async () => {
        if (!id || !currentPlayerData) {
            throw new Error("Cannot leave: missing table ID or player data");
        }

        await leaveTable(id, currentPlayerData.stack || "0", currentNetwork);

        // Refresh balance after leaving
        fetchAccountBalance();
    }, [id, userWalletAddress, currentPlayerData, currentNetwork, fetchAccountBalance]);

    // Show error page if connection/general error occurred
    if (error && id) {
        const handleRetry = () => {
            unsubscribeFromTable();
            subscribeToTable(id);
        };
        return (
            <TableErrorPage
                error={{
                    missingFields: [],
                    message: error.message,
                    rawData: undefined
                }}
                tableId={id}
                onRetry={handleRetry}
            />
        );
    }

    // Show error page if validation failed
    if (validationError && id) {
        const handleRetry = () => {
            unsubscribeFromTable();
            subscribeToTable(id);
        };
        return <TableErrorPage error={validationError} tableId={id} onRetry={handleRetry} />;
    }

    return (
        <div className="table-container">
            {/* Temporary Color Debug Component */}
            {/* <ColorDebug /> */}

            {/*//! HEADER - CASINO STYLE - Hidden in mobile landscape */}
            <TableHeader
                tableId={id || ""}
                isMobileLandscape={isMobileLandscape}
                gameFormat={gameFormat || null}
                gameOptions={gameOptions}
                tableActivePlayers={tableActivePlayers}
                publicKey={publicKey}
                formattedAddress={formattedAddress}
                isBalanceLoading={isBalanceLoading}
                balanceFormatted={balanceFormatted}
                formattedValues={formattedValues}
                handNumber={handNumber}
                actionCount={actionCount}
                nextToAct={nextToAct}
                currentPlayerData={currentPlayerData || null}
                openSidebar={openSidebar}
                handleLobbyClick={handleLobbyClick}
                handleCopyTableLink={handleCopyTableLink}
                handleDepositClick={handleDepositClick}
                fetchAccountBalance={fetchAccountBalance}
                copyToClipboard={copyToClipboard}
                onCloseSideBar={onCloseSideBar}
                handleLeaveTableClick={handleLeaveTableClick}
            />

            {/* Mobile Landscape Floating Controls */}
            {isMobileLandscape && (
                <div className="fixed top-2 left-2 right-2 flex justify-between items-center z-50">
                    {/* Left: Essential Info */}
                    <div className="flex items-center gap-2 bg-black bg-opacity-70 px-2 py-1 rounded-lg">
                        <span className="text-white text-xs font-bold cursor-pointer" onClick={handleLobbyClick}>
                            Table {id ? id.slice(-5) : ""}
                        </span>
                        <span className="text-gray-300 text-xs">|</span>
                        <span className="text-white text-xs">
                            {formattedValues.isTournamentStyle
                                ? `${formattedValues.smallBlindFormatted}/${formattedValues.bigBlindFormatted}`
                                : `$${formattedValues.smallBlindFormatted}/${formattedValues.bigBlindFormatted}`}
                        </span>
                    </div>

                    {/* Right: Balance & Leave */}
                    <div className="flex items-center gap-2 bg-black bg-opacity-70 px-2 py-1 rounded-lg">
                        <span className="text-white text-xs font-mono">${balanceFormatted}</span>
                        {currentPlayerData && (
                            <>
                                <span className="text-gray-300 text-xs">|</span>
                                <span className="text-white text-xs cursor-pointer flex items-center gap-1" onClick={handleLeaveTableClick}>
                                    Leave <RxExit size={10} />
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/*//! BODY */}
            <div className="flex w-full flex-grow overflow-visible">
                {/*//! TABLE + FOOTER */}
                <div className="flex-grow flex flex-col justify-between transition-all duration-250 overflow-visible body-container">
                    <HexagonPattern patternId="hexagons-table" />
                    {/* Animated background overlay */}
                    <div className="background-shimmer shimmer-animation" />
                    {/* Static animated overlay - mouse tracking removed for performance */}
                    <div className="background-animated-static" />
                    {/* Static base gradient - mouse tracking removed for performance */}
                    <div className="background-base-static" />
                    {/*//! TABLE */}
                    <div className="flex-grow flex flex-col align-center justify-center min-h-[calc(100vh-150px)] sm:min-h-[calc(100vh-350px)] z-[0] relative">
                        {/* Hexagon pattern overlay */}

                        <div
                            className={`${isMobile ? "zoom-wrapper-mobile" : "zoom-wrapper-desktop"}`}
                            style={{
                                transform: tableLayout.tableTransform
                            }}
                        >
                            <div className="flex-grow scrollbar-none bg-custom-table h-full flex flex-col justify-center items-center relative">
                                <div className="w-[900px] h-[450px] relative text-center block transform translate-y-[30px]">
                                    <div className="h-full flex align-center justify-center">
                                        <div
                                            className="table-surface-shadow z-20 relative flex flex-col w-[900px] h-[350px] left-1/2 top-0 transform -translate-x-1/2 text-center border-[3px] border-rgba(255, 255, 255, 0.2) border-solid rounded-full items-center justify-center"
                                        >
                                            {/* //! Table */}
                                            <TableBoard
                                                clubLogo={clubLogo}
                                                potDisplayValues={potDisplayValues}
                                                communityCards={tableDataValues.tableDataCommunityCards || []}
                                                isSitAndGoWaitingForPlayers={isSitAndGoWaitingForPlayers}
                                                cardBackStyle={cardBackStyle}
                                            />

                                            {/*//! CHIP - Hide when sit-and-go is waiting for players */}
                                            {!isSitAndGoWaitingForPlayers && tableLayout.positions.chips.map((position, index) => {
                                                const chipAmount = getChipAmount(index + 1);

                                                // DON'T RENDER CHIP IF AMOUNT IS 0
                                                if (chipAmount === "0" || chipAmount === "" || !chipAmount) {
                                                    return null;
                                                }

                                                return (
                                                    <div
                                                        key={`key-${index}`}
                                                        className="chip-position"
                                                        style={{
                                                            left: position.left,
                                                            bottom: position.bottom
                                                        }}
                                                    >
                                                        <Chip amount={chipAmount} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <PlayerSeating
                                        tableLayout={tableLayout}
                                        tableSize={tableSize}
                                        startIndex={startIndex}
                                        tableActivePlayers={tableActivePlayers}
                                        tableDataPlayers={tableDataValues.tableDataPlayers}
                                        userWalletAddress={userWalletAddress}
                                        currentIndex={currentIndex}
                                        hasWinner={hasWinner}
                                        isSitAndGoWaitingForPlayers={isSitAndGoWaitingForPlayers}
                                        winnerInfo={winnerInfo}
                                        cardBackStyle={cardBackStyle}
                                        updateBalanceOnPlayerJoin={updateBalanceOnPlayerJoin}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end mr-3 mb-1">
                            {/* Debug feature removed - hand_strength is not part of PlayerDTO */}
                            {/* {userData && <span className="text-white bg-[#0c0c0c80] rounded-full px-2">{userData.hand_strength}</span>} */}
                        </div>
                    </div>
                    {/* Live Hand Strength Display */}
                    <LiveHandStrengthDisplay />

                    {/*//! FOOTER - Adjusted for mobile landscape */}
                    <div
                        className={`w-full flex justify-center items-center z-[10] ${
                            isMobileLandscape
                                ? "h-[80px] fixed bottom-0 left-0 right-0 bg-black bg-opacity-50 backdrop-blur-sm"
                                : "h-[200px] sm:h-[250px] bg-transparent"
                        }`}
                    >
                        <div className={`w-full flex justify-center items-center h-full ${isMobileLandscape ? "max-w-[500px] px-2" : "max-w-[700px]"}`}>
                            <PokerActionPanel onTransactionSubmitted={handleTransactionSubmitted} />
                        </div>
                        {/* <div className="w-full h-[400px] flex justify-center overflow-y-auto">
                            <Footer2 tableId={id} />
                        </div> */}
                    </div>
                </div>
                {/*//! ACTION LOG OVERLAY */}
                <TableSidebar isOpen={openSidebar} />
            </div>

            {/* Status Messages */}
            <TableStatusMessages
                viewportMode={viewportMode}
                isMobileLandscape={isMobileLandscape}
                currentUserSeat={currentUserSeat}
                nextToActSeat={nextToActSeat}
                isGameInProgress={isGameInProgress}
                isCurrentUserTurn={isCurrentUserTurn}
                playerLegalActions={playerLegalActions}
                tableActivePlayers={tableActivePlayers}
                isSitAndGoWaitingForPlayers={isSitAndGoWaitingForPlayers}
                smallBlindPosition={tableDataValues.tableDataSmallBlindPosition}
                bigBlindPosition={tableDataValues.tableDataBigBlindPosition}
                dealerPosition={tableDataValues.tableDataDealer}
            />

            {/* Layout Debug Panel */}
            <LayoutDebugInfo viewportMode={viewportMode} startIndex={startIndex} tableSize={tableSize} results={results} setStartIndex={setStartIndex} />

            {/* Player Action Buttons */}
            <PlayerActionButtons
                isMobile={isMobile}
                isMobileLandscape={isMobileLandscape}
                legalActions={playerLegalActions}
                tableId={id}
                currentNetwork={currentNetwork}
                playerStatus={playerStatus}
                sitInMethod={sitInMethod}
                pendingSitOut={pendingSitOut}
                totalSeatedPlayers={tableActivePlayers.length}
                handNumber={handNumber}
                hasActivePlayers={hasActivePlayers}
            />

            {/* All Table Modals */}
            <TableModals
                showCountdown={showCountdown}
                gameStartTime={gameStartTime}
                handleCountdownComplete={handleCountdownComplete}
                handleSkipCountdown={handleSkipCountdown}
                gameState={gameState}
                gameFormat={gameFormat}
                isUserAlreadyPlaying={isUserAlreadyPlaying}
                tableId={id}
                onAutoJoinSuccess={() => window.location.reload()}
                isSitAndGoWaitingForPlayers={isSitAndGoWaitingForPlayers}
                recentTxHash={recentTxHash}
                handleCloseTransactionPopup={handleCloseTransactionPopup}
                isLeaveModalOpen={isLeaveModalOpen}
                handleLeaveModalClose={handleLeaveModalClose}
                handleLeaveTableConfirm={handleLeaveTableConfirm}
                currentPlayerStack={currentPlayerData?.stack || "0"}
                isInActiveHand={isGameInProgress && currentUserSeat > 0}
            />
        </div>
    );
});

export default Table;
