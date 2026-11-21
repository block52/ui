import { useCallback, useMemo, useState } from "react";
import { DEFAULT_ANTE_FORM, type AnteFormState } from "../utils/anteRule";
import {
    anteFormForChoice,
    anteFormOfCustomText,
    customTextFromPlan,
    customTextWithAnte,
    DEFAULT_BLIND_STRUCTURE_CHOICE,
    DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT,
    resolveBlindStructureChoice,
    type BlindPlan,
    type BlindStructureChoice,
    type DoublingBlinds
} from "../utils/blindStructureChoice";

export interface BlindStructureForm {
    choice: BlindStructureChoice;
    /** Choose a structure: a preset fills the ante controls; Custom opens with the current structure written out. */
    setChoice: (choice: BlindStructureChoice) => void;
    customText: string;
    setCustomText: (text: string) => void;
    /** The ante controls; for Custom they follow the text's antes as it is edited. */
    anteForm: AnteFormState;
    /** Change the ante controls; for Custom this rewrites the text's antes. */
    setAnteForm: (form: AnteFormState) => void;
    /** The controls can't be used: the custom text does not parse. */
    anteControlsDisabled: boolean;
    /** The custom text has hand-written per-level antes. */
    customAntes: boolean;
    /** What the form submits and previews. */
    plan: BlindPlan;
}

/**
 * The blind structure part of the create forms (ui#860, ui#905, ui#891):
 * structure choice, custom text and ante controls, kept in sync, resolved
 * into the plan to submit and preview. Shared by the lobby's create modal and
 * /admin/tables. The logic is in utils/blindStructureChoice and utils/anteRule.
 */
export const useBlindStructureForm = (doubling: DoublingBlinds): BlindStructureForm => {
    const [choice, setChoiceState] = useState<BlindStructureChoice>(DEFAULT_BLIND_STRUCTURE_CHOICE);
    const [customText, setCustomTextState] = useState(DEFAULT_CUSTOM_BLIND_STRUCTURE_TEXT);
    const [anteControls, setAnteControls] = useState<AnteFormState>(DEFAULT_ANTE_FORM);

    const { smallBlind, bigBlind, durationMinutes } = doubling;
    const plan = useMemo(
        () => resolveBlindStructureChoice(choice, customText, { smallBlind, bigBlind, durationMinutes }, anteControls),
        [choice, customText, smallBlind, bigBlind, durationMinutes, anteControls]
    );

    const customAnte = useMemo(() => (choice === "custom" ? anteFormOfCustomText(customText, anteControls) : undefined), [choice, customText, anteControls]);

    const setChoice = useCallback(
        (next: BlindStructureChoice) => {
            if (next === choice) return;
            if (next === "custom") {
                const text = customTextFromPlan(plan);
                if (text) setCustomTextState(text);
            }
            setAnteControls(anteFormForChoice(next, anteControls, customText, choice));
            setChoiceState(next);
        },
        [choice, plan, anteControls, customText]
    );

    const setAnteForm = useCallback(
        (form: AnteFormState) => {
            setAnteControls(form);
            if (choice !== "custom") return;
            const text = customTextWithAnte(customText, form);
            if (text) setCustomTextState(text);
        },
        [choice, customText]
    );

    // Typing in the custom text moves the controls to the antes it sets.
    const setCustomText = useCallback(
        (text: string) => {
            setCustomTextState(text);
            const parsed = anteFormOfCustomText(text, anteControls);
            if (parsed && !parsed.custom) setAnteControls(parsed.form);
        },
        [anteControls]
    );

    return {
        choice,
        setChoice,
        customText,
        setCustomText,
        anteForm: anteControls,
        setAnteForm,
        anteControlsDisabled: choice === "custom" && !customAnte,
        customAntes: customAnte?.custom ?? false,
        plan
    };
};
