import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNetwork } from "./NetworkContext";
import { TexasHoldemStateDTO, GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { createAuthPayload } from "../utils/cosmos/signing";
import { setLatestGameState } from "../hooks/playerActions/transportAction";
import { ClassifiedMessage } from "../bus/ingest";
import { parseFrame } from "../bus/frame";
import { GameMessageBus } from "../bus/GameMessageBus";
import { type GameStreamItem } from "../bus/types";
import { viteEnv } from "../utils/viteEnv";
import { toGameFormat, toGameVariant } from "../utils/gameFormatUtils";
import { hasElements } from "../utils/guards";
import type { ValidationError } from "../components/playPage/TableErrorPage";
import { CosmosApi } from "../apis/Api";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { GameDataProvider, useGameData } from "./gameState/GameDataContext";
import { GameMetaProvider, useGameMeta } from "./gameState/GameMetaContext";
import { GameUIProvider, useGameUI, PendingAction } from "./gameState/GameUIContext";
import { ReplayProvider, useReplay } from "./gameState/ReplayContext";
import { GameActionsProvider, useGameActions } from "./gameState/GameActionsContext";
import { GameEventsProvider } from "./gameState/GameEventsContext";
import { IDLE_CONNECTION, type ConnectionState } from "./gameState/connection";
import { RECONNECT_MAX_ATTEMPTS, reconnectDelayMs } from "../utils/reconnectBackoff";

// Feature toggle for REST fallback (debug only - disabled by default per Commandment 7)
const ENABLE_REST_FALLBACK = false;
const AVATAR_SYNC_DEBUG =
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    ["1", "true"].includes((process.env.VITE_DEBUG_AVATAR_SYNC || "").toLowerCase());

/**
 * GameStateProvider — owns the WebSocket and the underlying state.
 *
 * Internally splits its state across five slice contexts (data, meta, UI,
 * replay, actions). Components that need only one slice should consume the
 * dedicated hook (useGameData, useGameMeta, useGameUI, useReplay,
 * useGameActions) to avoid re-rendering on unrelated updates.
 *
 * The legacy useGameStateContext() hook below aggregates all five slices
 * and preserves the original shape, so existing consumers keep working
 * without changes during the gradual migration.
 */

export interface GameStateContextType {
    gameState: TexasHoldemStateDTO | undefined;
    gameFormat: GameFormat | undefined;
    gameVariant: GameVariant | undefined;
    /** Optional ENS-style table name (poker-vm#337); undefined for unnamed tables. Display-only (rendered track). */
    gameName: string | undefined;
    isLoading: boolean;
    error: Error | null;
    validationError: ValidationError | null;
    pendingAction: PendingAction | null;
    /** Freshness of the live socket (ui#613). Only `live` means the table is current. */
    connection: ConnectionState;
    isReplayMode: boolean;
    replayHandNumber: number | null;
    replayActionIndex: number | null;
    subscribeToTable: (tableId: string) => void;
    unsubscribeFromTable: () => void;
    sendAction: (action: string, amount?: string) => Promise<void>;
    loadHistoricalState: (tableId: string, handNumber: number, actionIndex: number) => Promise<void>;
}

interface GameStateProviderProps {
    children: React.ReactNode;
}

export const GameStateProvider: React.FC<GameStateProviderProps> = ({ children }) => {
    const [gameState, setGameState] = useState<TexasHoldemStateDTO | undefined>(undefined);
    const [gameFormat, setGameFormat] = useState<GameFormat | undefined>(undefined);
    const [gameVariant, setGameVariant] = useState<GameVariant | undefined>(undefined);
    // Table name is display-only, so it lives on the RENDER track alongside
    // format/variant — never read for submission decisions (logical track).
    const [gameName, setGameName] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [validationError, setValidationError] = useState<ValidationError | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
    const [replayHandNumber, setReplayHandNumber] = useState<number | null>(null);
    const [replayActionIndex, setReplayActionIndex] = useState<number | null>(null);
    // Latest committed bus item — drives GameEventsContext / useGameEvents.
    const [latestStreamItem, setLatestStreamItem] = useState<GameStreamItem | null>(null);
    const { currentNetwork } = useNetwork();

    // Use ref instead of state for currentTableId to prevent re-renders
    const currentTableIdRef = useRef<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const hasReceivedMessageRef = useRef<boolean>(false);
    const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Connection lifecycle (ui#613). `connection` is what the UI and the
    // submission gate read; the refs are the socket's bookkeeping.
    const [connection, setConnection] = useState<ConnectionState>(IDLE_CONNECTION);
    /** Generation of the live socket: handlers of a superseded socket are ignored. */
    const socketGenRef = useRef(0);
    /** Set right before an intentional close (unsubscribe / re-subscribe / replay) so its onclose does not reconnect. */
    const intentionalCloseRef = useRef(false);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isReplayModeRef = useRef(false);

    // WS Action Bus. Created eagerly in render so it exists before any child
    // effect calls subscribeToTable. The logical track (setLatestGameState) is
    // fed by the bus at ingest time; committed items drive the RENDER track via
    // applyRenderTrack below.
    const busRef = useRef<GameMessageBus | null>(null);
    if (busRef.current === null) {
        busRef.current = new GameMessageBus({ setLatestGameState });
    }

    // Stable bridge from the render layer to the bus's animation-ack API (Phase 5).
    // Exposed via GameEventsContext so animating hooks can report choreography
    // completion without reaching into the bus directly.
    const ackAnimation = useCallback((ackId: string) => {
        busRef.current?.ackAnimation(ackId);
    }, []);

    // Apply a classified message to the RENDER track (React state). Contains no
    // setLatestGameState calls — the logical track is updated by the bus at
    // ingest. setState dispatchers are stable, so this callback never changes
    // identity.
    const applyRenderTrack = useCallback((classified: ClassifiedMessage, rawMessage?: { gameId?: string; event?: string }) => {
        switch (classified.kind) {
            case "state": {
                if (AVATAR_SYNC_DEBUG) {
                    const playersWithAvatars = classified.snapshot.players
                        .filter(player => Boolean(player.avatar))
                        .map(player => ({ seat: player.seat, address: player.address, avatar: player.avatar }));

                    if (hasElements(playersWithAvatars)) {
                        console.info("[ProfileAvatarDebug] Incoming websocket avatars", {
                            gameId: rawMessage?.gameId,
                            event: rawMessage?.event,
                            playersWithAvatars
                        });
                    }
                }

                setGameState(classified.snapshot);
                setGameFormat(classified.format);
                setGameVariant(classified.variant);
                setGameName(classified.name);
                setPendingAction(null);

                if (classified.validationError) {
                    // Per Commandment 7: NO defaults. Surface the validation
                    // error but still render what we can.
                    setValidationError(classified.validationError);
                } else {
                    setError(null);
                    setValidationError(null);
                }
                break;
            }
            case "validationErrorNoState": {
                setValidationError(classified.validationError);
                break;
            }
            case "pending": {
                setPendingAction(classified.pendingAction);
                break;
            }
            case "actionAccepted": {
                // Acknowledgment that our action was accepted — no state change.
                break;
            }
            case "error": {
                setError(classified.error);
                setIsLoading(false);
                setPendingAction(null);
                if (classified.clearGameState) {
                    setGameState(undefined);
                }
                break;
            }
            case "ignore":
            default:
                break;
        }
    }, []);

    // Bus lifecycle: subscribe the render track to committed items and expose
    // the dev-only introspection handle (§5.4). Stripped from prod builds.
    useEffect(() => {
        const bus = busRef.current;
        if (!bus) {
            return;
        }
        const unsubscribe = bus.subscribe(item => {
            applyRenderTrack(item.classified, item.raw as { gameId?: string; event?: string });
            // Expose the committed item (with its derived events) to React.
            setLatestStreamItem(item);
        });
        if (!viteEnv.PROD) {
            window.__B52_BUS__ = bus.introspection;
        }
        return () => {
            unsubscribe();
            if (!viteEnv.PROD && window.__B52_BUS__ === bus.introspection) {
                delete window.__B52_BUS__;
            }
        };
    }, [applyRenderTrack]);

    /** Close the live socket and cancel every pending timer. `intentional` keeps its onclose from reconnecting. */
    const closeSocket = useCallback((intentional: boolean) => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = null;
        }
        if (wsRef.current) {
            intentionalCloseRef.current = intentional;
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    // Reconnect scheduling lives behind a ref so the socket handlers (created
    // once per socket) always call the latest version.
    const scheduleReconnectRef = useRef<(tableId: string) => void>(() => {});

    /**
     * Open the socket for `tableId`. `attempt` is 0 for a fresh subscription and
     * n ≥ 1 for the n-th reconnect (ui#613). Every handler checks the socket's
     * generation, so a late message, close or error from a superseded socket can
     * never touch state after a newer one opened.
     */
    const openSocket = useCallback(
        (tableId: string, attempt: number) => {
            closeSocket(true);
            const gen = ++socketGenRef.current;
            intentionalCloseRef.current = false;
            const isCurrent = () => socketGenRef.current === gen && currentTableIdRef.current === tableId;

            currentTableIdRef.current = tableId;
            isReplayModeRef.current = false;
            hasReceivedMessageRef.current = false;
            setConnection(attempt === 0 ? { status: "connecting", attempt: 0 } : { status: "reconnecting", attempt });

            // A (re)subscribe re-snapshots authoritatively: the relay answers a
            // subscribe with the full current state. Drop any queued frames and
            // the event baseline so the catch-up frame renders as a fresh baseline
            // (no burst of sounds/badges for actions we missed) — the late-mount
            // path. seq continues monotonically (never reused).
            busRef.current?.reset();
            setLatestStreamItem(null);

            // Get Cosmos player address
            const playerAddress = localStorage.getItem(STORAGE_KEYS.cosmosAddress);

            if (!playerAddress) {
                setError(new Error("No Block52 wallet address found. Please connect your wallet."));
                setIsLoading(false);
                setConnection(IDLE_CONNECTION);
                return;
            }

            // Validate that the network has a ws property
            if (!currentNetwork.ws) {
                console.error("[GameStateContext] Network missing WebSocket endpoint");
                setError(new Error("Network configuration missing WebSocket endpoint"));
                setIsLoading(false);
                setConnection(IDLE_CONNECTION);
                return;
            }

            // Create WebSocket connection to the node WS endpoint.
            const fullWsUrl = `${currentNetwork.ws}?tableAddress=${tableId}&playerId=${playerAddress}`;
            const ws = new WebSocket(fullWsUrl);
            wsRef.current = ws;

            ws.onopen = async () => {
                if (!isCurrent()) return;
                // Create authenticated subscription message with signature
                const authPayload = await createAuthPayload();
                if (!isCurrent() || ws.readyState !== WebSocket.OPEN) return;

                const subscriptionMessage = {
                    type: "subscribe",
                    gameId: tableId,
                    playerAddress: authPayload?.playerAddress || playerAddress,
                    timestamp: authPayload?.timestamp,
                    signature: authPayload?.signature
                };

                ws.send(JSON.stringify(subscriptionMessage));
                setIsLoading(false);

                // No frame within 5 s: on a fresh subscription that is the "server
                // not responding" error (Commandment 7: surface it); on a reconnect
                // it is a failed attempt, so close and let the backoff schedule
                // the next one.
                fallbackTimeoutRef.current = setTimeout(() => {
                    fallbackTimeoutRef.current = null;
                    if (!isCurrent() || hasReceivedMessageRef.current) return;
                    if (attempt === 0) {
                        console.error("[GameStateContext] WebSocket server did not respond within 5 seconds");
                        setError(new Error(
                            "WebSocket server not responding. The game server may be offline or not broadcasting game state. " +
                            "Please try refreshing or contact support if the issue persists."
                        ));
                        setIsLoading(false);
                    } else {
                        console.warn(`[GameStateContext] reconnect attempt ${attempt}: no state within 5 s; retrying`);
                        ws.close(); // not intentional → onclose schedules the next attempt
                    }
                }, 5000);
            };

            ws.onmessage = event => {
                if (!isCurrent()) return; // a superseded socket's late frame

                // One JSON document per frame is the relay's contract
                // (block52/pokerchain#364). parseFrame also tolerates a
                // newline-batched frame, so a relay regression degrades to "every
                // document still ingested" rather than "the whole batch dropped".
                const { messages, failures } = parseFrame(String(event.data));

                // Any bytes from the relay prove it is alive — the "server not
                // responding" fallback must not fire because a frame was malformed,
                // and the first bytes after a (re)open make the connection live.
                if (!hasReceivedMessageRef.current) {
                    hasReceivedMessageRef.current = true;
                    reconnectAttemptRef.current = 0;
                    setConnection({ status: "live", attempt: 0 });
                }

                if (failures > 0) {
                    // Surface it (Commandment 7) without blanking the table: a bad
                    // document is a relay/transport bug to count and log, not a
                    // reason to replace a live hand with an error page (ui#623).
                    console.error(
                        `[GameStateContext] Dropped ${failures} unparseable WebSocket document(s):`,
                        String(event.data).slice(0, 160)
                    );
                    busRef.current?.recordParseFailure(failures);
                }

                if (!hasElements(messages)) {
                    return;
                }

                // WS Action Bus. The bus classifies each message, updates the
                // logical track at ingest, and drives the render track through
                // committed items (applyRenderTrack, wired via subscribe).
                for (const message of messages) {
                    busRef.current?.ingest(message, tableId);
                }
            };

            ws.onclose = () => {
                if (socketGenRef.current !== gen) return; // superseded: a newer socket owns the state
                wsRef.current = null;
                const intentional = intentionalCloseRef.current;
                intentionalCloseRef.current = false;
                if (intentional || currentTableIdRef.current !== tableId) return;
                scheduleReconnectRef.current(tableId);
            };

            ws.onerror = () => {
                if (!isCurrent()) return;
                // The close event follows and drives the reconnect. A page-level
                // error here would replace a live table with an error page for a
                // transient blip (ui#613) — log, and let the banner say "reconnecting".
                console.warn(`[GameStateContext] WebSocket error on table ${tableId}${attempt > 0 ? ` (reconnect attempt ${attempt})` : ""}`);
            };
        },
        [currentNetwork, closeSocket]
    );

    /**
     * Bounded reconnect with exponential backoff and jitter (ui#613). Attempts
     * reset when a frame arrives, on a fresh subscribe, and on a wake (tab
     * visible / browser online). While the browser reports no network, wait for
     * the `online` event instead of burning attempts.
     */
    const scheduleReconnect = useCallback(
        (tableId: string) => {
            if (typeof navigator !== "undefined" && navigator.onLine === false) {
                console.warn(`[GameStateContext] connection to ${tableId} dropped while offline; waiting for the network`);
                setConnection({ status: "offline", attempt: reconnectAttemptRef.current });
                return;
            }
            const attempt = reconnectAttemptRef.current + 1;
            if (attempt > RECONNECT_MAX_ATTEMPTS) {
                console.error(`[GameStateContext] gave up reconnecting to ${tableId} after ${RECONNECT_MAX_ATTEMPTS} attempts`);
                setConnection({ status: "offline", attempt: RECONNECT_MAX_ATTEMPTS });
                setError(new Error(
                    `Connection to the table was lost and could not be restored after ${RECONNECT_MAX_ATTEMPTS} attempts. ` +
                    "Check your network, then retry."
                ));
                setIsLoading(false);
                return;
            }
            reconnectAttemptRef.current = attempt;
            const delay = reconnectDelayMs(attempt);
            console.warn(`[GameStateContext] connection to ${tableId} dropped; reconnecting in ${delay} ms (attempt ${attempt}/${RECONNECT_MAX_ATTEMPTS})`);
            setConnection({ status: "reconnecting", attempt });
            reconnectTimerRef.current = setTimeout(() => {
                reconnectTimerRef.current = null;
                if (currentTableIdRef.current !== tableId || isReplayModeRef.current) return;
                openSocket(tableId, attempt);
            }, delay);
        },
        [openSocket]
    );
    scheduleReconnectRef.current = scheduleReconnect;

    const subscribeToTable = useCallback(
        (tableId: string) => {
            // Enhanced duplicate check to prevent re-subscription loops
            if (currentTableIdRef.current === tableId && wsRef.current?.readyState === WebSocket.OPEN) {
                return;
            }

            // Prevent rapid re-connection attempts
            if (wsRef.current?.readyState === WebSocket.CONNECTING) {
                return;
            }

            setIsLoading(true);
            setError(null);
            setValidationError(null);
            reconnectAttemptRef.current = 0;
            openSocket(tableId, 0);
        },
        [openSocket]
    );

    // Wake-ups (ui#613): a tab coming back from the background (mobile
    // browsers drop sockets there, often without a prompt onclose) or the
    // browser coming back online reconnects immediately with a fresh attempt
    // count; going offline is surfaced without burning attempts.
    useEffect(() => {
        const wake = (reason: string) => {
            const tableId = currentTableIdRef.current;
            if (!tableId || isReplayModeRef.current) return;
            const state = wsRef.current?.readyState;
            if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
            console.warn(`[GameStateContext] ${reason}: socket not open; reconnecting now`);
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            reconnectAttemptRef.current = 1;
            openSocket(tableId, 1);
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") wake("tab visible");
        };
        const onOnline = () => wake("browser online");
        const onOffline = () => {
            setConnection(prev => (prev.status === "idle" ? prev : { status: "offline", attempt: prev.attempt }));
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, [openSocket]);

    const unsubscribeFromTable = useCallback(() => {
        // An intentional close: no reconnect, no timers left behind.
        closeSocket(true);
        reconnectAttemptRef.current = 0;
        setConnection(IDLE_CONNECTION);

        currentTableIdRef.current = null;
        hasReceivedMessageRef.current = false;
        busRef.current?.reset();
        setLatestStreamItem(null);
        setGameState(undefined);
        setLatestGameState(undefined, { optimistic: false });
        setGameFormat(undefined);
        setGameVariant(undefined);
        setGameName(undefined);
        setIsLoading(false);
        setError(null);
        setValidationError(null);
        setPendingAction(null);
    }, [closeSocket]);

    // Send action through WebSocket for immediate broadcast
    const sendAction = useCallback(
        async (action: string, amount?: string): Promise<void> => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                throw new Error("WebSocket not connected");
            }

            if (!currentTableIdRef.current) {
                throw new Error("Not subscribed to a table");
            }

            // Get Cosmos player address
            const playerAddress = localStorage.getItem(STORAGE_KEYS.cosmosAddress);

            if (!playerAddress) {
                throw new Error("No Block52 wallet address found. Please connect your wallet.");
            }

            const actionMessage = {
                type: "action",
                gameId: currentTableIdRef.current,
                playerAddress: playerAddress,
                action: action,
                amount: amount
            };

            wsRef.current.send(JSON.stringify(actionMessage));
        },
        []
    );

    // Load point-in-time snapshot from chain (replay mode for readonly share links).
    // Uses pokerchain#160 GameStateAt RPC: previousActions is truncated to actions at
    // or before actionIndex, hole cards and deck are masked (public view).
    const loadHistoricalState = useCallback(
        async (tableId: string, handNumber: number, actionIndex: number): Promise<void> => {
            // Clean up any existing WebSocket connection — replay mode is a one-shot
            // fetch, so this close must not reconnect (ui#613).
            closeSocket(true);
            isReplayModeRef.current = true;
            reconnectAttemptRef.current = 0;
            setConnection(IDLE_CONNECTION);

            // Replay bypasses the bus entirely; drop any queued live frames and
            // any derived-event state (replay has no pacing/event semantics).
            busRef.current?.reset();
            setLatestStreamItem(null);

            setIsLoading(true);
            setError(null);
            setValidationError(null);
            setIsReplayMode(true);
            setReplayHandNumber(handNumber);
            setReplayActionIndex(actionIndex);
            currentTableIdRef.current = tableId;

            try {
                const cosmosApi = new CosmosApi({ baseUrl: currentNetwork.rest!, secure: false, timeout: 10000 });
                const response = await cosmosApi.getGameStateAt(tableId, handNumber, actionIndex) as { game_state?: string };

                if (!response || !response.game_state) {
                    throw new Error(`No game state found for hand ${handNumber} at action ${actionIndex}`);
                }

                const parsed = JSON.parse(response.game_state);

                // Chain may return a GameStateResponseDTO (with gameState nested)
                // or TexasHoldemStateDTO directly.
                const gameStateData = parsed.gameState || parsed;
                const rawFormat = parsed.format;
                const rawVariant = parsed.variant;

                setGameState(gameStateData as TexasHoldemStateDTO);
                setGameFormat(toGameFormat(rawFormat));
                setGameVariant(toGameVariant(rawVariant));
                setGameName(parsed.name);
                setPendingAction(null);
            } catch (err) {
                console.error("[GameStateContext] Failed to load historical state:", err);
                setError(err instanceof Error ? err : new Error("Failed to load historical state"));
            } finally {
                setIsLoading(false);
            }
        },
        [currentNetwork]
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
            }
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
            if (wsRef.current) {
                intentionalCloseRef.current = true;
                wsRef.current.close();
            }
        };
    }, []);

    return (
        <GameActionsProvider
            subscribeToTable={subscribeToTable}
            unsubscribeFromTable={unsubscribeFromTable}
            sendAction={sendAction}
            loadHistoricalState={loadHistoricalState}
        >
            <GameMetaProvider gameFormat={gameFormat} gameVariant={gameVariant} gameName={gameName}>
                <ReplayProvider
                    isReplayMode={isReplayMode}
                    replayHandNumber={replayHandNumber}
                    replayActionIndex={replayActionIndex}
                >
                    <GameUIProvider
                        isLoading={isLoading}
                        error={error}
                        validationError={validationError}
                        pendingAction={pendingAction}
                        connection={connection}
                    >
                        <GameEventsProvider latestItem={latestStreamItem} ackAnimation={ackAnimation}>
                            <GameDataProvider gameState={gameState}>{children}</GameDataProvider>
                        </GameEventsProvider>
                    </GameUIProvider>
                </ReplayProvider>
            </GameMetaProvider>
        </GameActionsProvider>
    );
};

