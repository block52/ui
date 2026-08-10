import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useActionAck — the phase machine behind the action-acknowledgement pill
 * (Approach A of docs/plans/2026_07_11_action_feedback_ux.md).
 *
 * The problem it solves: on a fast transport the confirming WS frame lands
 * ~150ms after a click, so the button spinner exists for roughly one frame
 * and then the whole action panel unmounts — the click feels like nothing
 * happened. This hook turns that accidental one-frame flash into a deliberate
 * three-phase micro-interaction (sending → confirmed → fade) with a minimum
 * visible duration, so the fast path can't be invisible and the slow path
 * reads as "working", not "stuck".
 *
 * It owns NO game state — only a receipt of what the player clicked, whose
 * "confirmed" flash is driven by the exact same signal that already ends the
 * dirty state (actionCount / shared next-action index / handNumber advance).
 * The panel wires begin/confirm/fail into the code paths that already exist.
 */

export type AckPhase = "sending" | "confirmed" | "failed";
export type AckVariant = "fold" | "check" | "call" | "raise";

interface AckMeta {
    /** Present-continuous verb shown while sending, e.g. "Folding". */
    sending: string;
    /** Past-tense verb shown on confirm, e.g. "Folded". */
    confirmed: string;
    /** Drives the pill's accent color; reuses the .btn-* palette. */
    variant: AckVariant;
    /** Connector inserted before the amount, e.g. " to " → "Raising to $6.00". Omit to drop the amount. */
    connector?: string;
}

/**
 * Per-action copy + accent. Actions absent from this table (deal, new-hand)
 * intentionally show no pill — begin() is a no-op for them.
 */
const ACK_META: Record<string, AckMeta> = {
    fold: { sending: "Folding", confirmed: "Folded", variant: "fold" },
    check: { sending: "Checking", confirmed: "Checked", variant: "check" },
    call: { sending: "Calling", confirmed: "Called", variant: "call", connector: " " },
    bet: { sending: "Betting", confirmed: "Bet", variant: "raise", connector: " " },
    raise: { sending: "Raising", confirmed: "Raised", variant: "raise", connector: " to " },
    "small-blind": { sending: "Posting small blind", confirmed: "Posted small blind", variant: "call" },
    "big-blind": { sending: "Posting big blind", confirmed: "Posted big blind", variant: "call" },
    muck: { sending: "Mucking", confirmed: "Mucked", variant: "fold" },
    show: { sending: "Showing cards", confirmed: "Showed cards", variant: "call" }
};

/** Minimum time the "sending" state is held so the fast path can't flash-and-vanish. */
const MIN_ACK_VISIBLE_MS = 300;
/** How long the "confirmed" receipt lingers before it fades out. */
const CONFIRMED_HOLD_MS = 600;
/** How long the "failed" receipt lingers (the error toast carries the detail). */
const FAILED_HOLD_MS = 1400;

interface AckState {
    phase: AckPhase;
    variant: AckVariant;
    sendingLabel: string;
    confirmedLabel: string;
}

export interface ActionAck {
    /** Current phase, or null when no pill should render. */
    phase: AckPhase | null;
    /** Phase-appropriate label for the pill (empty when idle). */
    label: string;
    /** Accent variant for the pill. */
    variant: AckVariant;
    /** Start the "sending" phase. No-op for actions without ACK_META copy. */
    begin: (actionName: string, amountText?: string) => void;
    /** Advance to the "confirmed" flash, respecting the sending floor. No-op unless sending. */
    confirm: () => void;
    /** Switch to the "failed" receipt. No-op unless a pill is showing. */
    fail: () => void;
    /** Clear immediately (e.g. it became the player's turn again — heads-up). */
    clear: () => void;
}

/** The label shown when a submit is rejected; the toast carries the specific reason. */
const FAILED_LABEL = "Couldn't send — try again";

export function useActionAck(): ActionAck {
    const [state, setState] = useState<AckState | null>(null);
    // Mirror of `state` for use inside the stable callbacks below, which must
    // guard on the current phase without re-subscribing on every transition.
    const stateRef = useRef<AckState | null>(null);
    const sendingStartRef = useRef<number>(0);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    const setBoth = useCallback((next: AckState | null) => {
        stateRef.current = next;
        setState(next);
    }, []);

    const clearTimers = useCallback(() => {
        timers.current.forEach(t => clearTimeout(t));
        timers.current = [];
    }, []);

    const clear = useCallback(() => {
        clearTimers();
        setBoth(null);
    }, [clearTimers, setBoth]);

    const begin = useCallback(
        (actionName: string, amountText?: string) => {
            const meta = ACK_META[actionName];
            if (!meta) return;
            clearTimers();
            const amt = amountText && amountText.length > 0 && meta.connector ? `${meta.connector}${amountText}` : "";
            sendingStartRef.current = Date.now();
            setBoth({
                phase: "sending",
                variant: meta.variant,
                sendingLabel: `${meta.sending}${amt}…`,
                confirmedLabel: `${meta.confirmed}${amt}`
            });
        },
        [clearTimers, setBoth]
    );

    const confirm = useCallback(() => {
        const cur = stateRef.current;
        if (!cur || cur.phase !== "sending") return;
        const toConfirmed = () => {
            const c = stateRef.current;
            if (!c || c.phase !== "sending") return;
            setBoth({ ...c, phase: "confirmed" });
            const fade = setTimeout(() => {
                if (stateRef.current?.phase === "confirmed") setBoth(null);
            }, CONFIRMED_HOLD_MS);
            timers.current.push(fade);
        };
        const elapsed = Date.now() - sendingStartRef.current;
        const delay = Math.max(0, MIN_ACK_VISIBLE_MS - elapsed);
        if (delay === 0) toConfirmed();
        else timers.current.push(setTimeout(toConfirmed, delay));
    }, [setBoth]);

    const fail = useCallback(() => {
        const cur = stateRef.current;
        if (!cur || cur.phase === "failed") return;
        clearTimers();
        setBoth({ ...cur, phase: "failed" });
        const t = setTimeout(() => {
            if (stateRef.current?.phase === "failed") setBoth(null);
        }, FAILED_HOLD_MS);
        timers.current.push(t);
    }, [clearTimers, setBoth]);

    // Clean up any pending timers on unmount.
    useEffect(() => clearTimers, [clearTimers]);

    const label = state ? (state.phase === "confirmed" ? state.confirmedLabel : state.phase === "failed" ? FAILED_LABEL : state.sendingLabel) : "";

    return {
        phase: state?.phase ?? null,
        label,
        variant: state?.variant ?? "call",
        begin,
        confirm,
        fail,
        clear
    };
}
