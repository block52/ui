import React, { useMemo, useState } from "react";
import { Modal } from "../common";
import { BlindPreviewTable, BlindStructureSelect, CustomBlindStructureInput } from "../BlindStructureFields";
import { SNG_BLINDS } from "../../constants/blindLevels";
import { DEFAULT_SNG_BLIND_LEVEL_MINUTES } from "../../constants/blindLevels";
import {
    DEFAULT_BLIND_STRUCTURE_CHOICE,
    DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT,
    choiceUsesFormBlinds,
    openingBlindsOf,
    previewBlindLevels,
    resolveBlindStructureChoice,
    type BlindStructureChoice
} from "../../utils/blindStructureChoice";
import {
    DEFAULT_TOURNAMENT_FORM_VALUES,
    defaultStartTimeLocal,
    tournamentBlindStructure,
    tournamentCreationFeeMicro,
    validateTournamentForm,
    type TournamentFormField,
    type TournamentFormValues
} from "../../utils/tournamentCreate";
import { hasElements, isBlank, isNullish } from "../../utils/guards";
import { formatUsdc } from "../../utils/tournamentLobby";
import { parseUsdcToMicro } from "../../constants/currency";
import type { CreateTournamentParams } from "../../utils/tournamentTx";

const PREVIEW_LEVELS = 8;

const INPUT = "w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50";

interface CreateTournamentModalProps {
    isOpen: boolean;
    busy: boolean;
    error: string | null;
    onSubmit: (params: CreateTournamentParams) => void;
    onClose: () => void;
}

