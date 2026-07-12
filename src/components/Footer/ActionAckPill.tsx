import React from "react";
import type { AckPhase, AckVariant } from "../../hooks/playerActions/useActionAck";

/**
 * ActionAckPill — dumb presentational receipt rendered in the footer slot the
 * action buttons occupied (Approach A of the action-feedback UX plan).
 *
 * It renders no game state — only the phase + label the phase machine
 * (useActionAck) hands it. `role="status" aria-live="polite"` so the acted
 * state is announced to screen readers, which the disappearing buttons never
 * were.
 */
interface ActionAckPillProps {
    phase: AckPhase;
    label: string;
    variant: AckVariant;
    isMobileLandscape?: boolean;
}

export const ActionAckPill: React.FC<ActionAckPillProps> = ({ phase, label, variant, isMobileLandscape = false }) => {
    return (
        <div
            role="status"
            aria-live="polite"
            className={`ack-pill ack-pill--${variant} ack-pill--${phase} flex items-center justify-center gap-2 w-full rounded-lg shadow-md backdrop-blur-sm font-medium ${
                isMobileLandscape ? "px-2 py-0.5 text-[10px]" : "px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm"
            }`}
        >
            <span className="ack-pill__icon" aria-hidden="true">
                {phase === "confirmed" ? "✓" : phase === "failed" ? "✕" : <span className="ack-pill__dot" />}
            </span>
            <span>{label}</span>
        </div>
    );
};