/**
 * Legacy aggregator hook. Returns the same shape as the old monolithic context.
 *
 * Prefer the granular hooks (useGameData, useGameMeta, useGameUI, useReplay,
 * useGameActions) in new code so consumers only re-render on the slice they
 * actually depend on.
 */
export const useGameStateContext = (): GameStateContextType => {
    const { gameState } = useGameData();
    const { gameFormat, gameVariant, gameName } = useGameMeta();
    const { isLoading, error, validationError, pendingAction, connection } = useGameUI();
    const { isReplayMode, replayHandNumber, replayActionIndex } = useReplay();
    const { subscribeToTable, unsubscribeFromTable, sendAction, loadHistoricalState } = useGameActions();

    return useMemo(
        () => ({
            gameState,
            gameFormat,
            gameVariant,
            gameName,
            isLoading,
            error,
            validationError,
            pendingAction,
            connection,
            isReplayMode,
            replayHandNumber,
            replayActionIndex,
            subscribeToTable,
            unsubscribeFromTable,
            sendAction,
            loadHistoricalState
        }),
        [
            gameState,
            gameFormat,
            gameVariant,
            gameName,
            isLoading,
            error,
            validationError,
            pendingAction,
            connection,
            isReplayMode,
            replayHandNumber,
            replayActionIndex,
            subscribeToTable,
            unsubscribeFromTable,
            sendAction,
            loadHistoricalState
        ]
    );
};
