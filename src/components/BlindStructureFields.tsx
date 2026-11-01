/**
 * Blind structure controls shared by the lobby's create modal (Dashboard) and
 * /admin/tables (ui#905, ui#906): the structure select, the custom-text box and
 * the level preview. The logic lives in utils/blindStructureChoice; these are
 * just its views, so the two create forms can't drift apart again.
 */
import React from "react";
import {
    BLIND_STRUCTURE_CHOICES,
    describeBlindStructureChoice,
    isBlindStructureChoice,
    type BlindLevelRow,
    type BlindStructureChoice
} from "../utils/blindStructureChoice";
import { isEmpty } from "../utils/guards";

const DEFAULT_CONTROL_CLASS =
    "w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200";

interface BlindStructureSelectProps {
    value: BlindStructureChoice;
    onChange: (choice: BlindStructureChoice) => void;
    className?: string;
    labelClassName?: string;
}

/** The Blind Structure select: Ladder (default), Doubling, the presets, Custom. */
export const BlindStructureSelect: React.FC<BlindStructureSelectProps> = ({ value, onChange, className, labelClassName }) => (
    <>
        <label className={labelClassName ?? "block text-white text-sm mb-1 mt-3"}>Blind Structure</label>
        <select
            data-testid="blind-structure"
            value={value}
            onChange={e => {
                if (isBlindStructureChoice(e.target.value)) onChange(e.target.value);
            }}
            className={className ?? DEFAULT_CONTROL_CLASS}
        >
            {BLIND_STRUCTURE_CHOICES.map(c => (
                <option key={c.value} value={c.value}>
                    {c.label}
                </option>
            ))}
        </select>
    </>
);

interface CustomBlindStructureInputProps {
    value: string;
    onChange: (text: string) => void;
    error?: string;
    labelClassName?: string;
}

/** The custom structure textarea (SDK text form) with its parse error. */
export const CustomBlindStructureInput: React.FC<CustomBlindStructureInputProps> = ({ value, onChange, error, labelClassName }) => (
    <>
        <label className={labelClassName ?? "block text-white text-sm mb-1 mt-3"}>Custom structure</label>
        <textarea
            data-testid="blind-custom"
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full p-2 rounded bg-gray-700 text-white font-mono text-xs border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
        />
        <p className="text-xs text-gray-400 mt-1">
            start: sb/bb {"\u00b7"} duration: 5m {"\u00b7"} progression: double | linear 25 | percentage 1.5 (+ round: 25) {"\u00b7"} ante: bb | bb * 0.1 |
            level &gt;= 4 ? bb * 0.1 : 0 {"\u00b7"} cap: 15 {"\u2014"} or levels {"{"} 0: 100/200 {"\u2026"} {"}"} (levels count from 0)
        </p>
        {error && (
            <p className="text-xs text-red-400 mt-1" data-testid="blind-structure-error">
                {error}
            </p>
        )}
    </>
);

interface BlindPreviewTableProps {
    rows: BlindLevelRow[];
    /** When set, a footnote describing the structure is shown under the table. */
    choice?: BlindStructureChoice;
    className?: string;
}

/** The first levels as the engine will play them: Level, Blinds, Ante, Minutes. */
export const BlindPreviewTable: React.FC<BlindPreviewTableProps> = ({ rows, choice, className }) => {
    if (isEmpty(rows)) return null;
    return (
        <div className={className ?? "mt-3 max-h-40 overflow-y-auto rounded border border-gray-700"} data-testid="blind-preview">
            <table className="w-full text-xs text-gray-300">
                <thead className="text-gray-400 sticky top-0 bg-gray-800">
                    <tr>
                        <th className="text-left px-2 py-1">Level</th>
                        <th className="text-left px-2 py-1">Blinds</th>
                        <th className="text-left px-2 py-1">Ante</th>
                        <th className="text-left px-2 py-1">Minutes</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.number} className={`border-t border-gray-700${r.number === 1 ? " bg-green-900/20" : ""}`}>
                            <td className="px-2 py-1">{r.number}</td>
                            <td className="px-2 py-1">{r.isBreak ? "Break" : `${Number(r.smallBlind).toLocaleString()} / ${Number(r.bigBlind).toLocaleString()}`}</td>
                            <td className="px-2 py-1">{r.isBreak || r.ante === "0" ? "\u2014" : Number(r.ante).toLocaleString()}</td>
                            <td className="px-2 py-1">{r.durationMinutes}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {choice && (
                <p className="text-gray-500 text-xs px-2 py-2 border-t border-gray-700" data-testid="blind-preview-note">
                    * {describeBlindStructureChoice(choice)} Level 1 is highlighted.
                </p>
            )}
        </div>
    );
};
