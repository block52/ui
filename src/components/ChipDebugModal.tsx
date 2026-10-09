import React, { useState, useCallback } from "react";
import Chip from "./playPage/common/Chip";
import { decomposeAmount, ChipStackEntry, parseCustomAmounts, chipColorClass } from "../utils/chipBreakdown";
import { hasElements } from "../utils/guards";

const dollarsToUsdc = (dollars: number): string => Math.round(dollars * 1_000_000).toString();

interface Preset {
    label: string;
    amounts: number[];
    description: string;
}

const DEFAULT_AMOUNT = 50;

const PRESETS: Preset[] = [
    { label: "$0.02 SB", amounts: [0.02], description: "Micro-stakes small blind" },
    { label: "$0.04 BB", amounts: [0.04], description: "Micro-stakes big blind" },
    { label: "$1", amounts: [1], description: "Single white chip" },
    { label: "$5", amounts: [5], description: "Single red chip" },
    { label: "$25", amounts: [25], description: "Single green chip" },
    { label: "$100", amounts: [100], description: "Single black chip" },
    { label: "$500", amounts: [500], description: "Single purple chip" },
    { label: "$1000", amounts: [1000], description: "Single yellow chip" },
    { label: "$2 (2×$1)", amounts: [2], description: "2 white chips stacked" },
    { label: "$3 (3×$1)", amounts: [3], description: "3 white chips stacked" },
    { label: "$4 (4×$1)", amounts: [4], description: "4 white chips stacked (cap)" },
    { label: "$10 (2×$5)", amounts: [10], description: "2 red chips stacked" },
    { label: "$200 (2×$100)", amounts: [200], description: "2 black chips stacked" },
    { label: "$400 (4×$100)", amounts: [400], description: "4 black chips (vis cap)" },
    { label: "$6 (5+1)", amounts: [6], description: "1 red + 1 white" },
    { label: "$30 (25+5)", amounts: [30], description: "1 green + 1 red" },
    { label: "$125 (100+25)", amounts: [125], description: "1 black + 1 green" },
    { label: "$150 (100+2×25)", amounts: [150], description: "1 black + 2 green stacked" },
    { label: "$600 (500+100)", amounts: [600], description: "1 purple + 1 black" },
    { label: "$31 (25+5+1)", amounts: [31], description: "green + red + white" },
    { label: "$130 (100+25+5)", amounts: [130], description: "black + green + red" },
    { label: "$312 (3×100+2×5+2×1)", amounts: [312], description: "3 stacked + 2 cols" },
    { label: "$5555", amounts: [5555], description: "orange + purple + green (capped)" },
    { label: "BB + Call", amounts: [0.04, 0.08], description: "2 actions → 2 white chips" },
    { label: "SB + Call + Call", amounts: [0.02, 0.06, 0.12], description: "3 actions → 3 chips" },
    { label: "BB($50) + Call($100)", amounts: [50, 100], description: "2 green + 1 black" },
    { label: "BB($50) + Call($100) + Re-raise($250)", amounts: [50, 100, 250], description: "3 action groups" },
    { label: "$25 + $130 + $500", amounts: [25, 130, 500], description: "Mixed multi-action" },
];

const ChipDebugModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [customAmounts, setCustomAmounts] = useState<string>(String(DEFAULT_AMOUNT));
    const [activePresetIndex, setActivePresetIndex] = useState<number | null>(null);
    const [liveAmounts, setLiveAmounts] = useState<number[]>([DEFAULT_AMOUNT]);

    const parseCustom = useCallback((text: string): number[] => {
        return parseCustomAmounts(text);
    }, []);

    const handleCustomChange = useCallback((text: string) => {
        setCustomAmounts(text);
        setActivePresetIndex(null);
        const parsed = parseCustom(text);
        if (hasElements(parsed)) {
            setLiveAmounts(parsed);
        }
    }, [parseCustom]);

    const handlePresetClick = useCallback((index: number) => {
        setActivePresetIndex(index);
        const preset = PRESETS[index];
        setLiveAmounts(preset.amounts);
        setCustomAmounts(preset.amounts.join(", "));
    }, []);

    const totalDollars = liveAmounts.reduce((sum, a) => sum + a, 0);
    const usdcAmounts = liveAmounts.map(dollarsToUsdc);
    const totalUsdc = dollarsToUsdc(totalDollars);

    const breakdownPerAction = liveAmounts.map(amt => ({
        dollars: amt,
        stacks: decomposeAmount(Math.floor(amt)),
    }));

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-surface-card rounded-2xl shadow-2xl border border-line w-[800px] max-w-[95vw] max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 border-b border-line">
                    <h2 className="m-0 text-[17px] font-semibold text-ink">Chip Debug Panel</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-2.5 shrink-0 w-11 h-11 grid place-items-center rounded-btn text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-light"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
                        </svg>
                    </button>
                </div>

                <div className="p-5 sm:p-6 space-y-6">
                    <div className="bg-surface-raised border border-line rounded-xl p-6 sm:p-8 flex flex-col items-center gap-6">
                        <span className="text-ink-muted text-xs uppercase tracking-[0.08em]">Live Preview (actual Chip component)</span>
                        <div className="flex items-center justify-center min-h-[60px]">
                            <Chip amount={totalUsdc} />
                        </div>
                        <div className="text-ink-muted text-xs font-mono">
                            Total: ${totalDollars.toFixed(2)} | Actions: {liveAmounts.length} | USDC: {totalUsdc}
                        </div>
                    </div>

                    <div>
                        <label className="block mb-2 text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
                            Custom amounts (dollar values, comma-separated for multiple actions):
                        </label>
                        <input
                            type="text"
                            value={customAmounts}
                            onChange={e => handleCustomChange(e.target.value)}
                            className="w-full h-11 px-4 rounded-xl bg-surface-raised border border-line-strong text-ink font-mono text-sm placeholder:text-ink-muted/70 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30"
                            placeholder="e.g. 50  or  25, 130, 500"
                        />
                        <p className="text-ink-muted text-xs mt-1.5">
                            Single value = one bet. Comma-separated = multiple betting actions (blind, call, raise).
                        </p>
                    </div>

                    <div>
                        <span className="block mb-2 text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">Presets:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {PRESETS.map((preset, i) => (
                                <button
                                    key={i}
                                    onClick={() => handlePresetClick(i)}
                                    className={`text-left px-3 py-2 min-h-11 rounded-xl border text-sm transition-colors ${
                                        activePresetIndex === i
                                            ? "bg-brand/10 border-brand text-ink"
                                            : "bg-surface-raised border-line text-ink-soft hover:border-line-strong"
                                    }`}
                                >
                                    <div className="font-medium">{preset.label}</div>
                                    <div className="text-xs text-ink-muted">{preset.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <span className="block mb-2 text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">Breakdown:</span>
                        <div className="bg-surface-raised border border-line rounded-xl p-4 space-y-3">
                            {breakdownPerAction.map((action, ai) => (
                                <div key={ai} className="border-b border-line pb-2 last:border-0 last:pb-0">
                                    <div className="text-xs text-ink-muted mb-1">
                                        Action {ai + 1}: ${action.dollars.toFixed(2)}
                                        {action.dollars < 1 && " → floors to $0 → fallback white chip"}
                                    </div>
                                    <div className="flex gap-3 flex-wrap">
                                        {action.stacks.map((stack: ChipStackEntry, si: number) => (
                                            <div key={si} className="flex items-center gap-1.5 bg-surface-hover rounded-lg px-2 py-1">
                                                <div className={`w-3 h-3 rounded-full border border-line-strong ${chipColorClass(stack.color)}`} />
                                                <span className="text-ink text-xs font-mono">
                                                    {stack.visibleCount}×${stack.value}
                                                </span>
                                                <span className="text-ink-muted text-xs">
                                                    {stack.color}
                                                </span>
                                                {stack.count > stack.visibleCount && (
                                                    <span className="text-amber-300 text-xs">
                                                        (actual: {stack.count})
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="pt-2 border-t border-line text-xs text-ink-muted font-mono flex flex-wrap gap-x-4 gap-y-1">
                                <span>Total stacks (columns): {breakdownPerAction.reduce((sum, a) => sum + a.stacks.length, 0)}</span>
                                <span>Total visible chips: {breakdownPerAction.reduce((sum, a) => sum + a.stacks.reduce((s: number, st: ChipStackEntry) => s + st.visibleCount, 0), 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChipDebugModal;
