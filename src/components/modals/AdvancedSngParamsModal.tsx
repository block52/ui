import React, { useMemo, useState } from "react";
import { Modal } from "../common";
import { hasContent } from "@block52/poker-ui-core/utils/guards";
import {
    parseAdvancedSngParams,
    buildSngPreview,
    mergeAdvancedParams,
    ADVANCED_SNG_FIELDS,
    type AdvancedSngParams,
    type SngPreviewInput
} from "../../utils/sngAdvancedParams";

interface AdvancedSngParamsModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Current effective SNG values from the form, used as the merge base + preview fallback. */
    current: SngPreviewInput;
    /** Called with the merged params when the user applies valid JSON. */
    onApply: (params: AdvancedSngParams) => void;
}

const PLACEHOLDER = `{
  "maxPlayers": 6,
  "buyIn": 10,
  "startingStack": 1500,
  "smallBlind": 25,
  "bigBlind": 50,
  "blindLevelDuration": 10
}`;

/**
 * AdvancedSngParamsModal - lets a user paste a JSON object of custom Sit & Go
 * params, validates it, and previews the resulting game (runners, starting
 * stacks, blind levels) before applying the values back into the form.
 */
const AdvancedSngParamsModal: React.FC<AdvancedSngParamsModalProps> = ({ isOpen, onClose, current, onApply }) => {
    const [jsonText, setJsonText] = useState("");

    // Re-validate on every keystroke. A blank field is "not yet valid" but we
    // don't want to shout an error before the user has typed anything.
    const parseResult = useMemo(() => parseAdvancedSngParams(jsonText), [jsonText]);
    const showErrors = hasContent(jsonText.trim()) && !parseResult.isValid;

    // Preview reflects the merged result (form values + valid overrides). While
    // the JSON is invalid we preview the current form values so the panel isn't
    // empty.
    const preview = useMemo(() => {
        const merged = parseResult.isValid
            ? mergeAdvancedParams(current, parseResult.params)
            : current;
        return buildSngPreview(merged);
    }, [parseResult, current]);

    const handleApply = () => {
        if (parseResult.isValid) {
            onApply(parseResult.params);
            setJsonText("");
            onClose();
        }
    };

    const handleClose = () => {
        setJsonText("");
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Advanced Options (Custom Params)"
            titleIcon="⚙"
            widthClass="w-[640px]"
            patternId="hexagons-advanced-sng"
        >
            <p className="text-gray-400 text-xs mb-3">
                Paste a JSON object to override any Sit &amp; Go setting. Recognised fields:{" "}
                {ADVANCED_SNG_FIELDS.map((field, i) => (
                    <React.Fragment key={field}>
                        {i > 0 && ", "}
                        <code className="text-blue-300">{field}</code>
                    </React.Fragment>
                ))}
                . Blinds &amp; stacks are in chips; buy-in is in USDC.
            </p>

            <textarea
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
                spellCheck={false}
                rows={9}
                placeholder={PLACEHOLDER}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm font-mono resize-y focus:outline-none focus:border-blue-500"
            />

            {/* Validation errors */}
            {showErrors && (
                <div className="mt-3 bg-red-900/30 border border-red-700 rounded-lg p-3">
                    <p className="text-red-300 text-xs font-semibold mb-1">Validation errors:</p>
                    <ul className="text-red-400/90 text-xs space-y-0.5 list-disc list-inside">
                        {parseResult.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Preview */}
            <div className="mt-4">
                <p className="text-gray-300 text-sm font-semibold mb-2">
                    Preview {parseResult.isValid && hasContent(jsonText.trim()) ? "(with custom params)" : "(current settings)"}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700">
                        <p className="text-gray-500 text-[10px] uppercase">Runners</p>
                        <p className="text-green-400 text-sm font-medium">{preview.runners}</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700">
                        <p className="text-gray-500 text-[10px] uppercase">Starting Stack</p>
                        <p className="text-green-400 text-sm font-medium">{preview.startingStack.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700">
                        <p className="text-gray-500 text-[10px] uppercase">Buy-In</p>
                        <p className="text-green-400 text-sm font-medium">${preview.buyIn.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700">
                        <p className="text-gray-500 text-[10px] uppercase">Chips In Play</p>
                        <p className="text-green-400 text-sm font-medium">{preview.totalChipsInPlay.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700 max-h-52 overflow-y-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                                <th className="text-left py-1.5 px-2">Level</th>
                                <th className="text-left py-1.5 px-2">Small Blind</th>
                                <th className="text-left py-1.5 px-2">Big Blind</th>
                                <th className="text-left py-1.5 px-2">Ante</th>
                                <th className="text-left py-1.5 px-2">Duration</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-300">
                            {preview.levels.map(level => (
                                <tr key={level.level} className={level.level === 1 ? "bg-green-900/20" : ""}>
                                    <td className="py-1.5 px-2">{level.level}</td>
                                    <td className="py-1.5 px-2">{level.isBreak ? "Break" : level.smallBlind.toLocaleString()}</td>
                                    <td className="py-1.5 px-2">{level.isBreak ? "" : level.bigBlind.toLocaleString()}</td>
                                    <td className="py-1.5 px-2">{level.isBreak || level.ante === 0 ? "\u2014" : level.ante.toLocaleString()}</td>
                                    <td className="py-1.5 px-2">{level.durationMinutes} min</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="text-gray-500 text-[10px] mt-2">* {preview.structureNote} Level 1 is highlighted.</p>
                </div>
            </div>

            <div className="flex gap-3 mt-5">
                <button
                    onClick={handleApply}
                    disabled={!parseResult.isValid}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
                >
                    Apply to Form
                </button>
                <button
                    onClick={handleClose}
                    className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                    Cancel
                </button>
            </div>
        </Modal>
    );
};

export default AdvancedSngParamsModal;
