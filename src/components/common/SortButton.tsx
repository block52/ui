import React from "react";

export type SortDirection = "asc" | "desc" | null;

interface SortButtonProps {
    label: string;
    direction: SortDirection;
    onClick: () => void;
    title?: string;
}

export const SortButton: React.FC<SortButtonProps> = ({ label, direction, onClick, title }) => {
    const icon = direction === "asc" ? "▲" : direction === "desc" ? "▼" : "⇅";
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-1 hover:text-white transition-colors"
            title={title ?? `Sort by ${label.toLowerCase()}`}
        >
            {label}
            <span className="text-xs">{icon}</span>
        </button>
    );
};
