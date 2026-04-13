import React, { useState, useCallback } from "react";
import Chip from "./playPage/common/Chip";
import { decomposeAmount, ChipStackEntry, parseCustomAmounts, chipColorClass } from "../utils/chipBreakdown";

/**
 * Convert a dollar amount to USDC micro-unit string (6 decimals).
 * $1.50 → "1500000"
 */
function dollarsToUsdc(dollars: number): string {
    return Math.round(dollars * 1_000_000).toString();
}

interface Preset {
    label: string;
    amounts: number[];
    description: string;
}

/** Default dollar amount shown in the debug panel when first opened */
const DEFAULT_AMOUNT = 50;

const PRESETS: Preset[] = [
    // --- Single chip ---
    { label: "$0.02 SB", amounts: [0.02], description: "Micro-stakes small blind" },
    { label: "$0.04 BB", amounts: [0.04], description: "Micro-stakes big blind" },
    { label: "$1", amounts: [1], description: "Single white chip" },
    { label: "$5", amounts: [5], description: "Single red chip" },
    { label: "$25", amounts: [25], description: "Single green chip" },
    { label: "$100", amounts: [100], description: "Single black chip" },
    { label: "$500", amounts: [500], description: "Single purple chip" },
    { label: "$1000", amounts: [1000], description: "Single yellow chip" },

    // --- Vertical stacks ---
    { label: "$2 (2×$1)", amounts: [2], description: "2 white chips stacked" },
    { label: "$3 (3×$1)", amounts: [3], description: "3 white chips stacked" },
    { label: "$4 (4×$1)", amounts: [4], description: "4 white chips stacked (cap)" },
    { label: "$10 (2×$5)", amounts: [10], description: "2 red chips stacked" },
    { label: "$200 (2×$100)", amounts: [200], description: "2 black chips stacked" },
    { label: "$400 (4×$100)", amounts: [400], description: "4 black chips (vis cap)" },

    // --- 2 columns ---
    { label: "$6 (5+1)", amounts: [6], description: "1 red + 1 white" },
    { label: "$30 (25+5)", amounts: [30], description: "1 green + 1 red" },
    { label: "$125 (100+25)", amounts: [125], description: "1 black + 1 green" },
    { label: "$150 (100+2×25)", amounts: [150], description: "1 black + 2 green stacked" },
    { label: "$600 (500+100)", amounts: [600], description: "1 purple + 1 black" },

    // --- 3 columns ---
    { label: "$31 (25+5+1)", amounts: [31], description: "green + red + white" },
    { label: "$130 (100+25+5)", amounts: [130], description: "black + green + red" },
    { label: "$312 (3×100+2×5+2×1)", amounts: [312], description: "3 stacked + 2 cols" },
    { label: "$5555", amounts: [5555], description: "orange + purple + green (capped)" },

    // --- Multi-action (betting rounds) ---
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
        if (parsed.length > 0) {
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

    // Decompose for breakdown display
    const breakdownPerAction = liveAmounts.map(amt => ({
        dollars: amt,
        stacks: decomposeAmount(Math.floor(amt)),
    }));

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
            onClick={onClose}
        >
            <div
                className="bg-[#1a1f2e] rounded-2xl shadow-2xl border border-gray-700 w-[800px] max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Chip Debug Panel</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-2xl leading-none"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Live preview with dark table-like background */}
                    <div className="bg-[#0d1a2d] rounded-xl p-8 flex flex-col items-center gap-6">
                        <span className="text-gray-400 text-sm">Live Preview (actual Chip component)</span>
                        <div className="flex items-center justify-center min-h-[60px]">
                            <Chip amount={totalUsdc} />
                        </div>
                        <div className="text-gray-500 text-xs">
                            Total: ${totalDollars.toFixed(2)} | Actions: {liveAmounts.length} | USDC: {totalUsdc}
                        </div>
                    </div>

                    {/* Custom input */}
                    <div>
                        <label className="text-gray-300 text-sm font-medium block mb-2">
                            Custom amounts (dollar values, comma-separated for multiple actions):
                        </label>
                        <input
                            type="text"
                            value={customAmounts}
                            onChange={e => handleCustomChange(e.target.value)}
                            className="w-full bg-[#0d1a2d] border border-gray-600 rounded-lg px-4 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                            placeholder="e.g. 50  or  25, 130, 500"
                        />
                        <p className="text-gray-500 text-xs mt-1">
                            Single value = one bet. Comma-separated = multiple betting actions (blind, call, raise).
                        </p>
                    </div>

                    {/* Presets grid */}
                    <div>
                        <span className="text-gray-300 text-sm font-medium block mb-2">Presets:</span>
                        <div className="grid grid-cols-3 gap-2">
                            {PRESETS.map((preset, i) => (
                                <button
                                    key={i}
                                    onClick={() => handlePresetClick(i)}
                                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                                        activePresetIndex === i
                                            ? "bg-blue-900/40 border-blue-500 text-white"
                                            : "bg-[#0d1a2d] border-gray-700 text-gray-300 hover:border-gray-500"
                                    }`}
                                >
                                    <div className="font-medium">{preset.label}</div>
                                    <div className="text-xs text-gray-500">{preset.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Decomposition breakdown */}
                    <div>
                        <span className="text-gray-300 text-sm font-medium block mb-2">Breakdown:</span>
                        <div className="bg-[#0d1a2d] rounded-lg p-4 space-y-3">
                            {breakdownPerAction.map((action, ai) => (
                                <div key={ai} className="border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                                    <div className="text-xs text-gray-400 mb-1">
                                        Action {ai + 1}: ${action.dollars.toFixed(2)}
                                        {action.dollars < 1 && " → floors to $0 → fallback white chip"}
                                    </div>
                                    <div className="flex gap-3 flex-wrap">
                                        {action.stacks.map((stack: ChipStackEntry, si: number) => (
                                            <div key={si} className="flex items-center gap-1.5 bg-gray-800/50 rounded px-2 py-1">
                                                <div className={`w-3 h-3 rounded-full border border-gray-600 ${chipColorClass(stack.color)}`} />
                                                <span className="text-white text-xs font-mono">
                                                    {stack.visibleCount}×${stack.value}
                                                </span>
                                                <span className="text-gray-500 text-xs">
                                                    {stack.color}
                                                </span>
                                                {stack.count > stack.visibleCount && (
                                                    <span className="text-yellow-500 text-xs">
                                                        (actual: {stack.count})
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Summary */}
                            <div className="pt-2 border-t border-gray-700 text-xs text-gray-400 flex gap-4">
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
