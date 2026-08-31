import { useEffect, useRef } from "react";
import { isSeatBigBlind } from "../../utils/playerSeatUtils";

/**
 * Client-side "Sit Out Next Big Blind".
 *
 * The chain does not yet implement `SIT_OUT method=next-bb` (poker-vm#1895),
 * so this hook holds the intent in the browser and fires the standard
 * `SIT_OUT method=next-hand` the moment the big blind rotates onto the
 * player's seat. The player plays out the BB hand, then sits out from the
 * following hand.
 *
 * The hook only DETECTS the BB landing and calls `onTrigger`; the parent owns
 * the actual submission. That submission MUST go through the shared
 * ActionSubmitController (`useActionSubmit().submit`) — routing it there dedupes
 * against a manual "Sit Out Next Hand" toggle and serializes it with every other
 * action, which is what prevents two sit-out broadcasts racing into an account
 * sequence mismatch (ui#567). The parent also clears its enable flag so the
 * checkbox unchecks after firing.
 *
 * Single-shot per BB landing: `hasTriggeredRef` arms again only when the BB
 * moves off the player's seat (new hand).
 */
export function useAutoSitOutNextBB(
    userSeat: number | undefined,
    bigBlindPosition: number | undefined,
    enabled: boolean,
    onTrigger: () => void
): void {
    const hasTriggeredRef = useRef<boolean>(false);

    useEffect(() => {
        const seatIsBB = isSeatBigBlind(userSeat, bigBlindPosition);

        if (enabled && seatIsBB && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            onTrigger();
            return;
        }

        if (!seatIsBB) {
            hasTriggeredRef.current = false;
        }
    }, [enabled, userSeat, bigBlindPosition, onTrigger]);
}
