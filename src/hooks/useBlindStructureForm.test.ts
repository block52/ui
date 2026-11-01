import { act, renderHook } from "@testing-library/react";
import { DEFAULT_ANTE_FORM } from "../utils/anteRule";
import { previewBlindLevels } from "../utils/blindStructureChoice";
import { useBlindStructureForm } from "./useBlindStructureForm";

const blinds = { smallBlind: 10, bigBlind: 20, durationMinutes: 10 };

describe("useBlindStructureForm (ui#891)", () => {
    it("opens on the ladder with antes on from level 4 at a full big blind", () => {
        const { result } = renderHook(() => useBlindStructureForm(blinds));
        expect(result.current.choice).toBe("ladder");
        expect(result.current.anteForm).toEqual(DEFAULT_ANTE_FORM);
        expect(previewBlindLevels(result.current.plan.preview!, 5).map(r => r.ante)).toEqual(["0", "0", "0", "80", "100"]);
    });

    it("turning antes off updates the plan at once", () => {
        const { result } = renderHook(() => useBlindStructureForm(blinds));
        act(() => result.current.setAnteForm({ ...DEFAULT_ANTE_FORM, enabled: false }));
        expect(previewBlindLevels(result.current.plan.preview!, 10).every(r => r.ante === "0")).toBe(true);
    });

    it("a preset fills the controls from the preset", () => {
        const { result } = renderHook(() => useBlindStructureForm(blinds));
        act(() => result.current.setChoice("hyper_turbo"));
        expect(result.current.anteForm).toEqual({ enabled: true, startLevel: 4, percentOfBigBlind: 10 });
        expect(result.current.plan.structure).toEqual({ preset: "hyper_turbo" });
    });

    it("custom opens with the current structure written out and stays in sync with the controls both ways", () => {
        const { result } = renderHook(() => useBlindStructureForm(blinds));
        act(() => result.current.setChoice("doubling"));
        act(() => result.current.setChoice("custom"));
        expect(result.current.customText).toContain("progression: double");
        expect(result.current.customText).toContain("ante: level >= 3 ? bb : 0");

        act(() => result.current.setAnteForm({ enabled: true, startLevel: 2, percentOfBigBlind: 50 }));
        expect(result.current.customText).toContain("ante: level >= 1 ? bb * 0.5 : 0");

        act(() => result.current.setCustomText(result.current.customText.replace("ante: level >= 1 ? bb * 0.5 : 0", "ante: level >= 5 ? bb * 0.25 : 0")));
        expect(result.current.anteForm).toEqual({ enabled: true, startLevel: 6, percentOfBigBlind: 25 });

        act(() => result.current.setCustomText("BLINDS broken {"));
        expect(result.current.anteControlsDisabled).toBe(true);
        expect(result.current.plan.error).toBeDefined();
    });
});
