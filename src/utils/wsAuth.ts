/**
 * Keeping an open table socket's signed credentials valid (ui#953).
 *
 * A socket signs `pokerchain-query:<timestamp>` when it subscribes and the relay
 * reuses that signature for every update. The chain refuses a timestamp more than
 * an hour from block time, and the relay then falls back to the public state with
 * every hole card masked, telling no one. So a player an hour into a session sees
 * their own cards face down until something re-signs.
 *
 * Everything here is a pure function of a snapshot and the clock, so it can be
 * tested without React. GameStateContext owns the socket and does the sending.
 */
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { isMaskedHand } from "../bus/deriveEvents";
import { isNullish } from "./guards";

/**
 * How old a signature may get before it is renewed. Half the chain's one-hour
 * window, so a device clock up to 30 minutes off still renews in time.
 */
export const AUTH_RENEWAL_INTERVAL_MS = 30 * 60 * 1000;

/**
 * How often the age is checked. Short and measured against the wall clock rather
 * than one long timer, so a sleeping laptop or a throttled tab renews soon after
 * it wakes.
 */
export const AUTH_RENEWAL_CHECK_MS = 60 * 1000;

/**
 * The least time between signatures while our own cards keep arriving masked. A
 * device clock over an hour off is refused however often it signs, and this keeps
 * that case to one query a minute.
 */
export const AUTH_MASKED_RETRY_MS = 60 * 1000;

/**
 * Whether the viewer's own hand arrived masked. The chain never masks the player
 * who signed the query, so this means the frame came from the relay's public
 * fallback: the authenticated query failed.
 */
export const isOwnHandMasked = (gameState: TexasHoldemStateDTO | null | undefined, address: string | null | undefined): boolean => {
    if (isNullish(address)) {
        return false;
    }
    const me = gameState?.players?.find(player => player.address?.toLowerCase() === address.toLowerCase());
    return isMaskedHand(me?.holeCards);
};

/** Whether to sign again now: the signature is old, or our cards say it has already failed. */
export const isAuthRenewalDue = (args: { nowMs: number; signedAtMs: number; ownHandMasked: boolean }): boolean => {
    const age = args.nowMs - args.signedAtMs;
    return age >= AUTH_RENEWAL_INTERVAL_MS || (args.ownHandMasked && age >= AUTH_MASKED_RETRY_MS);
};
