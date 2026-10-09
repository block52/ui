import React, { useId } from "react";
import styles from "./SidePanel.module.css";

interface SettingToggleProps {
    label: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
}

export const SettingToggle: React.FC<SettingToggleProps> = ({ label, description, checked, onToggle }) => {
    const labelId = useId();
    const descriptionId = useId();

    return (
        <div className="flex items-start justify-between gap-4 px-4 py-4 min-h-[64px]">
            <div className="flex-1 min-w-0">
                <p id={labelId} className="text-[15px] font-medium leading-tight text-ink">
                    {label}
                </p>
                <p id={descriptionId} className="mt-1 text-sm leading-snug text-ink-muted break-words">
                    {description}
                </p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                onClick={onToggle}
                title={checked ? "Enabled — click to disable" : "Disabled — click to enable"}
                className="group -my-2 -mr-2 flex h-11 w-14 flex-shrink-0 items-center justify-center rounded-full focus-visible:outline-none"
            >
                <span
                    className={`relative block h-6 w-11 rounded-full transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-brand-light group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface-card ${
                        checked ? "bg-brand" : "bg-line-strong"
                    }`}
                >
                    <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow ${styles.thumb} ${
                            checked ? "translate-x-5" : "translate-x-0"
                        }`}
                    />
                </span>
            </button>
        </div>
    );
};