const Field: React.FC<{ label: string; hint?: string; error?: string; children: React.ReactNode; testId: string }> = ({ label, hint, error, children, testId }) => (
    <div>
        <label className="block text-white text-sm mb-1">{label}</label>
        {children}
        {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
        {error && (
            <p className="text-xs text-red-400 mt-1" data-testid={`${testId}-error`}>
                {error}
            </p>
        )}
    </div>
);

/** The create-tournament form. Validation and the message it builds live in utils/tournamentCreate. */
export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({ isOpen, busy, error, onSubmit, onClose }) => {
    const [values, setValues] = useState<TournamentFormValues>(() => ({ ...DEFAULT_TOURNAMENT_FORM_VALUES, startTime: defaultStartTimeLocal(Date.now()) }));
    const [choice, setChoice] = useState<BlindStructureChoice>(DEFAULT_BLIND_STRUCTURE_CHOICE);
    const [customText, setCustomText] = useState(DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT);
    const [blindsIndex, setBlindsIndex] = useState(1); // 25 / 50
    const [levelMinutes, setLevelMinutes] = useState(DEFAULT_SNG_BLIND_LEVEL_MINUTES);
    const [submitted, setSubmitted] = useState(false);

    const plan = useMemo(
        () => resolveBlindStructureChoice(choice, customText, { ...SNG_BLINDS[blindsIndex], durationMinutes: levelMinutes }),
        [choice, customText, blindsIndex, levelMinutes]
    );
    const blindStructure = tournamentBlindStructure(plan);
    const previewRows = useMemo(() => (plan.preview ? previewBlindLevels(plan.preview, PREVIEW_LEVELS) : []), [plan.preview]);

    const result = validateTournamentForm({ values, blindStructure, blindError: plan.error, nowMs: Date.now() });

    const creationFee = useMemo(() => {
        if (isNullish(plan.preview)) return null;
        try {
            return tournamentCreationFeeMicro(parseUsdcToMicro(values.buyIn), BigInt(isBlank(values.startingStack) ? "0" : values.startingStack), BigInt(openingBlindsOf(plan.preview).bigBlind));
        } catch {
            return null;
        }
    }, [plan.preview, values.buyIn, values.startingStack]);

    const set = (field: keyof TournamentFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => setValues(v => ({ ...v, [field]: e.target.value }));
    // Show an error once the field has been tried: after the first submit, every error shows.
    const err = (field: TournamentFormField): string | undefined => (submitted ? result.errors[field] : undefined);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        if (result.params) onSubmit(result.params);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create tournament" error={error} isProcessing={busy} widthClass="w-[40rem]" patternId="hexagons-tournament-create">
            <form onSubmit={handleSubmit} className="space-y-3" data-testid="create-tournament-form" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Buy-in (USDC)" error={err("buyIn")} testId="buyIn" hint="What each player pays to register.">
                        <input data-testid="tournament-buyin-input" className={INPUT} inputMode="decimal" value={values.buyIn} onChange={set("buyIn")} />
                    </Field>
                    <Field label="Entry fee (USDC)" error={err("entryFee")} testId="entryFee" hint="Comes out of the buy-in and goes to you. 0 for none.">
                        <input data-testid="tournament-entryfee-input" className={INPUT} inputMode="decimal" value={values.entryFee} onChange={set("entryFee")} />
                    </Field>
                    <Field label="Starting stack (chips)" error={err("startingStack")} testId="startingStack">
                        <input className={INPUT} inputMode="numeric" value={values.startingStack} onChange={set("startingStack")} />
                    </Field>
                    <Field label="Seats per table" error={err("seatsPerTable")} testId="seatsPerTable" hint="2 to 9.">
                        <input className={INPUT} inputMode="numeric" value={values.seatsPerTable} onChange={set("seatsPerTable")} />
                    </Field>
                    <Field label="Minimum entrants" error={err("minEntrants")} testId="minEntrants" hint="Cancelled with refunds if fewer have registered at the start.">
                        <input className={INPUT} inputMode="numeric" value={values.minEntrants} onChange={set("minEntrants")} />
                    </Field>
                    <Field label="Maximum entrants" error={err("maxEntrants")} testId="maxEntrants" hint="Registration closes when this many have registered. Up to 180.">
                        <input className={INPUT} inputMode="numeric" value={values.maxEntrants} onChange={set("maxEntrants")} />
                    </Field>
                    <Field label="Start time" error={err("startTime")} testId="startTime" hint="Registration closes then, and it starts with the minimum or more.">
                        <input data-testid="tournament-start-input" type="datetime-local" className={INPUT} value={values.startTime} onChange={set("startTime")} />
                    </Field>
                    <Field label="Action timeout (seconds)" error={err("actionTimeoutSeconds")} testId="actionTimeoutSeconds" hint="Every table's action clock.">
                        <input className={INPUT} inputMode="numeric" value={values.actionTimeoutSeconds} onChange={set("actionTimeoutSeconds")} />
                    </Field>
                </div>

                <div>
                    <BlindStructureSelect value={choice} onChange={setChoice} />
                    {choiceUsesFormBlinds(choice) && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-white text-sm mb-1 mt-3">Starting blinds (chips)</label>
                                <select className={INPUT} value={blindsIndex} onChange={e => setBlindsIndex(Number(e.target.value))}>
                                    {SNG_BLINDS.map((b, i) => (
                                        <option key={b.bigBlind} value={i}>
                                            {b.smallBlind} / {b.bigBlind}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-white text-sm mb-1 mt-3">Minutes per level</label>
                                <select className={INPUT} value={levelMinutes} onChange={e => setLevelMinutes(Number(e.target.value))}>
                                    {[3, 5, 10, 15, 20, 30].map(m => (
                                        <option key={m} value={m}>
                                            {m} min
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    {choice === "custom" && <CustomBlindStructureInput value={customText} onChange={setCustomText} error={plan.error} />}
                    <BlindPreviewTable rows={previewRows} />
                    {err("blindStructure") && choice !== "custom" && <p className="text-xs text-red-400 mt-1">{err("blindStructure")}</p>}
                </div>

                <div className="text-xs text-gray-400 rounded-lg border border-gray-700 p-3" data-testid="tournament-create-fee">
                    {isNullish(creationFee) ? "Creation fee: set the buy-in, starting stack and blinds to see it." : `Creating costs you ${formatUsdc(creationFee)} (10 big blinds of level 1, priced at the buy-in's chip value).`}
                </div>

                {submitted && hasElements(Object.keys(result.errors)) && (
                    <p className="text-sm text-red-400" role="alert" data-testid="tournament-create-summary">
                        Fix the {Object.keys(result.errors).length === 1 ? "field" : `${Object.keys(result.errors).length} fields`} marked in red to create the tournament.
                    </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white disabled:opacity-50"
                        data-testid="tournament-create-submit"
                    >
                        {busy ? "Waiting for the chain…" : "Create tournament"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
