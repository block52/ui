import React from "react";
import { RECONNECT_MAX_ATTEMPTS } from "../../utils/reconnectBackoff";
import type { ConnectionState } from "../../context/gameState/connection";

interface ConnectionBannerProps {
    connection: ConnectionState;
    /** Manual retry once the automatic attempts are exhausted. */
    onRetry: () => void;
}

/**
 * Connection-freshness banner for the live table (ui#613). Rendered only when
 * the socket is not `live`: the table underneath is the last snapshot we had,
 * and actions are disabled until a fresh one arrives — the player must know
 * that what they are looking at may be stale.
 */
export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ connection, onRetry }) => {
    if (connection.status === "live" || connection.status === "idle") {
        return null;
    }

    const isOffline = connection.status === "offline";
    const message =
        connection.status === "connecting"
            ? "Connecting to the table…"
            : connection.status === "reconnecting"
              ? `Connection lost — reconnecting (attempt ${connection.attempt} of ${RECONNECT_MAX_ATTEMPTS}). The table may be out of date; actions are paused.`
              : "You are offline. The table may be out of date; actions are paused.";

    return (
        <div
            role="status"
            aria-live="polite"
            data-testid="connection-banner"
            data-connection={connection.status}
            className="fixed top-0 left-0 right-0 z-[110] flex items-center justify-center gap-4 py-2 px-4 text-sm"
            style={{ background: isOffline ? "rgba(214, 60, 94, 0.95)" : "rgba(234, 179, 8, 0.95)", color: "#111" }}
        >
            <span>{message}</span>
            {isOffline && (
                <button type="button" onClick={onRetry} className="px-3 py-1 rounded bg-black/70 text-white hover:bg-black/90 transition-colors">
                    Retry now
                </button>
            )}
        </div>
    );
};

export default ConnectionBanner;
