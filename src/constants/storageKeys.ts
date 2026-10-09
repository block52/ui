/**
 * Centralized localStorage / sessionStorage keys.
 *
 * Single source of truth for browser-storage key strings. Never inline these
 * literals — import `STORAGE_KEYS` so a key rename is a one-line change and
 * typos become compile errors rather than silent cache misses.
 */
export const STORAGE_KEYS = {
    /** Cosmos (b52...) address of the active wallet. */
    cosmosAddress: "user_cosmos_address",
    /** Ethereum private key of the active wallet. */
    ethPrivateKey: "user_eth_private_key",
    /** Last buy-in amount entered, prefilled into the buy-in/auto-join modals. */
    buyInAmount: "buy_in_amount",
    /** Whether the player chose to wait for the big blind when sitting in. */
    waitForBigBlind: "wait_for_big_blind",
    /** Currently selected network (serialized NetworkConfig). */
    selectedNetwork: "selectedNetwork",
    /** Bridge admin dashboard sort order. */
    bridgeSortOrder: "bridge_sort_order",
    /** Bridge admin dashboard page size. */
    bridgeItemsPerPage: "bridge_items_per_page",
    /** Payments-proxy admin key on the Bridge Admin page. sessionStorage only: forgotten when the tab closes. */
    bridgeAdminKey: "bridge_admin_key",
    /** Bearer token injected by HTTPClient on secure requests. */
    authToken: "token",
    /** Whether the viewer has dismissed the upcoming Sit & Go welcome modal. */
    seenUpcomingSngModal: "seen_upcoming_sng_modal"
} as const;
