/**
 * Connection freshness of the live game-state socket (ui#613).
 *
 *   idle          no live subscription (nothing open, or replay mode)
 *   connecting    a fresh subscription is opening; no state frame yet
 *   live          the socket is open and a state frame has arrived since it opened
 *   reconnecting  the socket dropped; a bounded, backed-off reconnect is in progress
 *   offline       the browser reports no network, or every reconnect attempt failed
 *
 * Only `live` means the table on screen is current. Everything that submits an
 * action gates on it (ActionSubmitController), and the table shows a banner for
 * anything else — the worst outcome is not the disconnect, it is acting on a
 * stale view without knowing.
 */
export type ConnectionStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

export interface ConnectionState {
    status: ConnectionStatus;
    /** Reconnect attempt in progress (1-based); 0 when not reconnecting. */
    attempt: number;
}

export const IDLE_CONNECTION: ConnectionState = { status: "idle", attempt: 0 };

export function isConnectionLive(connection: ConnectionState): boolean {
    return connection.status === "live";
}
