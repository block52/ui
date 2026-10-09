import { resolveDebugOverlayAction, isEditableTarget, DebugKeyEvent } from "./debugOverlayKeys";

const ev = (over: Partial<DebugKeyEvent>): DebugKeyEvent => ({
    key: "",
    ctrlKey: false,
    metaKey: false,
    target: null,
    ...over
});

describe("resolveDebugOverlayAction", () => {
    describe("Ctrl+I / ⌘I toggles all overlays", () => {
        it("returns 'all' for Ctrl+I", () => {
            expect(resolveDebugOverlayAction(ev({ key: "i", ctrlKey: true }), false)).toBe("all");
        });

        it("returns 'all' for ⌘I (metaKey) — macOS", () => {
            expect(resolveDebugOverlayAction(ev({ key: "i", metaKey: true }), false)).toBe("all");
        });

        it("accepts an uppercase 'I'", () => {
            expect(resolveDebugOverlayAction(ev({ key: "I", ctrlKey: true }), false)).toBe("all");
        });

        it("does not fire for a bare 'i' with no modifier", () => {
            expect(resolveDebugOverlayAction(ev({ key: "i" }), false)).toBeNull();
        });
    });

    describe("bare number keys never toggle", () => {
        it("a bare '1' does nothing (the old all-overlays hotkey)", () => {
            expect(resolveDebugOverlayAction(ev({ key: "1" }), false)).toBeNull();
        });

        it("a bare '2' does nothing while debug mode is off", () => {
            expect(resolveDebugOverlayAction(ev({ key: "2" }), false)).toBeNull();
        });
    });

    describe("typing in an input never toggles", () => {
        it("ignores '1' typed in an input", () => {
            const input = document.createElement("input");
            expect(resolveDebugOverlayAction(ev({ key: "1", target: input }), true)).toBeNull();
        });

        it("ignores Ctrl+I from an input", () => {
            const input = document.createElement("input");
            expect(resolveDebugOverlayAction(ev({ key: "i", ctrlKey: true, target: input }), false)).toBeNull();
        });

        it("ignores '2' typed in a textarea even with debug mode on", () => {
            const ta = document.createElement("textarea");
            expect(resolveDebugOverlayAction(ev({ key: "2", target: ta }), true)).toBeNull();
        });
    });

    describe("single-overlay keys are gated behind debug mode", () => {
        const cases: Array<[string, string]> = [
            ["2", "geometry"],
            ["3", "seats"],
            ["4", "chips"],
            ["5", "dealers"],
            ["6", "crosshair"],
            ["7", "cards"]
        ];

        it.each(cases)("key '%s' returns null when debug mode is off", key => {
            expect(resolveDebugOverlayAction(ev({ key }), false)).toBeNull();
        });

        it.each(cases)("key '%s' returns '%s' when debug mode is on", (key, action) => {
            expect(resolveDebugOverlayAction(ev({ key }), true)).toBe(action);
        });
    });
});

describe("isEditableTarget", () => {
    it("true for input, textarea, select", () => {
        expect(isEditableTarget(document.createElement("input"))).toBe(true);
        expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
        expect(isEditableTarget(document.createElement("select"))).toBe(true);
    });

    it("true for a contentEditable element", () => {
        const div = document.createElement("div");
        div.contentEditable = "true";
        // jsdom does not compute isContentEditable from the attribute, so stub it.
        Object.defineProperty(div, "isContentEditable", { value: true });
        expect(isEditableTarget(div)).toBe(true);
    });

    it("false for a plain div and for null", () => {
        expect(isEditableTarget(document.createElement("div"))).toBe(false);
        expect(isEditableTarget(null)).toBe(false);
    });
});
