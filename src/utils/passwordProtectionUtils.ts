// JWT Cookie management functions
export const setAuthCookie = (): void => {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 100); // 100 days from now
    const simpleJWT = btoa(JSON.stringify({
        authenticated: true,
        timestamp: Date.now(),
        app: "block52-poker-demo"
    }));
    document.cookie = "block52_auth=" + simpleJWT + "; expires=" + expirationDate.toUTCString() + "; path=/; SameSite=Strict";
};

export const checkAuthCookie = (): boolean => {
    const cookies = document.cookie.split(";");
    const authCookie = cookies.find(cookie => cookie.trim().startsWith("block52_auth="));

    if (authCookie) {
        try {
            const cookieValue = authCookie.split("=")[1];
            const decoded = JSON.parse(atob(cookieValue));
            if (decoded.authenticated && decoded.app === "block52-poker-demo") {
                return true;
            }
        } catch {
            // Invalid cookie, remove it
            document.cookie = "block52_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }
    }
    return false;
};

// Check if password protection is enabled via env variable
export const isPasswordProtectionEnabled = (): boolean => {
    const envPassword = import.meta.env.VITE_SITE_PASSWORD;
    return typeof envPassword === "string" && envPassword.length > 0;
};

// Password validation function
export const validatePassword = (password: string): boolean => {
    const envPassword = import.meta.env.VITE_SITE_PASSWORD;
    if (!envPassword) return false;
    return password === envPassword;
};

// Handle password submission
export const handlePasswordSubmit = (
    passwordInput: string,
    setIsAuthenticated: (value: boolean) => void,
    setPasswordError: (error: string) => void,
    setPasswordInput: (value: string) => void
): void => {
    if (validatePassword(passwordInput)) {
        setIsAuthenticated(true);
        setPasswordError("");
        setPasswordInput("");
        // Set JWT cookie for 1 week
        setAuthCookie();
    } else {
        setPasswordError("Invalid password. Please try again.");
        setPasswordInput("");
    }
};

// Handle Enter key press in password input
export const handlePasswordKeyPress = (
    e: React.KeyboardEvent,
    passwordInput: string,
    setIsAuthenticated: (value: boolean) => void,
    setPasswordError: (error: string) => void,
    setPasswordInput: (value: string) => void
): void => {
    if (e.key === "Enter") {
        handlePasswordSubmit(passwordInput, setIsAuthenticated, setPasswordError, setPasswordInput);
    }
};
