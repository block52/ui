import React from "react";
import { useTimeBankClock } from "../../../hooks/playerActions/useTimeBankClock";
import { hasValue } from "../../../utils/guards";
import "./TimeBankClock.css";

type TimeBankClockProps = {
    tableId: string | undefined;
    seat: number;
};

const LABELS = {
    idle: "Time bank",
    ready: "Use time bank",
    armed: "Time bank armed: it starts when your clock runs out",
    running: "Time bank running"
} as const;

/**
 * The alarm-clock time bank button beside the player's own pill, just left of
 * the seat number (ui#19). Tap it on your turn to arm the bank: it glows while
 * your turn clock runs down, then rings while the bank counts down.
 */
export const TimeBankClock: React.FC<TimeBankClockProps> = React.memo(({ tableId, seat }) => {
    const { state, seconds, onUse } = useTimeBankClock(tableId, seat);

    if (state === "hidden") {
        return null;
    }

    const label = state === "ready" && hasValue(seconds) ? `${LABELS.ready} (+${seconds}s)` : LABELS[state];

    return (
        <button
            type="button"
            className={`time-bank-clock time-bank-clock-${state}`}
            onClick={e => {
                e.stopPropagation();
                onUse();
            }}
            disabled={state !== "ready"}
            aria-label={label}
            title={label}
            data-testid="time-bank-clock"
            data-state={state}
        >
            <svg className="time-bank-clock-icon" viewBox="0 0 32 32" aria-hidden="true">
                {/* bells */}
                <path className="tbc-bell" d="M3.2 9.6a5.6 5.6 0 0 1 7.4-6.9l-7.4 6.9z" />
                <path className="tbc-bell" d="M28.8 9.6a5.6 5.6 0 0 0-7.4-6.9l7.4 6.9z" />
                {/* hammer */}
                <path className="tbc-hammer" d="M16 2.2v2.6M13.4 2.2h5.2" />
                {/* legs */}
                <path className="tbc-leg" d="M8.6 26.4l-2.4 3.2M23.4 26.4l2.4 3.2" />
                {/* body + face */}
                <circle className="tbc-body" cx="16" cy="17" r="11.2" />
                <circle className="tbc-face" cx="16" cy="17" r="8.6" />
                {/* hour ticks */}
                <path className="tbc-tick" d="M16 9.6v1.6M16 22.8v1.6M8.6 17h1.6M21.8 17h1.6" />
                {/* hands */}
                <path className="tbc-hand" d="M16 17V12.2" />
                <path className="tbc-hand tbc-hand-minute" d="M16 17l3.6 2.4" />
                <circle className="tbc-pin" cx="16" cy="17" r="1.2" />
            </svg>
            {state === "ready" && hasValue(seconds) ? <span className="time-bank-clock-seconds">{seconds}</span> : null}
        </button>
    );
});

TimeBankClock.displayName = "TimeBankClock";
