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

import { useEffect, useState, useMemo, useCallback, memo, useRef } from "react";
import { isSitAndGoFormat, isTournamentFormat } from "../../utils/gameFormatUtils";
import { formatPotDisplay, formatChipCount } from "../../utils/potDisplayUtils";
// Position arrays now come from useTableLayout hook
// // Position arrays now come from useTableLayout hook
// import { playerPosition, dealerPosition, vacantPlayerPosition } from "../../utils/PositionArray";
import PokerActionPanel from "../Footer";

// Extracted Table components
import {
    TableHeader,
    TableBoard,
    TableSidebar,
    TableModals,
    PlayerSeating,
    TableStatusMessages,
    PlayerActionButtons,
    LayoutDebugInfo
} from "./Table/components";

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
import { useReplayMode } from "../../hooks/game/useReplayMode";
import { useIndexerApi } from "../../context/IndexerApiContext";

// Table Layout Configuration
import { useTableLayout } from "../../hooks/game/useTableLayout";
import { useVacantSeatData } from "../../hooks/game/useVacantSeatData";
import { useBlindLevel } from "../../hooks/game/useBlindLevel";
import {
    getViewportMode,
    COMPONENT_SCALE,
    type PositionArrays,
    TABLE_CENTER_X,
    TABLE_CENTER_Y,
    TABLE_ORIGIN_X,
    TABLE_ORIGIN_Y,
    SEAT_COORDS,
    getContentBounds,
    VIEWPORT_PARAMS,
    PLAYER_UI_PADDING,
    type TableSize
} from "../../config/stageGeometry";
import CustomDealer from "../../assets/CustomDealer.svg";
import { useDealerPosition } from "../../hooks/game/useDealerPosition";

// Turn Notification
import { useTurnNotification } from "../../hooks/notifications/useTurnNotification";

// Mobile Portrait Blocking (#200)
import { useMobileFullscreen } from "../../hooks/game/useMobileFullscreen";
import { MobileOrientationOverlay } from "./Table/components/MobileOrientationOverlay";

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

// Global debug state — shared between LayoutDebugOverlay and Table component
// Press D = draggable overlay, C = chip markers, B = dealer markers, S = seat markers, G = geometry
let _debugChips = false;
let _debugDealers = false;
let _debugSeats = false;
let _debugGeometry = false;
const debugListeners: Set<() => void> = new Set();
function useDebugToggle() {
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        const cb = () => forceUpdate(n => n + 1);
        debugListeners.add(cb);
        return () => {
            debugListeners.delete(cb);
        };
    }, []);
    return { showChips: _debugChips, showDealers: _debugDealers, showSeats: _debugSeats, showGeometry: _debugGeometry };
}

