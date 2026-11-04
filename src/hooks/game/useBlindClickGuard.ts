import { useEffect } from "react";
import { toast } from "react-toastify";
import { installBlindClickGuard } from "../../utils/blindClickGuard";

const BLOCKED_TOAST_ID = "blind-click-guard";

/**
 * While the table is mounted, swallow clicks that land while the screen is not
 * being painted (GPU reset / black screen), so the player can never act blind
 * (ui#838). See utils/blindClickGuard for the detection.
 */
export function useBlindClickGuard(): void {
    useEffect(() => {
        return installBlindClickGuard(window, () => {
            console.warn("[blindClickGuard] Click ignored: the screen was not updating (ui#838)");
            // Shown once the screen is back; the fixed id stops repeats stacking up.
            toast.warn("Your screen stopped updating, so that click was not sent. Check the table and try again.", {
                toastId: BLOCKED_TOAST_ID
            });
        });
    }, []);
}
