/**
 * URL Parameter Utilities
 *
 * Utilities for parsing query string parameters from the URL.
 */

/**
 * Check if auto-deal is enabled via query string parameter.
 *
 * Auto-deal is ENABLED by default. It can only be disabled by explicitly
 * setting ?autodeal=false in the URL.
 *
 * @returns true if auto-deal is enabled, false if explicitly disabled
 *
 * @example
 * // URL: /table/123 -> returns true (default)
 * // URL: /table/123?autodeal=true -> returns true
 * // URL: /table/123?autodeal=false -> returns false
 */
export const getAutoDealEnabled = (): boolean => {
    const params = new URLSearchParams(window.location.search);
    const autodeal = params.get("autodeal");
    // Default to true if param is missing or any value other than "false"
    return autodeal !== "false";
};

/**
 * Check if auto-post blinds is enabled via query string parameter.
 *
 * Auto-post blinds is ENABLED by default. It can only be disabled by explicitly
 * setting ?autoblinds=false in the URL.
 *
 * @returns true if auto-post blinds is enabled, false if explicitly disabled
 *
 * @example
 * // URL: /table/123 -> returns true (default)
 * // URL: /table/123?autoblinds=true -> returns true
 * // URL: /table/123?autoblinds=false -> returns false
 */
export const getAutoPostBlindsEnabled = (): boolean => {
    const params = new URLSearchParams(window.location.search);
    const autoblinds = params.get("autoblinds");
    // Default to true if param is missing or any value other than "false"
    return autoblinds !== "false";
};

/**
 * Check if auto-new-hand is enabled via query string parameter.
 *
 * Auto-new-hand is ENABLED by default. It can only be disabled by explicitly
 * setting ?autonewhand=false in the URL.
 *
 * @returns true if auto-new-hand is enabled, false if explicitly disabled
 *
 * @example
 * // URL: /table/123 -> returns true (default)
 * // URL: /table/123?autonewhand=true -> returns true
 * // URL: /table/123?autonewhand=false -> returns false
 */
export const getAutoNewHandEnabled = (): boolean => {
    const params = new URLSearchParams(window.location.search);
    const autonewhand = params.get("autonewhand");
    // Default to true if param is missing or any value other than "false"
    return autonewhand !== "false";
};

/**
 * Check if auto-fold on timeout is enabled via query string parameter.
 *
 * Auto-fold is ENABLED by default. It can only be disabled by explicitly
 * setting ?autofold=false in the URL.
 *
 * @returns true if auto-fold is enabled, false if explicitly disabled
 *
 * @example
 * // URL: /table/123 -> returns true (default)
 * // URL: /table/123?autofold=true -> returns true
 * // URL: /table/123?autofold=false -> returns false
 */
export const getAutoFoldEnabled = (): boolean => {
    const params = new URLSearchParams(window.location.search);
    const autofold = params.get("autofold");
    // Default to true if param is missing or any value other than "false"
    return autofold !== "false";
};

/**
 * Check if the manual "Deal" button should be shown via query string parameter.
 *
 * Auto-deal makes this button redundant in normal play, so it is HIDDEN by
 * default. It is only revealed by explicitly setting ?manualdeal=true. Note the
 * caller also reveals it whenever auto-deal is disabled, so a table is never
 * left with no way to deal (see #368).
 *
 * @returns true only if ?manualdeal=true is present
 *
 * @example
 * // URL: /table/123 -> returns false (default: hidden)
 * // URL: /table/123?manualdeal=true -> returns true
 */
export const getManualDealEnabled = (): boolean => {
    const params = new URLSearchParams(window.location.search);
    return params.get("manualdeal") === "true";
};

/**
 * Check if the manual "Post Small/Big Blind" buttons should be shown via query
 * string parameter.
 *
 * Auto-post-blinds makes these buttons redundant in normal play, so they are
 * HIDDEN by default. They are only revealed by explicitly setting
 * ?manualblinds=true. Note the caller also reveals them whenever auto-post
 * blinds is disabled, so a table is never left with no way to post (see #368).
 *
 * @returns true only if ?manualblinds=true is present
 *
 * @example
 * // URL: /table/123 -> returns false (default: hidden)
 * // URL: /table/123?manualblinds=true -> returns true
 */
export const getManualBlindsEnabled = (): boolean => {
    const params = new URLSearchParams(window.location.search);
    return params.get("manualblinds") === "true";
};
