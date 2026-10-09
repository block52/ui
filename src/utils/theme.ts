/** The two colour themes. */
export type Theme = "light" | "dark";

/** localStorage key holding the user's saved choice. index.html reads the same key before first paint. */
export const THEME_STORAGE_KEY = "b52-theme";

/** Theme used until the user picks one. */
export const DEFAULT_THEME: Theme = "dark";

/** The saved value if it is a known theme, otherwise null (missing or corrupted storage). */
export const parseStoredTheme = (raw: string | null): Theme | null => (raw === "light" || raw === "dark" ? raw : null);

/**
 * The poker table (felt, chips, seats) is designed for a dark surround, so the
 * table page always renders dark. The legacy /table/admin page is an ordinary admin page.
 */
export const isDarkOnlyRoute = (pathname: string): boolean => pathname.startsWith("/table/") && pathname !== "/table/admin";

/** The theme to render: dark-only routes force dark, everything else follows the user's choice. */
export const resolveTheme = (preference: Theme, pathname: string): Theme => (isDarkOnlyRoute(pathname) ? "dark" : preference);
