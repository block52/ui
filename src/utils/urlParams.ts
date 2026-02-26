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
