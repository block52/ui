/**
 * Formatting utility functions for the UI
 */
import { bech32 } from "bech32";

/**
 * Truncates a hash string to show only the beginning and end
 * @param hash - The hash string to truncate
 * @param length - Number of characters to show at each end (default: 8)
 * @returns Truncated hash string or "N/A" if empty
 * @example
 * truncateHash("abcdef1234567890", 4) // "abcd...7890"
 */
export const truncateHash = (hash: string, length: number = 8): string => {
    if (!hash) return "N/A";
    if (hash.length <= length * 2) return hash;
    return `${hash.slice(0, length)}...${hash.slice(-length)}`;
};

/**
 * Formats a timestamp as a relative time string (e.g., "5 minutes ago")
 * @param timestamp - ISO timestamp string or Date object
 * @returns Human-readable relative time string
 * @example
 * formatTimestampRelative("2024-01-01T12:00:00Z") // "2 hours ago"
 */
export const formatTimestampRelative = (timestamp: string | Date): string => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) return `${diffSecs} second${diffSecs !== 1 ? "s" : ""} ago`;

    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
};

/**
 * Formats a timestamp as a localized date/time string
 * @param timestamp - ISO timestamp string or Date object
 * @returns Localized date/time string
 * @example
 * formatTimestampAbsolute("2024-01-01T12:00:00Z") // "1/1/2024, 12:00:00 PM"
 */
export const formatTimestampAbsolute = (timestamp: string | Date): string => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleString();
};

/**
 * Formats a duration in seconds as MM:SS or HH:MM:SS
 * @param seconds - Duration in seconds
 * @returns Formatted time string
 * @example
 * formatDuration(125) // "02:05"
 * formatDuration(3665) // "01:01:05"
 */
export const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Converts a Cosmos proposer address from base64 or hex encoding to a bech32 address.
 *
 * The Cosmos REST API returns `proposer_address` as a base64-encoded 20-byte value.
 * This function decodes it and re-encodes it as a proper bech32 address.
 *
 * @param raw - The raw proposer address string (base64 or already bech32)
 * @param prefix - The bech32 human-readable prefix (default: "b52")
 * @returns The bech32-encoded address, or the original string if conversion fails
 * @example
 * formatProposerAddress("0G4/v8tw0VZLT+zn+Si5wX4rNaI=") // "b5216phrl07twrg4vj60annlj29ec9lzkddz835f8u"
 */
export const formatProposerAddress = (raw: string, prefix = "b52"): string => {
    if (!raw) return "";
    // Already a bech32 address — return as-is
    if (raw.startsWith(prefix)) return raw;
    try {
        // Attempt base64 decode → bech32
        const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
        if (bytes.length === 20) {
            const words = bech32.toWords(bytes);
            return bech32.encode(prefix, words);
        }
    } catch {
        // fall through to hex attempt
    }
    try {
        // Attempt hex decode → bech32 (some RPC nodes return uppercase hex)
        if (/^[0-9a-fA-F]{40}$/.test(raw)) {
            const bytes = Uint8Array.from(raw.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
            const words = bech32.toWords(bytes);
            return bech32.encode(prefix, words);
        }
    } catch {
        // fall through
    }
    return raw;
};
