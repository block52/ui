/**
 * Spectator mode (ui#916): a human watching an AI-vs-AI table read-only.
 *
 * Spectating is to the LIVE table what replay is to a HISTORICAL hand: no wallet,
 * no action controls, no table modals — but still subscribed to the live socket.
 * It is entered via the dedicated `/watch/:id` route so the `/table/:id` play
 * flow is untouched.
 */

/** Route prefix that puts the table into read-only spectator mode. */
export const WATCH_PATH_PREFIX = "/watch/";

/**
 * True when the given router pathname is a spectator (`/watch/:id`) route.
 * Pure so it can be unit-tested without a router.
 */
export const isSpectatorPath = (pathname: string): boolean => pathname.startsWith(WATCH_PATH_PREFIX);

/**
 * Build the spectator URL for a table id. The id is encoded so table addresses
 * with URL-sensitive characters round-trip.
 */
export const buildWatchUrl = (origin: string, tableId: string): string => `${origin}${WATCH_PATH_PREFIX}${encodeURIComponent(tableId)}`;
