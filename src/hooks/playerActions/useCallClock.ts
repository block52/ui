import { useCallback, useEffect, useRef, useState } from "react";
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { SubmitActionRequest, SubmitError } from "../../submit/types";
import { callClock } from "./callClock";
import { getCallClockEnabled } from "../../utils/urlParams";
import { isNullish } from "../../utils/guards";
import { AUTO_ACTION_DELAY_MS } from "./useLatchedDelay";
import { MAX_AUTO_REARMS, shouldRearmAfterFailure } from "./autoActionRearm";

/**
 * Hook that calls the clock on a stalled opponent (ui#819).
 *
 * `useAutoFold` folds the LOCAL player when their own clock runs out. It
 * cannot help when the player to act has lost their connection: nobody submits
 * their fold and the table waits on them for ever. This hook is the observer's
 * side of that clock: once `dueAtMs` passes it submits the chain's `timeout`
 * action, which the engine verifies against the committed deadline before
 * playing the stalled player's forced default for them.
 *
 * `dueAtMs` is computed by the caller from the table state
 * (`clockCallDueAtMs` in `utils/turnClock.ts`): the deadline, plus the chain's
 * inclusion grace, plus this client's place in the line of observers. `null`
 * means "not me, or nothing to call" and disarms the hook. A new turn moves the
 * due time, which is what re-arms it.
 *
 * Can be disabled via the Call the Clock setting or `?callclock=false`. The
 * `enabled` parameter, when provided, overrides the URL query param.
 *
 * It fires at most once per due time, submits through the shared
 * ActionSubmitController (ui#635) so this account keeps one outbound queue, and
 * stands down while that queue is busy (the player's own action comes first; the
 * timeout re-arms when the queue clears). After a failure that proves nothing was
 * sent it re-arms once (ui#655); a rejection by the chain — the turn had not
 * expired after all, or had already moved on — is reported, not retried: the next
 * observer in line follows a few seconds later anyway.
 *
 * @param tableId - The table/game ID
 * @param network - The network configuration
 * @param dueAtMs - When this client should call the clock (epoch ms), or null
 * @param submit - The ActionSubmitController's submit (from useActionSubmit)
 * @param isBusy - Whether the controller has a submission in flight
 * @param onCalled - Optional callback with the tx hash once broadcast
 * @param enabled - Optional override for the URL param setting (reactive)
 */
export function useCallClock(
    tableId: string,
    network: NetworkEndpoints,
    dueAtMs: number | null,
    submit: (request: SubmitActionRequest) => void,
    isBusy: boolean,
    onCalled?: (txHash: string) => void,
    enabled?: boolean
): void {
    const urlDefaultRef = useRef<boolean>(getCallClockEnabled());
    const isEnabled = isNullish(enabled) ? urlDefaultRef.current : enabled;

    // The due time we have already called for: once per opportunity.
    const calledForRef = useRef<number | null>(null);
    // ui#655: re-arms spent on the current opportunity, and the tick that makes
    // a re-arm re-run the effect below (a ref alone would not).
    const rearmCountRef = useRef<number>(0);
    const [rearmToken, setRearmToken] = useState<number>(0);

    // Read at fire time through a ref: the caller passes fresh closures on every
    // render, and re-scheduling the timer on each of them would never let it
    // elapse (the ui#605 lesson, see useLatchedDelay).
    const latestRef = useRef({ submit, network, onCalled });
    useEffect(() => {
        latestRef.current = { submit, network, onCalled };
    });

    const rearmAfterFailure = useCallback((error: SubmitError) => {
        if (!shouldRearmAfterFailure(error) || rearmCountRef.current >= MAX_AUTO_REARMS) {
            return;
        }
        rearmCountRef.current += 1;
        calledForRef.current = null;
        setRearmToken(token => token + 1);
    }, []);

    useEffect(() => {
        if (!isEnabled || !tableId || isBusy || dueAtMs === null) {
            return;
        }
        if (calledForRef.current === dueAtMs) {
            return;
        }
        if (calledForRef.current !== null) {
            // A new opportunity: the re-arm budget starts over.
            rearmCountRef.current = 0;
        }

        // One timer to the due time (plus the usual settle, so we never act on a
        // half-applied state), instead of a once-a-second re-render for every
        // observer at the table.
        const wait = Math.max(0, dueAtMs - Date.now()) + AUTO_ACTION_DELAY_MS;
        const timeoutId = setTimeout(() => {
            if (calledForRef.current === dueAtMs) {
                return;
            }
            calledForRef.current = dueAtMs;
            const { submit: submitNow, network: networkNow, onCalled: onCalledNow } = latestRef.current;
            submitNow({
                actionName: NonPlayerActionType.TIMEOUT,
                run: () => callClock(tableId, networkNow),
                onSuccess: hash => onCalledNow?.(hash),
                onFailure: rearmAfterFailure
            });
        }, wait);
        return () => clearTimeout(timeoutId);
    }, [isEnabled, tableId, isBusy, dueAtMs, rearmToken, rearmAfterFailure]);
}
