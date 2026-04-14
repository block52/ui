/**
 * Hook that detects mobile portrait orientation on the table page.
 * Returns isPortraitBlocked = true when mobile device is in portrait.
 */

import { useState, useEffect, useCallback } from "react";

function isMobile(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (ua) return true;
    if (typeof window !== "undefined") {
        return Math.min(window.innerWidth, window.innerHeight) <= 500;
    }
    return false;
}

function isPortrait(): boolean {
    if (typeof window === "undefined") return false;
    return window.innerHeight > window.innerWidth;
}

export const useMobileFullscreen = () => {
    const [isPortraitBlocked, setIsPortraitBlocked] = useState(isMobile() && isPortrait());

    const check = useCallback(() => {
        setIsPortraitBlocked(isMobile() && isPortrait());
    }, []);

    useEffect(() => {
        const handle = () => setTimeout(check, 100);

        window.addEventListener("resize", handle);
        window.addEventListener("orientationchange", handle);

        return () => {
            window.removeEventListener("resize", handle);
            window.removeEventListener("orientationchange", handle);
        };
    }, [check]);

    return { isPortraitBlocked };
};