/** DEBUG OVERLAY: Press 'D' to toggle. Shows draggable marker with coordinates. */
const LayoutDebugOverlay = () => {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 200, y: 200 });
    const [dragging, setDragging] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            // 1=all overlays, 2=geometry, 3=seats, 4=chips, 5=dealers, 6=crosshair
            if (e.key === "1") {
                const s = !_debugGeometry;
                _debugGeometry = s;
                _debugChips = s;
                _debugDealers = s;
                _debugSeats = s;
                debugListeners.forEach(cb => cb());
            }
            if (e.key === "2") {
                _debugGeometry = !_debugGeometry;
                debugListeners.forEach(cb => cb());
            }
            if (e.key === "3") {
                _debugSeats = !_debugSeats;
                debugListeners.forEach(cb => cb());
            }
            if (e.key === "4") {
                _debugChips = !_debugChips;
                debugListeners.forEach(cb => cb());
            }
            if (e.key === "5") {
                _debugDealers = !_debugDealers;
                debugListeners.forEach(cb => cb());
            }
            if (e.key === "6") setVisible(v => !v);
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    useEffect(() => {
        if (!visible) return;
        const handleMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
            if (dragging) setPos({ x: e.clientX, y: e.clientY });
        };
        const handleUp = () => setDragging(false);
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
    }, [visible, dragging]);

    if (!visible) return null;

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 999999, pointerEvents: "none" }}>
            <div style={{ position: "absolute", left: pos.x, top: 0, width: 1, height: "100%", backgroundColor: "rgba(255,0,0,0.4)" }} />
            <div style={{ position: "absolute", top: pos.y, left: 0, height: 1, width: "100%", backgroundColor: "rgba(255,0,0,0.4)" }} />
            <div
                onMouseDown={e => {
                    e.preventDefault();
                    setDragging(true);
                }}
                style={{
                    position: "absolute",
                    left: pos.x - 15,
                    top: pos.y - 15,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    backgroundColor: "rgba(255, 0, 0, 0.8)",
                    border: "2px solid white",
                    cursor: "grab",
                    pointerEvents: "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}
            >
                <span style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>+</span>
            </div>
            <div
                style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    backgroundColor: "rgba(0,0,0,0.85)",
                    color: "white",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontFamily: "monospace",
                    fontSize: 12,
                    lineHeight: 1.6,
                    pointerEvents: "auto",
                    minWidth: 220
                }}
            >
                <div style={{ color: "#f87171", fontWeight: "bold", marginBottom: 4 }}>DEBUG (1=all 2=geo 3=seats 4=chips 5=dealers 6=crosshair)</div>
                <div>
                    Viewport: {window.innerWidth}x{window.innerHeight}
                </div>
                <div>
                    Mouse: {mousePos.x}, {mousePos.y}
                </div>
                <div style={{ color: "#4ade80" }}>
                    Marker: {pos.x}, {pos.y}
                </div>
                <div>
                    From bottom: {window.innerHeight - pos.y}px | From right: {window.innerWidth - pos.x}px
                </div>
                <div style={{ marginTop: 4, borderTop: "1px solid #444", paddingTop: 4 }}>
                    <span style={{ color: _debugChips ? "#4ade80" : "#666" }}>C:chips{_debugChips ? " ON" : ""} </span>
                    <span style={{ color: _debugDealers ? "#fbbf24" : "#666" }}>B:dealer{_debugDealers ? " ON" : ""} </span>
                    <span style={{ color: _debugSeats ? "#60a5fa" : "#666" }}>S:seats{_debugSeats ? " ON" : ""} </span>
                    <span style={{ color: _debugGeometry ? "#f472b6" : "#666" }}>G:geometry{_debugGeometry ? " ON" : ""}</span>
                </div>
            </div>
        </div>
    );
};

/** DEBUG: Renders colored markers at chip/dealer/seat positions inside the table div. */
const PositionDebugMarkers: React.FC<{ positions: PositionArrays }> = ({ positions }) => {
    const debug = useDebugToggle();
    const markerStyle = (left: string, top: string, color: string, label: string, useBottom = false) => (
        <div
            key={`${label}-${left}-${top}`}
            style={{
                position: "absolute",
                left,
                ...(useBottom ? { bottom: top } : { top }),
                transform: "translate(-50%, -50%)",
                zIndex: 99999,
                pointerEvents: "none"
            }}
        >
            <div
                style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: color,
                    border: "2px solid white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 8px rgba(0,0,0,0.5)"
                }}
            >
                <span style={{ color: "white", fontSize: 8, fontWeight: "bold" }}>{label}</span>
            </div>
            <div
                style={{
                    position: "absolute",
                    top: 26,
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "rgba(0,0,0,0.8)",
                    color: "white",
                    fontSize: 8,
                    padding: "1px 4px",
                    borderRadius: 3,
                    whiteSpace: "nowrap",
                    fontFamily: "monospace"
                }}
            >
                {left},{top}
            </div>
        </div>
    );
    return (
        <>
            {debug.showChips && positions.chips.map((chip, i) => markerStyle(chip.left, chip.bottom, "#4ade80", `C${i + 1}`, true))}
            {debug.showDealers && positions.dealers.map((d, i) => markerStyle(d.left, d.top, "#fbbf24", `D${i + 1}`))}
            {debug.showSeats && positions.players.map((p, i) => markerStyle(p.left, p.top, "#60a5fa", `S${i + 1}`))}
        </>
    );
};

