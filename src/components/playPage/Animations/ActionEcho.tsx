import React, { useEffect, useState } from "react";
import { PlayerActionType } from "@block52/poker-vm-sdk";
import { ActionEchoEntry } from "../../../hooks/game/useAppliedActions";
import "./ActionEcho.css";

/**
 * Committed-action echo badge (docs/plans/2026_07_11_action_feedback_ux.md — Approach C).
 *
 * Pops a short-lived "Raise $6.00" / "Fold" badge over a seat when that seat
 * commits an action, so the click-to-state-update moment (~150ms on the gateway)
 * is actually visible. Chip actions add a small chips flourish. Renders committed
 * data only — see useAppliedActions for the source and the mount/hand-boundary rules.
 */

/** Per-action colour class (see ActionEcho.css). Falls back to the neutral CALL look. */
const KIND_CLASS: Record<string, string> = {
    [PlayerActionType.FOLD]: "action-echo--fold",
    [PlayerActionType.CHECK]: "action-echo--check",
    [PlayerActionType.CALL]: "action-echo--call",
    [PlayerActionType.BET]: "action-echo--bet",
    [PlayerActionType.RAISE]: "action-echo--raise",
    [PlayerActionType.ALL_IN]: "action-echo--allin"
};

/** Actions that move chips — get the rising-chips flourish. */
const CHIP_ACTIONS = new Set<string>([PlayerActionType.CALL, PlayerActionType.BET, PlayerActionType.RAISE, PlayerActionType.ALL_IN]);

/** How long the badge lingers so a glance-away player can still read it. */
const ECHO_VISIBLE_MS = 2500;

interface ActionEchoProps {
    echo: ActionEchoEntry;
    position: { left: string; top: string };
}

const ActionEcho: React.FC<ActionEchoProps> = ({ echo, position }) => {
    const [visible, setVisible] = useState<boolean>(true);

    // Re-arm the linger timer whenever a NEW action lands for this seat (index bumps).
    // Re-showing on index change is intentional (see useAutoNewHand for the same pattern).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), ECHO_VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [echo.index]);

    if (!visible) return null;

    const kindClass = KIND_CLASS[echo.action] ?? "action-echo--call";
    const showChips = CHIP_ACTIONS.has(echo.action);

    return (
        <div className="action-echo-container" style={{ left: position.left, top: position.top }}>
            <div className={`action-echo ${kindClass} ${echo.isMe ? "action-echo--me" : ""}`} role="status" aria-live="polite">
                {echo.label}
            </div>
            {showChips && (
                <div className="action-echo-chips" aria-hidden="true">
                    <span className="action-echo-chip action-echo-chip-0" />
                    <span className="action-echo-chip action-echo-chip-1" />
                    <span className="action-echo-chip action-echo-chip-2" />
                </div>
            )}
        </div>
    );
};

ActionEcho.displayName = "ActionEcho";
export default React.memo(ActionEcho);
