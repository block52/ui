import React, { useMemo, useState } from "react";
import { Modal } from "../common";
import { ModalFooter } from "./ModalFooter";
import { PillButton } from "../ui/PillButton";
import { fieldLabelClass, insetBoxClass, noticeClass } from "./walletFormClasses";
import { hasContent } from "../../utils/guards";
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
            title="Advanced Options"
            subtitle="Override any Sit & Go setting with a JSON object."
            titleIcon={<SlidersIcon />}
            widthClass="w-[640px]"
        >
            <label htmlFor="advanced-sng-json" className={fieldLabelClass}>
                Custom params (JSON)
            </label>
            <textarea
                id="advanced-sng-json"
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
                spellCheck={false}
                rows={9}
                placeholder={PLACEHOLDER}
                className="w-full px-4 py-3 rounded-xl bg-surface-raised border border-line text-ink placeholder:text-ink-muted/70 text-sm font-mono resize-y focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40 transition-colors"
            />
            <p className="mt-2 mb-0 text-xs text-ink-muted leading-relaxed">
                Recognised fields:{" "}
                {ADVANCED_SNG_FIELDS.map((field, i) => (
                    <React.Fragment key={field}>
                        {i > 0 && ", "}
                        <code className="text-brand-light">{field}</code>
                    </React.Fragment>
                ))}
                . Blinds &amp; stacks are in chips; buy-in is in USDC.
            </p>

            {showErrors && (
                <div role="alert" className={`mt-3 ${noticeClass.error}`}>
                    <p className="m-0 text-xs font-semibold mb-1">Validation errors:</p>
                    <ul className="m-0 text-xs space-y-0.5 list-disc list-inside">
                        {parseResult.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="mt-5">
                <p className={`${fieldLabelClass} !mb-2`}>
                    Preview {parseResult.isValid && hasContent(jsonText.trim()) ? "(with custom params)" : "(current settings)"}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className={insetBoxClass}>
                        <p className="m-0 text-ink-muted text-[10px] uppercase tracking-[0.08em]">Runners</p>
                        <p className="m-0 mt-0.5 text-ink text-sm font-semibold tabular-nums">{preview.runners}</p>
                    </div>
                    <div className={insetBoxClass}>
                        <p className="m-0 text-ink-muted text-[10px] uppercase tracking-[0.08em]">Starting Stack</p>
                        <p className="m-0 mt-0.5 text-ink text-sm font-semibold tabular-nums">{preview.startingStack.toLocaleString()}</p>
                    </div>
                    <div className={insetBoxClass}>
                        <p className="m-0 text-ink-muted text-[10px] uppercase tracking-[0.08em]">Buy-In</p>
                        <p className="m-0 mt-0.5 text-emerald-400 text-sm font-semibold tabular-nums">${preview.buyIn.toFixed(2)}</p>
                    </div>
                    <div className={insetBoxClass}>
                        <p className="m-0 text-ink-muted text-[10px] uppercase tracking-[0.08em]">Chips In Play</p>
                        <p className="m-0 mt-0.5 text-ink text-sm font-semibold tabular-nums">{preview.totalChipsInPlay.toLocaleString()}</p>
                    </div>
                </div>

                <div className="rounded-xl bg-surface-raised border border-line p-3 max-h-52 overflow-auto">
                    <table className="w-full text-xs tabular-nums">
                        <thead>
                            <tr className="text-ink-muted border-b border-line">
                                <th className="text-left font-medium py-1.5 px-2">Level</th>
                                <th className="text-left font-medium py-1.5 px-2">Small Blind</th>
                                <th className="text-left font-medium py-1.5 px-2">Big Blind</th>
                                <th className="text-left font-medium py-1.5 px-2">Duration</th>
                            </tr>
                        </thead>
                        <tbody className="text-ink-soft">
                            {preview.levels.map(level => (
                                <tr key={level.level} className={level.level === 1 ? "bg-brand/10 text-ink" : ""}>
                                    <td className="py-1.5 px-2">{level.level}</td>
                                    <td className="py-1.5 px-2">{level.smallBlind.toLocaleString()}</td>
                                    <td className="py-1.5 px-2">{level.bigBlind.toLocaleString()}</td>
                                    <td className="py-1.5 px-2 whitespace-nowrap">{level.durationMinutes} min</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="m-0 text-ink-muted text-[10px] mt-2">* Blinds double each level. Level 1 is highlighted.</p>
                </div>
            </div>

            <ModalFooter>
                <PillButton onClick={handleApply} disabled={!parseResult.isValid} size="lg" className="w-full">
                    Apply to Form
                </PillButton>
                <PillButton variant="ghost" onClick={handleClose} className="w-full">
                    Cancel
                </PillButton>
            </ModalFooter>
        </Modal>
    );
};

const SlidersIcon: React.FC = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
    </svg>
);

export default AdvancedSngParamsModal;