/** DEBUG: Geometry overlay — table center, seats, bounds box, header/footer lines. Toggle with G key. */
const GeometryDebugOverlay: React.FC<{
    tableSize: number;
    containerWidth: number;
    containerHeight: number;
    zoom: number;
    tableDivRef?: React.RefObject<HTMLDivElement | null>;
}> = ({ tableSize, containerWidth, containerHeight, zoom, tableDivRef }) => {
    const debug = useDebugToggle();
    const [panelPos, setPanelPos] = useState({ x: 20, y: 20 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    if (!debug.showGeometry) return null;

    const ts = tableSize as TableSize;
    const coords = SEAT_COORDS[ts] || SEAT_COORDS[9];
    const bounds = getContentBounds(ts);
    const mode = getViewportMode();
    const params = VIEWPORT_PARAMS[mode];
    const pad = PLAYER_UI_PADDING[mode];
    const usableW = containerWidth - params.paddingH;
    const usableH = containerHeight - params.footerOverlay - params.paddingV;

    const trx = (stageX: number) => stageX - TABLE_ORIGIN_X;
    const tryy = (stageY: number) => stageY - TABLE_ORIGIN_Y;
    const centerX = trx(TABLE_CENTER_X);
    const centerY = tryy(TABLE_CENTER_Y);
    const boundsMinX = trx(bounds.centerX - bounds.width / 2);
    const boundsMinY = tryy(bounds.centerY - bounds.height / 2);

    let sMinX = Infinity,
        sMaxX = -Infinity,
        sMinY = Infinity,
        sMaxY = -Infinity;
    for (const [x, y] of coords) {
        sMinX = Math.min(sMinX, trx(x));
        sMaxX = Math.max(sMaxX, trx(x));
        sMinY = Math.min(sMinY, tryy(y));
        sMaxY = Math.max(sMaxY, tryy(y));
    }

    const tableDivEl = tableDivRef?.current;
    const containerParent = tableDivEl?.closest(".table-container");
    const headerEl = containerParent?.querySelector(".sub-header");
    const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : (containerParent?.getBoundingClientRect()?.top ?? 0);
    const footerHeight = mode === "mobile-landscape" ? 80 : 160;
    const footerTop = window.innerHeight - footerHeight;
    const tableRect = tableDivEl?.getBoundingClientRect();
    const tTop = tableRect?.top ?? 0;
    const tScaleY = tableRect ? tableRect.height / 450 : zoom;
    const boundsTopScreen = tTop + boundsMinY * tScaleY;
    const boundsBottomScreen = tTop + (boundsMinY + bounds.height) * tScaleY;
    const gapTop = boundsTopScreen - headerBottom;
    const gapBottom = footerTop - boundsBottomScreen;

    return (
        <>
            <svg style={{ position: "absolute", top: 0, left: 0, width: "900px", height: "450px", overflow: "visible", zIndex: 99998, pointerEvents: "none" }}>
                <rect
                    x={boundsMinX}
                    y={boundsMinY}
                    width={bounds.width}
                    height={bounds.height}
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    opacity={0.8}
                />
                <text x={boundsMinX + 4} y={boundsMinY - 6} fill="#4ade80" fontSize={12} fontFamily="monospace">
                    bounds {bounds.width.toFixed(0)}x{bounds.height.toFixed(0)}
                </text>
                <rect
                    x={sMinX}
                    y={sMinY}
                    width={sMaxX - sMinX}
                    height={sMaxY - sMinY}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    opacity={0.5}
                />
                <line x1={centerX - 30} y1={centerY} x2={centerX + 30} y2={centerY} stroke="#ef4444" strokeWidth={2} />
                <line x1={centerX} y1={centerY - 30} x2={centerX} y2={centerY + 30} stroke="#ef4444" strokeWidth={2} />
                <circle cx={centerX} cy={centerY} r={6} fill="#ef4444" stroke="white" strokeWidth={1.5} />
                <text x={centerX + 12} y={centerY - 12} fill="#ef4444" fontSize={11} fontFamily="monospace" fontWeight="bold">
                    CENTER
                </text>
                {coords.map(([sx, sy], i) => (
                    <line
                        key={`line-${i}`}
                        x1={centerX}
                        y1={centerY}
                        x2={trx(sx)}
                        y2={tryy(sy)}
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth={1.5}
                        strokeDasharray="6 3"
                    />
                ))}
                {coords.map(([sx, sy], i) => (
                    <g key={`seat-${i}`}>
                        <circle cx={trx(sx)} cy={tryy(sy)} r={14} fill="#3b82f6" stroke="white" strokeWidth={1.5} opacity={0.9} />
                        <text x={trx(sx)} y={tryy(sy) + 4} fill="white" fontSize={10} fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                            {i + 1}
                        </text>
                    </g>
                ))}
            </svg>
            {/* Header/footer lines and info panel are rendered by GeometryFixedOverlay outside the zoom-wrapper */}
        </>
    );
};

/** DEBUG: Fixed overlay for header/footer lines + info panel.
 *  Rendered OUTSIDE the zoom-wrapper so position:fixed actually works. */
const GeometryFixedOverlay: React.FC<{
    containerWidth: number;
    containerHeight: number;
    zoom: number;
    tableSize: number;
}> = ({ containerWidth, containerHeight, zoom, tableSize }) => {
    const debug = useDebugToggle();
    const [panelPos, setPanelPos] = useState({ x: 20, y: 20 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    if (!debug.showGeometry) return null;

    const ts = tableSize as TableSize;
    const coords = SEAT_COORDS[ts] || SEAT_COORDS[9];
    const bounds = getContentBounds(ts);
    const mode = getViewportMode();
    const params = VIEWPORT_PARAMS[mode];
    const pad = PLAYER_UI_PADDING[mode];
    const usableW = containerWidth - params.paddingH;
    const usableH = containerHeight - params.footerOverlay - params.paddingV;
    const footerHeight = mode === "mobile-landscape" ? 80 : 160;
    const footerTop = window.innerHeight - footerHeight;

    // Find header bottom from DOM
    const headerEl = document.querySelector(".sub-header");
    const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : 0;

    return (
        <>
            <svg style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 999990, pointerEvents: "none" }}>
                <line x1={0} y1={headerBottom} x2={window.innerWidth} y2={headerBottom} stroke="#f97316" strokeWidth={2} opacity={0.8} />
                <text x={8} y={headerBottom + 14} fill="#f97316" fontSize={10} fontFamily="monospace">
                    header bottom (y={headerBottom.toFixed(0)})
                </text>
                <line x1={0} y1={footerTop} x2={window.innerWidth} y2={footerTop} stroke="#f97316" strokeWidth={2} opacity={0.8} />
                <text x={8} y={footerTop - 6} fill="#f97316" fontSize={10} fontFamily="monospace">
                    footer top (y={footerTop.toFixed(0)})
                </text>
            </svg>
            <div
                style={{
                    position: "fixed",
                    left: panelPos.x,
                    top: panelPos.y,
                    zIndex: 999999,
                    backgroundColor: "rgba(0,0,0,0.9)",
                    color: "white",
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontFamily: "monospace",
                    fontSize: 12,
                    lineHeight: 1.7,
                    cursor: dragging ? "grabbing" : "grab",
                    userSelect: "none",
                    border: "1px solid #f472b6",
                    minWidth: 340
                }}
                onMouseDown={e => {
                    e.preventDefault();
                    setDragging(true);
                    dragStart.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y };
                    const onMove = (ev: MouseEvent) => setPanelPos({ x: ev.clientX - dragStart.current.x, y: ev.clientY - dragStart.current.y });
                    const onUp = () => {
                        setDragging(false);
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                }}
            >
                <div style={{ color: "#f472b6", fontWeight: "bold", marginBottom: 4 }}>GEOMETRY DEBUG (G) — drag to move</div>
                <div>
                    zoom: {zoom.toFixed(3)} | mode: {mode}
                </div>
                <div>
                    container: {containerWidth}x{containerHeight}
                </div>
                <div>
                    usable: {usableW.toFixed(0)}x{usableH.toFixed(0)} (footer={params.footerOverlay})
                </div>
                <div style={{ color: "#4ade80" }}>
                    bounds: {bounds.width.toFixed(0)}x{bounds.height.toFixed(0)} center=({bounds.centerX.toFixed(0)},{bounds.centerY.toFixed(0)})
                </div>
                <div style={{ color: "#22d3ee" }}>
                    seats: {coords.length} | scaleH={usableH > 0 ? (usableH / bounds.height).toFixed(3) : "?"} scaleW=
                    {usableW > 0 ? (usableW / bounds.width).toFixed(3) : "?"}
                </div>
                <div style={{ color: "#f97316" }}>
                    header: {headerBottom.toFixed(0)}px | footer: {footerTop}px | avail: {(footerTop - headerBottom).toFixed(0)}px
                </div>
            </div>
        </>
    );
};

const GeometryToggleButton: React.FC = () => {
    const debug = useDebugToggle();
    return (
        <button
            onClick={() => {
                const s = !_debugGeometry;
                _debugGeometry = s;
                _debugChips = s;
                _debugDealers = s;
                _debugSeats = s;
                debugListeners.forEach(cb => cb());
            }}
            style={{
                position: "fixed",
                bottom: 12,
                left: 12,
                zIndex: 999999,
                padding: "6px 12px",
                borderRadius: 6,
                border: `2px solid ${debug.showGeometry ? "#f472b6" : "#555"}`,
                backgroundColor: debug.showGeometry ? "rgba(244,114,182,0.2)" : "rgba(0,0,0,0.6)",
                color: debug.showGeometry ? "#f472b6" : "#888",
                fontSize: 12,
                fontFamily: "monospace",
                fontWeight: "bold",
                cursor: "pointer"
            }}
        >
            [G] Geometry
        </button>
    );
};

const Table = React.memo(() => {
    const { id } = useParams<{ id: string }>();
    // Game state context and subscription
    const { subscribeToTable, unsubscribeFromTable, gameState, gameFormat, validationError, error, loadHistoricalState, isReplayMode, replayBlockNumber } =
        useGameStateContext();
    const { currentNetwork } = useNetwork();

    // Replay mode — read blocknumber/actionindex query params
    const { isReplayMode: hasReplayParams, blockNumber: replayBlockParam, actionIndex: replayActionIndex, clearReplayParams } = useReplayMode();
    const indexerApi = useIndexerApi();

    useEffect(() => {
        if (id) {
            if (hasReplayParams && replayBlockParam) {
                // Replay mode: fetch historical state from chain, no WebSocket
                loadHistoricalState(id, replayBlockParam);
            } else {
                // Live mode: subscribe to WebSocket
                subscribeToTable(id);
            }
        }
    }, [id, hasReplayParams, replayBlockParam, subscribeToTable, loadHistoricalState]);

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

    // Container refs for geometry engine
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const tableDivRef = useRef<HTMLDivElement>(null);

    // StageGeometry layout system — supports 2/4/6/9 tables, auto-fit to any viewport
    const tableLayout = useTableLayout((tableSize as 2 | 4 | 6 | 9) || 9, tableContainerRef);
    const { dealerSeat } = useDealerPosition();

    // Mobile portrait blocking (#200)
    const { isPortraitBlocked } = useMobileFullscreen();

    // Add the useGameProgress hook
    const { isGameInProgress, handNumber, actionCount, nextToAct } = useGameProgress(id);

    // Add the useGameOptions hook
    const { gameOptions } = useGameOptions();

    // Blind level info for SNG/Tournament games
    const blindLevel = useBlindLevel();

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

    // Chip positions now come from tableLayout.positions.chips (stageGeometry)

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
        return tableActivePlayers.some((p: PlayerDTO) => p.status === PlayerStatus.ACTIVE || p.status === PlayerStatus.ALL_IN);
    }, [tableActivePlayers]);

    // Optimize window width detection - only check on resize
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 414);
    const [isMobileLandscape, setIsMobileLandscape] = useState(
        window.innerWidth <= 1024 && window.innerWidth > window.innerHeight && window.innerHeight <= 600
    );
    const envTableStyle = import.meta.env.VITE_TABLE_STYLE;
    const defaultTableStyle: "modern" | "classic" | "nouns" = envTableStyle === "classic" || envTableStyle === "nouns" ? envTableStyle : "modern";
    const [tableStyle, setTableStyle] = useState<"modern" | "classic" | "nouns">(defaultTableStyle);

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
    // Auto-rotate table so current player is always at bottom (6 o'clock) (#13)
    // Formula in PlayerSeating: seatNumber = ((positionIndex - startIndex + tableSize) % tableSize) + 1
    // For position 0 (bottom) to show seat S: S = ((0 - startIndex + tableSize) % tableSize) + 1
    // Solving: startIndex = (tableSize - (S - 1)) % tableSize
    useEffect(() => {
        if (currentUserSeat > 0 && tableSize > 0) {
            setStartIndex((tableSize - (currentUserSeat - 1)) % tableSize);
        }
    }, [currentUserSeat, tableSize]);

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
        const pots = Array.isArray(gameState?.pots) ? (gameState?.pots as string[]) : [];
        return formatPotDisplay(pots, gameState?.totalPot, gameFormat, gameState?.round);
    }, [gameState?.pots, gameState?.totalPot, gameFormat, gameState?.round]);

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

    // Handler for sharing current hand as a table replay URL
    const handleShareHand = useCallback(async () => {
        if (!id || !handNumber) {
            toast.info("No hand data available to share");
            return;
        }
        try {
            const shareUrl = `${window.location.origin}/explorer/hand/${id}/${handNumber}`;
            await navigator.clipboard.writeText(shareUrl);
            toast.success("Hand link copied to clipboard!", {
                position: "top-right",
                autoClose: 2000
            });
        } catch {
            toast.error("Failed to copy share URL.");
        }
    }, [id, handNumber]);

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
    }, [id, currentPlayerData, currentNetwork, fetchAccountBalance]);

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
            {/* Replay mode banner */}
            {isReplayMode && replayBlockNumber && (
                <div
                    className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-4 py-2 px-4 text-sm"
                    style={{ background: "rgba(214, 60, 94, 0.9)", color: "#fff" }}
                >
                    <span>
                        Viewing hand at block #{replayBlockNumber}
                        {replayActionIndex != null ? ` (action ${replayActionIndex})` : ""}
                    </span>
                    <button
                        onClick={clearReplayParams}
                        className="px-3 py-1 rounded text-xs font-bold transition-opacity hover:opacity-80"
                        style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
                    >
                        Go Live
                    </button>
                </div>
            )}
            {/* DEBUG OVERLAY: Press D/C/B/S/G to toggle debug tools */}
            <LayoutDebugOverlay />
            {/* Table style toggle */}
            <button
                onClick={() => setTableStyle(s => (s === "modern" ? "classic" : s === "classic" ? "nouns" : "modern"))}
                style={{
                    position: "fixed",
                    bottom: 12,
                    left: 12,
                    zIndex: 999999,
                    padding: "6px 12px",
                    borderRadius: tableStyle === "nouns" ? 0 : 6,
                    border: tableStyle === "nouns" ? "2px solid #d63c5e" : "2px solid #555",
                    backgroundColor: tableStyle === "nouns" ? "rgba(26,26,46,0.8)" : "rgba(0,0,0,0.6)",
                    color: tableStyle === "nouns" ? "#e1d7d5" : "#ccc",
                    fontSize: 12,
                    fontFamily: tableStyle === "nouns" ? "'Silkscreen', monospace" : "monospace",
                    fontWeight: "bold",
                    cursor: "pointer"
                }}
            >
                Table: {tableStyle === "modern" ? "Modern" : tableStyle === "classic" ? "Classic" : "Nouns"}
            </button>
            <GeometryFixedOverlay
                containerWidth={tableLayout.containerWidth}
                containerHeight={tableLayout.containerHeight}
                zoom={tableLayout.zoom}
                tableSize={tableSize}
            />

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
                blindLevel={blindLevel}
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
                handleShareHand={handleShareHand}
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

            {/*//! BODY — single flex-grow container, measured by geometry engine */}
            <div ref={tableContainerRef} className="flex-grow relative overflow-visible">
                {/* Background layers */}
                {tableStyle !== "nouns" && <HexagonPattern patternId="hexagons-table" />}
                {tableStyle === "nouns" ? (
                    <div className="nouns-background" />
                ) : (
                    <>
                        <div className="background-shimmer shimmer-animation" />
                        <div className="background-animated-static" />
                        <div className="background-base-static" />
                    </>
                )}

                {/*//! TABLE — zoom-wrapper applies calculated transform */}
                <div className={`${isMobile ? "zoom-wrapper-mobile" : "zoom-wrapper-desktop"}`} style={{ transform: tableLayout.tableTransform }}>
                    {/*//! 1000x500 table coordinate space — positioned at TABLE_ORIGIN (300,285) in the 1600x850 stage */}
                    <div ref={tableDivRef} className="w-[1000px] h-[500px] absolute" style={{ left: "300px", top: "285px" }}>
                        {/* Outer rail — Ignition-style 3D depth (modern and nouns) */}
                        {(tableStyle === "modern" || tableStyle === "nouns") && (
                            <div
                                className="absolute z-10 rounded-[290px]"
                                style={{
                                    width: "1060px",
                                    height: "560px",
                                    left: "-30px",
                                    top: "-30px",
                                    border: tableStyle === "nouns" ? "10px solid rgba(26, 26, 46, 0.8)" : "10px solid rgba(100, 75, 40, 0.6)",
                                    boxShadow:
                                        tableStyle === "nouns"
                                            ? "0 12px 48px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.5), inset 0 3px 12px rgba(0,0,0,0.5), inset 0 -2px 6px rgba(255,255,255,0.05)"
                                            : "0 12px 48px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.5), inset 0 3px 12px rgba(0,0,0,0.5), inset 0 -2px 6px rgba(255,255,255,0.05)",
                                    background:
                                        tableStyle === "nouns"
                                            ? "linear-gradient(180deg, rgba(26,26,46,0.4) 0%, rgba(26,26,46,0.7) 100%)"
                                            : "linear-gradient(180deg, rgba(80,55,25,0.25) 0%, rgba(40,25,10,0.45) 100%)"
                                }}
                            />
                        )}
                        {/* Table felt surface */}
                        <div
                            className={`table-surface-shadow z-20 relative flex flex-col w-[1000px] h-[500px] text-center border-solid rounded-[250px] items-center justify-center ${tableStyle === "nouns" ? "nouns-table-felt border-[3px]" : tableStyle === "classic" ? "border-[3px]" : "border-[2px]"}`}
                            style={{
                                borderColor:
                                    tableStyle === "nouns"
                                        ? "rgba(214, 60, 94, 0.4)"
                                        : tableStyle === "classic"
                                          ? "rgba(255, 255, 255, 0.3)"
                                          : "rgba(255, 255, 255, 0.08)"
                            }}
                        >
                            <TableBoard
                                clubLogo={clubLogo}
                                potDisplayValues={potDisplayValues}
                                communityCards={tableDataValues.tableDataCommunityCards || []}
                                isSitAndGoWaitingForPlayers={isSitAndGoWaitingForPlayers}
                                cardBackStyle={cardBackStyle}
                                tableTheme={tableStyle}
                            />

                            {/* Chips — map screen position to rotated seat number */}
                            {!isSitAndGoWaitingForPlayers &&
                                tableLayout.positions.chips.map((position, positionIndex) => {
                                    const seatNumber = ((positionIndex - startIndex + tableSize) % tableSize) + 1;
                                    const chipAmount = getChipAmount(seatNumber);
                                    if (chipAmount === "0" || chipAmount === "" || !chipAmount) return null;
                                    return (
                                        <div key={`chip-${positionIndex}`} className="chip-position" style={{ left: position.left, bottom: position.bottom }}>
                                            <Chip amount={chipAmount} isTournament={isTournamentFormat(gameFormat)} />
                                        </div>
                                    );
                                })}
                        </div>

                        {/* Dealer Button — convert seat number to rotated screen position */}
                        {(() => {
                            const dIdx = dealerSeat != null && dealerSeat > 0
                                ? ((dealerSeat - 1 + startIndex) % tableSize)
                                : -1;
                            const dPos = dIdx >= 0 ? tableLayout.positions.dealers[dIdx] : null;
                            if (!dPos) return null;
                            return (
                                <div className="absolute w-12 h-12 z-[25]" style={{ left: dPos.left, top: dPos.top, transform: "translate(-50%, -50%)" }}>
                                    <img src={CustomDealer} alt="Dealer Button" className="w-full h-full" />
                                </div>
                            );
                        })()}

                        {/* Player seats */}
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

                        {/* DEBUG overlays */}
                        <PositionDebugMarkers positions={tableLayout.positions} />
                        <GeometryDebugOverlay
                            tableSize={tableSize}
                            containerWidth={tableLayout.containerWidth}
                            containerHeight={tableLayout.containerHeight}
                            zoom={tableLayout.zoom}
                            tableDivRef={tableDivRef}
                        />
                    </div>
                </div>

                {/* Live Hand Strength Display */}
                <LiveHandStrengthDisplay />
            </div>

            {/*//! FOOTER — hidden in replay mode (read-only) */}
            {!isReplayMode && (
                <div
                    className={`w-full flex justify-center items-center z-[10] ${
                        isMobileLandscape
                            ? "h-[80px] fixed bottom-0 left-0 right-0 bg-black bg-opacity-50 backdrop-blur-sm"
                            : "h-[160px] fixed bottom-0 left-0 right-0 bg-black bg-opacity-50 backdrop-blur-sm"
                    }`}
                >
                    <div className={`w-full flex justify-center items-center h-full ${isMobileLandscape ? "max-w-[500px] px-2" : "max-w-[700px]"}`}>
                        <PokerActionPanel onTransactionSubmitted={handleTransactionSubmitted} />
                    </div>
                </div>
            )}

            {/*//! ACTION LOG OVERLAY */}
            <TableSidebar isOpen={openSidebar} />

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

            {/* Player Action Buttons — hidden in replay mode (read-only) */}
            {!isReplayMode && (
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
                    currentStack={currentPlayerData?.stack || "0"}
                    minBuyIn={gameOptions?.minBuyIn || "0"}
                    maxBuyIn={gameOptions?.maxBuyIn || "0"}
                    walletBalance={accountBalance}
                />
            )}

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
                handleLeaveTableClick={handleLeaveTableClick}
                recentTxHash={recentTxHash}
                handleCloseTransactionPopup={handleCloseTransactionPopup}
                isLeaveModalOpen={isLeaveModalOpen}
                handleLeaveModalClose={handleLeaveModalClose}
                handleLeaveTableConfirm={handleLeaveTableConfirm}
                currentPlayerStack={currentPlayerData?.stack || "0"}
                isInActiveHand={isGameInProgress && currentUserSeat > 0}
            />

            {/* Mobile Portrait Blocking (#200) */}
            <MobileOrientationOverlay isPortraitBlocked={isPortraitBlocked} onGoToLobby={handleLobbyClick} />
        </div>
    );
});

export default Table;
