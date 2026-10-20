/**
 * Pure formatting helpers for the table chat box (block52-chat#1). Kept separate
 * so they can be unit-tested without the component or the socket.
 */

/** A short, readable sender label from a wallet address, e.g. "b521…a9d7". */
export function senderLabel(from: string | undefined, mine: boolean): string {
    if (mine) return "You";
    if (!from) return "Player";
    const f = from.trim();
    if (f.length <= 10) return f;
    return `${f.slice(0, 5)}…${f.slice(-4)}`;
}

/** Compact relative time: "now", "3m", "2h", else a short clock time. */
export function relativeTime(ts: number, now: number = Date.now()): string {
    const secs = Math.max(0, Math.floor((now - ts) / 1000));
    if (secs < 10) return "now";
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return new Date(ts).toLocaleDateString();
}
