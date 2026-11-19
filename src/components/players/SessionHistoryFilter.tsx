import { FC, useEffect, useRef, useState } from "react";
import { hasValue } from "../../utils/guards";
import type { SessionGameFilterOption } from "../../utils/sessionGameDisplay";
import styles from "./SessionHistoryFilter.module.css";

interface SessionHistoryFilterProps {
    value: string;
    options: SessionGameFilterOption[];
    onChange: (key: string) => void;
}

/** Game-type menu for the History panel. One entry per type present in the history. */
export const SessionHistoryFilter: FC<SessionHistoryFilterProps> = ({ value, options, onChange }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const selected = options.find(option => option.key === value);
    const label = hasValue(selected) ? selected.label : value;

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent) => {
            const target = event.target;
            if (target instanceof Node && rootRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div className={styles.wrap} ref={rootRef}>
            <button
                type="button"
                className={styles.trigger}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Filter by game type"
                onClick={() => setOpen(current => !current)}
            >
                <span>{label}</span>
                <span className={styles.caret} aria-hidden="true">
                    {open ? "▴" : "▾"}
                </span>
            </button>
            {open && (
                <ul className={styles.menu} role="listbox" aria-label="Game types">
                    {options.map(option => (
                        <li key={option.key}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={value === option.key}
                                className={`${styles.option} ${value === option.key ? styles.selected : ""}`}
                                onClick={() => {
                                    onChange(option.key);
                                    setOpen(false);
                                }}
                            >
                                {option.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
