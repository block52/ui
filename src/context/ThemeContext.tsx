import { createContext, FC, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { DEFAULT_THEME, parseStoredTheme, resolveTheme, Theme, THEME_STORAGE_KEY } from "../utils/theme";

interface ThemeContextValue {
    /** The theme being rendered right now (dark on game tables whatever the preference). */
    theme: Theme;
    /** The user's saved choice. */
    preference: Theme;
    setPreference: (preference: Theme) => void;
    toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>(null as unknown as ThemeContextValue);

const readStoredPreference = (): Theme => {
    try {
        return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY)) ?? DEFAULT_THEME;
    } catch (err) {
        console.error("Failed to read saved theme:", err);
        return DEFAULT_THEME;
    }
};

export const ThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const { pathname } = useLocation();
    const [preference, setPreferenceState] = useState<Theme>(readStoredPreference);
    const theme = resolveTheme(preference, pathname);

    // Apply the rendered theme to <html>: CSS variables switch on data-theme and
    // color-scheme restyles native controls and scrollbars.
    useEffect(() => {
        const root = document.documentElement;
        root.dataset.theme = theme;
        root.style.colorScheme = theme;
    }, [theme]);

    const setPreference = useCallback((next: Theme) => {
        setPreferenceState(next);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch (err) {
            console.error("Failed to save theme:", err);
        }
    }, []);

    const toggle = useCallback(() => setPreference(preference === "dark" ? "light" : "dark"), [preference, setPreference]);

    const value = useMemo(() => ({ theme, preference, setPreference, toggle }), [theme, preference, setPreference, toggle]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);
