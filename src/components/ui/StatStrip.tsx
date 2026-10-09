import React from "react";
import { cssVars } from "../../utils/cssVars";

export interface StatItem {
    label: string;
    value: React.ReactNode;
    /** Small text after the value, e.g. "of 4 nodes". */
    suffix?: React.ReactNode;
    tone?: "default" | "good" | "bad" | "muted";
}

const toneClass: Record<NonNullable<StatItem["tone"]>, string> = {
    default: "text-ink",
    good: "text-emerald-400",
    bad: "text-red-400",
    muted: "text-ink-muted"
};

export const StatStrip: React.FC<{ items: ReadonlyArray<StatItem> }> = ({ items }) => (
    <div
        className="grid grid-cols-2 md:[grid-template-columns:repeat(var(--stat-cols),minmax(0,1fr))] gap-px bg-line border border-line rounded-2xl overflow-hidden"
        style={cssVars({ "--stat-cols": String(items.length) })}
    >
        {items.map((item, index) => (
            <div
                key={`${item.label}-${index}`}
                // With an odd count the last cell spans both phone columns so no empty grey cell shows.
                className={`bg-surface-card px-5 py-4 flex flex-col gap-1.5 min-w-0 ${
                    items.length % 2 === 1 && index === items.length - 1 ? "col-span-2 md:col-span-1" : ""
                }`}
            >
                <span className="text-xs uppercase tracking-[0.08em] text-ink-muted">{item.label}</span>
                <span className="flex items-baseline gap-1.5 min-w-0">
                    <span className={`text-2xl font-semibold tabular-nums truncate ${toneClass[item.tone ?? "default"]}`}>{item.value}</span>
                    {item.suffix && <span className="text-ink-muted text-sm">{item.suffix}</span>}
                </span>
            </div>
        ))}
    </div>
);
