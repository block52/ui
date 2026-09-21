import { useEffect, useRef } from "react";

/** Settle time before an automatic action fires, so it never acts on a half-applied state. */
export const AUTO_ACTION_DELAY_MS = 500;

/**
 * The "latch, wait, fire once" core shared by the automatic-action hooks
 * (useAutoFold, usePreCheck, useAutoShowCards, useAutoMuck).
 *
 * While `shouldArm` is true and the latch is open, it latches and starts the
 * settle timer; `fire` runs once when the timer elapses. The latch reopens when
 * `shouldReset` is true (the opportunity passed), so the next one fires again.
 *
 * Two properties every one of those hooks needs, and each used to hand-roll:
 *
 *   - `fire` is read through a ref. A caller passing a fresh closure on every
 *     render (PokerActionPanel does) can neither restart nor cancel the timer.
 *     Hand-rolled, that was ui#605: the effect re-ran each render, its cleanup
 *     cancelled the pending submit, the latch stayed shut, and the action
 *     silently never happened.
 *   - A timer cancelled BEFORE it fired reopens the latch. If `shouldArm` drops
 *     and comes back inside the settle window (the submit queue went busy and
 *     then idle), the hook re-arms instead of staying wedged.
 *
 * `fire` returns false to say "I did not act after all" (conditions changed
 * during the settle window), which also reopens the latch.
 */
export function useLatchedDelay(shouldArm: boolean, shouldReset: boolean, fire: () => boolean, delayMs: number = AUTO_ACTION_DELAY_MS): void {
    const latchedRef = useRef<boolean>(false);
    const fireRef = useRef(fire);
    useEffect(() => {
        fireRef.current = fire;
    });

    useEffect(() => {
        if (shouldArm && !latchedRef.current) {
            latchedRef.current = true;
            let fired = false;
            const timeoutId = setTimeout(() => {
                fired = true;
                if (!fireRef.current()) {
                    latchedRef.current = false;
                }
            }, delayMs);
            return () => {
                clearTimeout(timeoutId);
                if (!fired) {
                    latchedRef.current = false;
                }
            };
        }

        if (shouldReset) {
            latchedRef.current = false;
        }
    }, [shouldArm, shouldReset, delayMs]);
}
